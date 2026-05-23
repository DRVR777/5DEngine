// manifest.js — content-addressed signed manifests per
// DWRLD_META_RUNTIME_SHARED_OS_LAYER.md.
//
//   manifest = {
//     $schema: "5DEngine.manifest/1",
//     id: "blake3:<hex>",            // content address (placeholder)
//     kind: "world" | "app" | "asset" | "world_part",
//     version: "0.1.0",
//     deps: ["blake3:..."],          // other manifest IDs
//     content: { ...arbitrary... },  // hashed
//     signer: { pubkey: "ed25519:..." },
//     signature: "ed25519:<hex>",    // over canonical(content + meta)
//   }
//
// Real Ed25519/blake3 plug into the sidecar; this module owns the SHAPE
// + canonicalization + a verifying-stub that simulates signing for tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAManifest = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA = "5DEngine.manifest/1";

  // Deterministic stringify: sort keys at every level so signature is
  // independent of object insertion order.
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    const keys = Object.keys(value).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }

  // Stub hash: deterministic non-cryptographic placeholder. Real impl
  // routes through the sidecar's blake3.
  function _stubHash(s) {
    let h1 = 0x811c9dc5, h2 = 0x9e370001 >>> 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul((h1 ^ c), 16777619) >>> 0;
      h2 = Math.imul((h2 + c), 2654435769) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  function contentId(content) {
    return "blake3:" + _stubHash(canonical(content));
  }

  // Sign: in real impl, sidecar holds the Ed25519 private key.
  // Here we simulate by hashing content + signer pubkey to a fixed-length tag.
  function sign(content, signer) {
    if (!signer || !signer.pubkey) throw new Error("signer.pubkey required");
    const tag = _stubHash(canonical(content) + "|" + signer.pubkey);
    return "ed25519:" + tag;
  }

  // Build a manifest from inputs, returns the full envelope.
  function makeManifest(opts) {
    if (!opts || !opts.kind || !opts.content) {
      throw new Error("kind + content required");
    }
    const signer = opts.signer || { pubkey: "ed25519:anonymous" };
    const id = contentId(opts.content);
    const baseForSig = {
      schema: SCHEMA,
      id,
      kind: opts.kind,
      version: opts.version || "0.1.0",
      deps: opts.deps || [],
      content: opts.content,
      signerPub: signer.pubkey,
    };
    const signature = sign(baseForSig, signer);
    return {
      $schema: SCHEMA,
      id,
      kind: opts.kind,
      version: opts.version || "0.1.0",
      deps: opts.deps || [],
      content: opts.content,
      signer,
      signature,
    };
  }

  // Verify the signature + content hash. Returns { ok, reason? }.
  function verify(manifest) {
    if (!manifest || manifest.$schema !== SCHEMA) return { ok: false, reason: "bad_schema" };
    if (!manifest.id || !manifest.signature || !manifest.signer) return { ok: false, reason: "incomplete" };
    if (manifest.id !== contentId(manifest.content)) return { ok: false, reason: "content_mismatch" };
    const baseForSig = {
      schema: SCHEMA,
      id: manifest.id,
      kind: manifest.kind,
      version: manifest.version,
      deps: manifest.deps,
      content: manifest.content,
      signerPub: manifest.signer.pubkey,
    };
    const expected = sign(baseForSig, manifest.signer);
    if (expected !== manifest.signature) return { ok: false, reason: "bad_signature" };
    return { ok: true };
  }

  // Resolve dep graph: returns ordered list of dep ids in topological order.
  // store: { has(id), get(id) → manifest }
  function resolveDeps(rootManifest, store) {
    const seen = new Set();
    const order = [];
    function walk(m) {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      for (const depId of (m.deps || [])) {
        if (store && store.has(depId)) walk(store.get(depId));
      }
      order.push(m.id);
    }
    walk(rootManifest);
    return order;
  }

  // Simple in-memory store
  function createStore() {
    const map = new Map();
    return {
      put(manifest) {
        const v = verify(manifest);
        if (!v.ok) return v;
        map.set(manifest.id, manifest);
        return { ok: true };
      },
      get(id) { return map.get(id) || null; },
      has(id) { return map.has(id); },
      list() { return Array.from(map.keys()); },
      size() { return map.size; },
    };
  }

  return { SCHEMA, canonical, contentId, sign, makeManifest, verify, resolveDeps, createStore };
});
