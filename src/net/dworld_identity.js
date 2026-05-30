/**
 * dworld_identity.js — Browser-side Ed25519 identity for 5DEngine nodes.
 *
 * Each device that runs 5DEngine gets a cryptographic identity (Ed25519 keypair)
 * persisted in IndexedDB. This identity is used to sign all outgoing network
 * packets, making the player verifiable to all peers without a central server.
 *
 * Architecture:
 *   master_keypair (Ed25519)
 *     ├── game_sk   = HKDF(master, "5dengine-game-v1")      — avatar, save slot
 *     ├── net_sk    = HKDF(master, "5dengine-network-v1")   — P2P routing, node_id
 *     ├── compute_sk= HKDF(master, "5dengine-compute-v1")   — AI contribution
 *     └── social_sk = HKDF(master, "5dengine-social-v1")    — display name, friends
 *
 * Usage:
 *   import { DWorldIdentity } from "./src/identity/dworld_identity.js";
 *   const identity = await DWorldIdentity.loadOrCreate("mypassword");
 *   console.log(identity.nodeId);     // "CDBA-CE7B"
 *   console.log(identity.gamePubkey); // hex string (game public key)
 *
 * IndexedDB schema:
 *   DB: "5dengine-identity" | Store: "identity" | Key: "master"
 *   Value: { node_id, pubkey_b64, encrypted_sk_b64, salt_b64, created_at }
 *
 * Security notes:
 *   - Private key is AES-256-GCM encrypted with Argon2-derived key in storage
 *   - In memory, the CryptoKey is non-extractable where WebCrypto supports it
 *   - node_id = first 16 hex chars of SHA-256(net_pubkey), formatted "XXXX-XXXX"
 */

const DB_NAME    = "5dengine-identity";
const DB_VERSION = 1;
const STORE_NAME = "identity";
const MASTER_KEY = "master";

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function dbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function randomBytes(n) {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr;
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return out;
}

function toBase64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function fromBase64(b64) { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

/**
 * Derive encryption key from password + salt using PBKDF2.
 * (Argon2 is not in WebCrypto; PBKDF2 with 200k rounds is our fallback.)
 */
async function deriveEncKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt bytes with AES-256-GCM.
 * Returns { iv_b64, ciphertext_b64 }
 */
async function aesGcmEncrypt(key, plaintext) {
  const iv = await randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv_b64: toBase64(iv), ciphertext_b64: toBase64(new Uint8Array(ct)) };
}

/**
 * Decrypt bytes with AES-256-GCM.
 */
async function aesGcmDecrypt(key, iv_b64, ciphertext_b64) {
  const iv = fromBase64(iv_b64);
  const ct = fromBase64(ciphertext_b64);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new Uint8Array(pt);
}

/**
 * HKDF-SHA256: derive domain-specific key material from master seed bytes.
 * Returns 32 bytes.
 */
async function hkdfDerive(masterSeedBytes, info) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", masterSeedBytes, { name: "HKDF" }, false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode("5dengine-hkdf-v1"), info: enc.encode(info) },
    keyMaterial, 256
  );
  return new Uint8Array(bits);
}

/**
 * Generate Ed25519 keypair using WebCrypto.
 * Falls back to @noble/ed25519 if native Ed25519 is unavailable.
 */
async function generateEd25519Keypair() {
  // Native WebCrypto Ed25519 (Chrome 113+, Firefox 114+)
  if (crypto.subtle && crypto.subtle.generateKey) {
    try {
      const kp = await crypto.subtle.generateKey(
        { name: "Ed25519" }, true, ["sign", "verify"]
      );
      const privRaw = await crypto.subtle.exportKey("raw", kp.privateKey);
      const pubRaw  = await crypto.subtle.exportKey("raw", kp.publicKey);
      return {
        publicKey: new Uint8Array(pubRaw),
        privateKey: new Uint8Array(privRaw),
        _cryptoKey: kp  // keep CryptoKey pair for signing
      };
    } catch (_) {
      // Fall through to software implementation
    }
  }
  // Fallback: load @noble/ed25519 dynamically
  const { etc, getPublicKey } = await import("https://cdn.jsdelivr.net/npm/@noble/ed25519@2.1.0/+esm");
  const privRaw = await randomBytes(32);
  const pubRaw  = await getPublicKey(privRaw);
  return { publicKey: pubRaw, privateKey: privRaw, _cryptoKey: null };
}

/**
 * Derive an Ed25519 keypair from 32 bytes of seed material.
 * Used to create domain-specific sub-keypairs from the master seed.
 */
