/**
 * net_sig.js — ANKHOR facet handler for cryptographic network signatures.
 *
 * Tracks the verified cryptographic state of a remotely-controlled Thing.
 * Every state update from the network that has been verified by Ed25519
 * is recorded here, enabling anti-cheat checks and state provenance.
 *
 * Facet data schema:
 *   {
 *     epoch:       number  — current epoch (1-second counter from sender)
 *     seq:         number  — frame sequence number (monotonic per sender)
 *     epoch_root:  string  — hex Merkle root of epoch transitions
 *     epoch_sig:   string  — base64 Ed25519 signature over epoch_root
 *     verified:    bool    — was the last epoch_sig successfully verified?
 *     verifier:    string  — "local" | "relay" | "unverified"
 *     ts:          number  — unix ms of last verified update
 *     violations:  Array   — list of register bound violations (anti-cheat log)
 *   }
 *
 * Tick behavior:
 *   - Watches for stale verification (epoch_sig not updated in >5 epochs)
 *   - Accumulates violation log for anti-cheat reporting
 *   - Does NOT do signature verification itself (too slow in tick loop)
 *     Verification is done in packet_signer.verifyNetSig() at receive time.
 */

import { validateRegisterBounds, isPositionPlausible } from "../../identity/packet_signer.js";

const MAX_VIOLATION_LOG = 20;
const STALE_EPOCH_THRESHOLD = 5; // if epoch hasn't advanced in 5 seconds, mark stale

export default {
  priority: 3,   // After identity (2), before position/health (10+)

  tick(thing, data, dt, registry) {
    if (!data) return;

    const now = Date.now();

    // Stale detection: if epoch hasn't advanced and we're getting updates, something's wrong
    if (data._prev_epoch !== undefined && data.epoch === data._prev_epoch) {
      data._stale_ticks = (data._stale_ticks || 0) + 1;
      if (data._stale_ticks > STALE_EPOCH_THRESHOLD / dt) {
        data.verified = false;
        data.verifier = "stale";
      }
    } else {
      data._stale_ticks = 0;
      data._prev_epoch = data.epoch;
    }

    // Register bounds check: validate current facet values against schemas
    const facetNames = ["health", "position", "inventory"];
    for (const fname of facetNames) {
      const fdata = registry.facetData(thing.id, fname);
      if (!fdata) continue;
      const { valid, violations } = validateRegisterBounds(fname, fdata);
      if (!valid) {
        data.violations = data.violations || [];
        const entry = { ts: now, facet: fname, violations, epoch: data.epoch };
        data.violations.push(entry);
        // Cap violation log
        if (data.violations.length > MAX_VIOLATION_LOG) {
          data.violations = data.violations.slice(-MAX_VIOLATION_LOG);
        }
        // If violations exceed threshold, mark as cheating suspect
        if (data.violations.length >= 3) {
          data.cheat_suspect = true;
          if (typeof window !== "undefined" && window.EventBus) {
            window.EventBus.emit("net:cheat-suspect", {
              thing_id: thing.id,
              node_id:  registry.facetData(thing.id, "dworld-identity")?.node_id,
              violations: data.violations,
            });
          }
        }
      }
    }
  },

  /**
   * Called by NetworkBridge when a verified packet arrives.
   * Updates the net-sig facet with the new signature state.
   *
   * @param {Object} registry    — ANKHOR registry
   * @param {string} thingId     — e.g. "hero/CDBA-CE7B"
   * @param {Object} signedFrame — { _seq, _epoch, _ts, _node_id, _mac, _epoch_sig, _epoch_root }
   * @param {boolean} verified   — result of PacketSigner.verifyFrame()
   */
  applyNetSig(registry, thingId, signedFrame, verified) {
    const data = registry.facetData(thingId, "net-sig");
    if (!data) return;

    // Anti-replay: reject if seq is not advancing
    if (signedFrame._seq <= (data.seq || 0) && data.seq > 0) {
      console.warn(`[net-sig] replay detected for ${thingId}: seq ${signedFrame._seq} <= ${data.seq}`);
      return false;
    }

    // Anti-teleport: check position plausibility before applying
    if (signedFrame.channel === 0) {
      const payload = typeof signedFrame.payload === "string"
        ? JSON.parse(signedFrame.payload)
        : signedFrame.payload;
      const prevPos = registry.facetData(thingId, "position");
      const newPos  = payload.pos || payload.position;
      if (prevPos && newPos) {
        const dt = signedFrame._ts - (data.ts || signedFrame._ts);
        if (!isPositionPlausible(prevPos, newPos, dt)) {
          data.violations = data.violations || [];
          data.violations.push({ ts: Date.now(), kind: "teleport", prev: prevPos, new: newPos });
          console.warn(`[net-sig] teleport rejected for ${thingId}`);
          return false;
        }
      }
    }

    // Accept the update
    data.seq        = signedFrame._seq;
    data.epoch      = signedFrame._epoch;
    data.ts         = signedFrame._ts;
    data.verified   = verified;
    data.verifier   = verified ? "local" : "unverified";

    if (signedFrame._epoch_root) data.epoch_root = signedFrame._epoch_root;
    if (signedFrame._epoch_sig)  data.epoch_sig  = signedFrame._epoch_sig;

    return true; // OK to apply state update
  },
};
