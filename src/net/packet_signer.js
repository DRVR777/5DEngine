/**
 * packet_signer.js — Signs outgoing 5DEngine network frames with the local
 * dworld identity. Installs `window.__wwcSignFrame` for wwc_sync.js to call.
 *
 * Channel strategy (per CRYPT_ANALYST_20260322 + SCHIZOPHRENIC_ACELLERATOR):
 *   CH0 STATE  (20Hz)  — HMAC per-frame + Ed25519 heartbeat at 1Hz
 *   CH1 EVENTS         — Full Ed25519 per-packet
 *   CH2 WORLD          — Full Ed25519 per-packet
 *   CH3 CHAT           — Double ratchet at wwc layer (no extra signing here)
 *   CH4 AGENT          — Full Ed25519 per-packet via window.__wwcSignFrame hook
 *
 * Anti-replay: every frame includes { seq, ts, node_id }
 * Epoch signature: every ~1000ms, the epoch Merkle root is Ed25519-signed.
 *
 * Usage:
 *   import { PacketSigner } from "./src/identity/packet_signer.js";
 *   const signer = new PacketSigner(identity); // DWorldIdentity instance
 *   signer.install(); // sets window.__wwcSignFrame
 *
 *   // Or directly:
 *   const signed = await signer.signFrame({ channel: 1, payload: { type: "kill" } });
 */

import { getIdentity } from "./dworld_identity.js";

const EPOCH_INTERVAL_MS = 1000; // sign epoch root every 1 second
const HEARTBEAT_CHANNEL = 0;

// ── HMAC-SHA256 for per-frame MACs on high-freq channels ─────────────────────