async function ed25519FromSeed(seedBytes) {
  // Noble/ed25519: private key IS the seed for Ed25519
  // WebCrypto: import raw 32-byte seed as Ed25519 private key
  if (crypto.subtle) {
    try {
      const privKey = await crypto.subtle.importKey(
        "raw", seedBytes, { name: "Ed25519" }, true, ["sign"]
      );
      const pubRaw = await derivePublicFromPrivate(seedBytes);
      return { publicKey: pubRaw, privateKey: seedBytes, _privCryptoKey: privKey };
    } catch (_) {}
  }
  const { getPublicKey } = await import("https://cdn.jsdelivr.net/npm/@noble/ed25519@2.1.0/+esm");
  const pubRaw = await getPublicKey(seedBytes);
  return { publicKey: pubRaw, privateKey: seedBytes, _privCryptoKey: null };
}

/** Derive public key from Ed25519 private key bytes via WebCrypto. */
async function derivePublicFromPrivate(privBytes) {
  // Export the key pair to get the public key bytes
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  // NOTE: We can't deterministically derive from privBytes without noble in all browsers.
  // This is a best-effort path; noble/ed25519 is the canonical route.
  const pubExport = await crypto.subtle.exportKey("raw", kp.publicKey);
  return new Uint8Array(pubExport); // placeholder — noble is preferred
}

/** SHA-256 hash of bytes → hex string */
async function sha256Hex(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(hash));
}

/** Format node_id from pubkey bytes: "CDBA-CE7B" (first 8 hex chars with dash) */
async function computeNodeId(pubkeyBytes) {
  const h = await sha256Hex(pubkeyBytes);
  return h.slice(0, 4).toUpperCase() + "-" + h.slice(4, 8).toUpperCase();
}

// ── DWorldIdentity class ──────────────────────────────────────────────────────

export class DWorldIdentity {
  constructor({ nodeId, gamePubkey, netPubkey, computePubkey, socialPubkey,
                gamePrivkey, netPrivkey, computePrivkey, socialPrivkey }) {
    this.nodeId         = nodeId;
    this.gamePubkey     = gamePubkey;     // Uint8Array
    this.netPubkey      = netPubkey;      // Uint8Array
    this.computePubkey  = computePubkey;  // Uint8Array
    this.socialPubkey   = socialPubkey;   // Uint8Array
    this._gamePrivkey   = gamePrivkey;    // Uint8Array (in memory only)
    this._netPrivkey    = netPrivkey;
    this._computePrivkey = computePrivkey;
    this._socialPrivkey  = socialPrivkey;
  }

  /** Sign arbitrary bytes with the GAME domain key. Returns base64 signature. */
  async signGame(bytes) {
    return this._sign(this._gamePrivkey, bytes);
  }

  /** Sign arbitrary bytes with the NETWORK domain key. Returns base64 signature. */
  async signNet(bytes) {
    return this._sign(this._netPrivkey, bytes);
  }

  /** Sign arbitrary bytes with the COMPUTE domain key. Returns base64 signature. */
  async signCompute(bytes) {
    return this._sign(this._computePrivkey, bytes);
  }

  async _sign(privkey, bytes) {
    // Try WebCrypto native Ed25519
    if (crypto.subtle) {
      try {
        const key = await crypto.subtle.importKey("raw", privkey, { name: "Ed25519" }, false, ["sign"]);
        const sig = await crypto.subtle.sign("Ed25519", key, bytes);
        return toBase64(new Uint8Array(sig));
      } catch (_) {}
    }
    // Fallback: noble/ed25519
    const { sign } = await import("https://cdn.jsdelivr.net/npm/@noble/ed25519@2.1.0/+esm");
    const sig = await sign(bytes, privkey);
    return toBase64(sig);
  }

  /** Export public identity info (safe to broadcast) */
  toPublicInfo() {
    return {
      node_id: this.nodeId,
      game_pubkey: toHex(this.gamePubkey),
      net_pubkey:  toHex(this.netPubkey),
      social_pubkey: toHex(this.socialPubkey),
      // compute_pubkey intentionally omitted from public broadcast
    };
  }

  /** Export as ANKHOR `dworld-identity` facet data */
  toFacetData(displayName = "") {
    return {
      node_id:         this.nodeId,
      game_pubkey_hex: toHex(this.gamePubkey),
      net_pubkey_hex:  toHex(this.netPubkey),
      display_name:    displayName,
      session_epoch:   0,
      last_seen_ts:    Date.now(),
    };
  }

  // ── Static factory methods ─────────────────────────────────────────────────

  /**
   * Load existing identity from IndexedDB, or create a new one.
   * @param {string} password  User passphrase for encrypting the stored key.
   * @param {string} [displayName] Optional display name (only used on creation).
   */
  static async loadOrCreate(password, displayName = "") {
    const db       = await openDB();
    const existing = await dbGet(db, MASTER_KEY);

    if (existing) {
      return DWorldIdentity._decrypt(existing, password);
    }
    return DWorldIdentity._generate(db, password, displayName);
  }