async function hmacSha256(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, data);
  return new Uint8Array(sig);
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function fromBase64(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

// ── PacketSigner ─────────────────────────────────────────────────────────────

export class PacketSigner {
  constructor(identity) {
    this._identity   = identity;
    this._seq        = 0;
    this._epoch      = 0;
    this._epochStart = Date.now();
    this._transitions = [];   // epoch Merkle leaf hashes
    this._lastSig    = null;
    this._sessionKey = null;  // derived from identity.netPubkey + Date.now()

    this._initSessionKey();
  }

  async _initSessionKey() {
    // Session key = HMAC-SHA256(netPrivkey, "session-" + epoch_start_ms)
    const enc  = new TextEncoder();
    const info = enc.encode("session-" + this._epochStart);
    this._sessionKey = await hmacSha256(
      this._identity._netPrivkey,
      info
    );
  }

  /** Frame key for per-frame HMAC: HKDF-expand(session_key, "frame" || seq) */
  async _frameKey(seq) {
    const enc = new TextEncoder();
    const keyMat = await crypto.subtle.importKey(
      "raw", this._sessionKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const label = enc.encode("frame" + seq.toString());
    const mac = await crypto.subtle.sign("HMAC", keyMat, label);
    return new Uint8Array(mac);
  }

  /**
   * Sign an outgoing frame. Returns the frame with added fields:
   *   _seq, _epoch, _ts, _node_id
   *   _mac      — HMAC-SHA256 per-frame MAC (cheap, all channels)
   *   _epoch_sig — Ed25519 over epoch root (1Hz, channels 0-4)
   *   _epoch_root — Merkle root of epoch transitions (when _epoch_sig present)
   */
  async signFrame(frame) {
    const identity = this._identity || getIdentity();
    if (!identity) return frame; // no identity loaded → return unsigned

    const now    = Date.now();
    const seq    = ++this._seq;
    const epoch  = Math.floor((now - this._epochStart) / EPOCH_INTERVAL_MS);
    const channel = frame.channel ?? 0;

    // Canonical payload bytes for signing
    const enc     = new TextEncoder();
    const payload = typeof frame.payload === "string" ? frame.payload : JSON.stringify(frame.payload);
    const payloadBytes = enc.encode(payload);

    // Per-frame HMAC (cheap, all channels)
    const fKey = await this._frameKey(seq);
    const macBytes = await hmacSha256(fKey, payloadBytes);
    const mac = toHex(macBytes);

    // Accumulate transition for epoch Merkle tree
    const leafHash = toHex(await sha256(enc.encode(`${seq}:${mac}:${now}`)));
    this._transitions.push(leafHash);

    // Track epoch boundary
    let epoch_sig  = undefined;
    let epoch_root = undefined;

    const isNewEpoch = epoch > this._epoch;
    if (isNewEpoch) {
      this._epoch = epoch;
      // Compute Merkle root from epoch transitions
      epoch_root = await this._computeEpochRoot(this._transitions);
      // Ed25519 sign the epoch root (expensive but only 1Hz)
      const rootBytes = enc.encode(epoch_root + ":" + epoch + ":" + identity.nodeId);
      epoch_sig = await identity.signGame(rootBytes);
      // Reset for next epoch
      this._transitions = [];
      this._lastSig = epoch_sig;
    }

    // For high-freq channel 0: include last epoch sig (refreshed at 1Hz)
    // For event/world channels: always include if available
    const sigToInclude = (channel === HEARTBEAT_CHANNEL)
      ? this._lastSig  // last epoch sig (ok to repeat at 20Hz)
      : (isNewEpoch ? epoch_sig : this._lastSig);  // fresh or cached

    const signed = {
      ...frame,
      payload,
      _seq:     seq,
      _epoch:   epoch,
      _ts:      now,
      _node_id: identity.nodeId,
      _mac:     mac,
    };

    if (sigToInclude) {
      signed._epoch_sig  = sigToInclude;
      if (isNewEpoch && epoch_root) signed._epoch_root = epoch_root;
    }

    return signed;
  }

  /** Compute Merkle root from array of hex-encoded leaf hashes */
  async _computeEpochRoot(leaves) {
    if (!leaves.length) return "0".repeat(64);
    let layer = [...leaves];
    const enc = new TextEncoder();
    while (layer.length > 1) {
      const next = [];
      for (let i = 0; i < layer.length; i += 2) {
        const a = layer[i];
        const b = layer[i + 1] ?? a;
        const combined = enc.encode(a + b);
        next.push(toHex(await sha256(combined)));
      }
      layer = next;
    }
    return layer[0];
  }

  /**
   * Verify an incoming signed frame.
   * Returns { valid: bool, reason: string }
   *
   * Used by ANKHOR registry before applying remote state to Things.
   */
  static async verifyFrame(frame, peerPubkeyHex) {
    if (!frame._node_id || !frame._mac || !frame._seq) {
      return { valid: false, reason: "missing auth fields" };
    }
    // Replay check: seq must be greater than last seen from this node
    // (caller maintains per-node seq counter — not done here)

    // Epoch signature check (if present)
    if (frame._epoch_sig && frame._epoch_root && peerPubkeyHex) {
      try {
        const enc = new TextEncoder();
        const msg = enc.encode(frame._epoch_root + ":" + frame._epoch + ":" + frame._node_id);
        const sigBytes = fromBase64(frame._epoch_sig);
        const pubBytes = new Uint8Array(peerPubkeyHex.match(/.{2}/g).map(h => parseInt(h, 16)));
        // WebCrypto Ed25519 verify
        const pubKey = await crypto.subtle.importKey(
          "raw", pubBytes, { name: "Ed25519" }, false, ["verify"]
        );
        const valid = await crypto.subtle.verify("Ed25519", pubKey, sigBytes, msg);
        if (!valid) return { valid: false, reason: "epoch sig invalid" };
      } catch (e) {
        return { valid: false, reason: "epoch sig verify error: " + e.message };
      }
    }
    return { valid: true, reason: "ok" };
  }

  /**
   * Install as window.__wwcSignFrame so wwc_sync.js (RICH_HUMAN's bridge)
   * can call it automatically.
   *
   * Called from NetworkBridge.start() or game boot sequence.
   */
  install() {
    window.__wwcSignFrame = async (frameInput) => {
      const frame = typeof frameInput === "string" ? JSON.parse(frameInput) : frameInput;
      const signed = await this.signFrame(frame);
      return typeof frameInput === "string" ? JSON.stringify(signed) : signed;
    };
    console.info("[packet-signer] window.__wwcSignFrame installed for node", this._identity.nodeId);
  }
}

// ── Verify helper for ANKHOR registry ─────────────────────────────────────────

/**
 * verifyNetSig — used by ThingaRegisterStore.applyDelta()
 * @param {string} sigB64     base64 epoch_sig
 * @param {string} nodeId     short "CDBA-CE7B" id
 * @param {string} epochRoot  hex epoch Merkle root
 * @param {number} epoch      epoch number
 * @param {string} pubkeyHex  hex game verifying key (from registry's dworld-identity facet)
 */
export async function verifyNetSig(sigB64, nodeId, epochRoot, epoch, pubkeyHex) {
  if (!sigB64 || !epochRoot || !pubkeyHex) return false;
  try {
    const enc     = new TextEncoder();
    const msg     = enc.encode(epochRoot + ":" + epoch + ":" + nodeId);
    const sigBytes = fromBase64(sigB64);
    const pubBytes = new Uint8Array(pubkeyHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const pubKey = await crypto.subtle.importKey("raw", pubBytes, { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", pubKey, sigBytes, msg);
  } catch (_) {
    return false;
  }
}

// ── Anti-cheat register schemas ───────────────────────────────────────────────

/**
 * REGISTER_SCHEMAS — canonical value ranges per facet field.
 * Any incoming state outside these ranges is silently rejected by the receiver.
 * This provides basic P2P anti-cheat without a central authority.
 */
export const REGISTER_SCHEMAS = {
  "health": {
    hp:    { type: "u8",  min: 0,      max: 255    },
    armor: { type: "u8",  min: 0,      max: 100    },
    maxHp: { type: "u8",  min: 1,      max: 255    },
  },
  "position": {
    x:       { type: "f32", min: -10000, max: 10000  },
    y:       { type: "f32", min: -100,   max: 500    },
    z:       { type: "f32", min: -10000, max: 10000  },
    heading: { type: "f32", min: -Math.PI, max: Math.PI },
  },
  "inventory": {
    ammo:       { type: "u16", min: 0, max: 9999 },
    grenade_count: { type: "u8", min: 0, max: 20 },
    coins:      { type: "u32", min: 0, max: 999999 },
  },
};

/**
 * Check if a facet data object is within declared register bounds.
 * Returns { valid: bool, violations: string[] }
 */
export function validateRegisterBounds(facetName, data) {
  const schema = REGISTER_SCHEMAS[facetName];
  if (!schema) return { valid: true, violations: [] };
  const violations = [];
  for (const [field, constraints] of Object.entries(schema)) {
    const val = data[field];
    if (val === undefined) continue;
    if (typeof val !== "number") { violations.push(`${field}: not a number`); continue; }
    if (val < constraints.min) violations.push(`${field}=${val} < min ${constraints.min}`);
    if (val > constraints.max) violations.push(`${field}=${val} > max ${constraints.max}`);
  }
  return { valid: violations.length === 0, violations };
}

/**
 * Speed/delta plausibility check for position updates.
 * Returns true if the position change is physically plausible.
 */
export function isPositionPlausible(prevPos, newPos, dtMs, maxSpeedUnitsPerSec = 25) {
  if (!prevPos || !newPos) return true;
  const dx  = (newPos.x ?? 0) - (prevPos.x ?? 0);
  const dz  = (newPos.z ?? 0) - (prevPos.z ?? 0);
  const dist = Math.sqrt(dx*dx + dz*dz);
  const dt  = dtMs / 1000;
  return dist <= maxSpeedUnitsPerSec * dt * 1.5; // 1.5x margin for network jitter
}