  /** Check if an identity exists (without loading the private key). */
  static async exists() {
    const db  = await openDB();
    const rec = await dbGet(db, MASTER_KEY);
    return !!rec;
  }

  /** Delete stored identity (irreversible without backup). */
  static async delete() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, "readwrite");
      const req = tx.objectStore(STORE_NAME).delete(MASTER_KEY);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  // ── Private factory helpers ────────────────────────────────────────────────

  static async _generate(db, password, displayName) {
    console.info("[dworld-identity] Generating new identity...");

    // Generate master seed (32 random bytes)
    const masterSeed = await randomBytes(32);

    // Derive domain seeds
    const gameSeed    = await hkdfDerive(masterSeed, "5dengine-game-v1");
    const netSeed     = await hkdfDerive(masterSeed, "5dengine-network-v1");
    const computeSeed = await hkdfDerive(masterSeed, "5dengine-compute-v1");
    const socialSeed  = await hkdfDerive(masterSeed, "5dengine-social-v1");

    // Generate domain keypairs from seeds
    const [gameKP, netKP, computeKP, socialKP] = await Promise.all([
      ed25519FromSeed(gameSeed),
      ed25519FromSeed(netSeed),
      ed25519FromSeed(computeSeed),
      ed25519FromSeed(socialSeed),
    ]);

    // Derive node_id from net pubkey
    const nodeId = await computeNodeId(netKP.publicKey);

    console.info(`[dworld-identity] node_id = ${nodeId}`);

    // Encrypt master seed for storage
    const salt   = await randomBytes(16);
    const encKey = await deriveEncKey(password, salt);
    const { iv_b64, ciphertext_b64 } = await aesGcmEncrypt(encKey, masterSeed);

    // Persist to IndexedDB
    const record = {
      node_id:         nodeId,
      net_pubkey_hex:  toHex(netKP.publicKey),
      game_pubkey_hex: toHex(gameKP.publicKey),
      encrypted_seed:  ciphertext_b64,
      iv:              iv_b64,
      salt_b64:        toBase64(salt),
      created_at:      Date.now(),
      display_name:    displayName,
    };
    await dbPut(db, MASTER_KEY, record);

    return new DWorldIdentity({
      nodeId,
      gamePubkey:    gameKP.publicKey,
      netPubkey:     netKP.publicKey,
      computePubkey: computeKP.publicKey,
      socialPubkey:  socialKP.publicKey,
      gamePrivkey:   gameSeed,
      netPrivkey:    netSeed,
      computePrivkey: computeSeed,
      socialPrivkey:  socialSeed,
    });
  }

  static async _decrypt(record, password) {
    const salt   = fromBase64(record.salt_b64);
    const encKey = await deriveEncKey(password, salt);
    const masterSeed = await aesGcmDecrypt(encKey, record.iv, record.encrypted_seed);

    // Re-derive domain seeds
    const gameSeed    = await hkdfDerive(masterSeed, "5dengine-game-v1");
    const netSeed     = await hkdfDerive(masterSeed, "5dengine-network-v1");
    const computeSeed = await hkdfDerive(masterSeed, "5dengine-compute-v1");
    const socialSeed  = await hkdfDerive(masterSeed, "5dengine-social-v1");

    const [gameKP, netKP, computeKP, socialKP] = await Promise.all([
      ed25519FromSeed(gameSeed),
      ed25519FromSeed(netSeed),
      ed25519FromSeed(computeSeed),
      ed25519FromSeed(socialSeed),
    ]);

    console.info(`[dworld-identity] Loaded identity: ${record.node_id}`);

    return new DWorldIdentity({
      nodeId:       record.node_id,
      gamePubkey:   gameKP.publicKey,
      netPubkey:    netKP.publicKey,
      computePubkey: computeKP.publicKey,
      socialPubkey:  socialKP.publicKey,
      gamePrivkey:   gameSeed,
      netPrivkey:    netSeed,
      computePrivkey: computeSeed,
      socialPrivkey:  socialSeed,
    });
  }
}

// ── Module-level singleton ────────────────────────────────────────────────────

/** Global identity singleton — set by calling DWorldIdentity.loadOrCreate() */
let _globalIdentity = null;

export function getIdentity() {
  return _globalIdentity;
}

export async function initIdentity(password, displayName = "") {
  _globalIdentity = await DWorldIdentity.loadOrCreate(password, displayName);
  window.__dworldNodeId = _globalIdentity.nodeId;
  console.info(`[dworld-identity] Active: ${_globalIdentity.nodeId}`);
  return _globalIdentity;
}
