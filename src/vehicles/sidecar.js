// sidecar.js — capability-checked I/O facade per
// DWRLD_META_RUNTIME_SHARED_OS_LAYER.md.
//
// The engine never touches disk/peers/AI directly — all I/O routes through
// this sidecar. Capabilities are explicit grants ("storage:read",
// "pubsub:publish:room/*"). No ambient access.
//
// Real impl: WIT/HTTP to a separate process. Today: in-process stub
// suitable for browser + tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTASidecar = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createSidecar(opts) {
    opts = opts || {};
    const storage  = new Map();         // key → bytes/string
    const subscribers = new Map();      // topic → Set<callback>
    const grants = new Map();           // tokenId → {capabilities:Set<string>}
    const log = [];                     // call audit trail

    function _audit(call, payload, capUsed, ok) {
      log.push({ call, payload, capUsed, ok, t: Date.now() });
      if (log.length > 1000) log.shift();
    }

    // Capability matching — supports trailing "*" wildcard at any segment.
    function _capMatches(grantCap, requested) {
      if (grantCap === requested) return true;
      if (!grantCap.endsWith("*")) return false;
      const prefix = grantCap.slice(0, -1);
      return requested.startsWith(prefix);
    }
    function _check(token, requested) {
      if (!token) return false;
      const g = grants.get(token);
      if (!g) return false;
      for (const cap of g.capabilities) {
        if (_capMatches(cap, requested)) return true;
      }
      return false;
    }

    // ---- Capability management ----
    function grant(capabilities) {
      const tok = "tok_" + Math.random().toString(36).slice(2, 10);
      grants.set(tok, { capabilities: new Set(capabilities) });
      return tok;
    }
    function revoke(token) { grants.delete(token); }
    function capsOf(token) {
      const g = grants.get(token);
      return g ? Array.from(g.capabilities) : [];
    }

    // ---- Storage API ----
    function storageRead(token, key) {
      const cap = `storage:read:${key}`;
      const ok = _check(token, cap) || _check(token, "storage:read");
      _audit("storage.read", { key }, cap, ok);
      if (!ok) return { ok: false, reason: "denied" };
      return { ok: true, value: storage.has(key) ? storage.get(key) : null };
    }
    function storageWrite(token, key, value) {
      const cap = `storage:write:${key}`;
      const ok = _check(token, cap) || _check(token, "storage:write");
      _audit("storage.write", { key }, cap, ok);
      if (!ok) return { ok: false, reason: "denied" };
      storage.set(key, value);
      return { ok: true };
    }
    function storageList(token, prefix) {
      const ok = _check(token, "storage:list");
      _audit("storage.list", { prefix }, "storage:list", ok);
      if (!ok) return { ok: false, reason: "denied" };
      const out = [];
      for (const k of storage.keys()) if (!prefix || k.startsWith(prefix)) out.push(k);
      return { ok: true, keys: out };
    }
    function storageDelete(token, key) {
      const cap = `storage:write:${key}`;
      const ok = _check(token, cap) || _check(token, "storage:write");
      _audit("storage.delete", { key }, cap, ok);
      if (!ok) return { ok: false, reason: "denied" };
      const had = storage.delete(key);
      return { ok: true, deleted: had };
    }

    // ---- PubSub API ----
    function pubsubSubscribe(token, topic, cb) {
      const cap = `pubsub:subscribe:${topic}`;
      const ok = _check(token, cap) || _check(token, "pubsub:subscribe");
      _audit("pubsub.subscribe", { topic }, cap, ok);
      if (!ok) return { ok: false, reason: "denied" };
      if (!subscribers.has(topic)) subscribers.set(topic, new Set());
      subscribers.get(topic).add(cb);
      return { ok: true, unsubscribe: () => subscribers.get(topic).delete(cb) };
    }
    function pubsubPublish(token, topic, message) {
      const cap = `pubsub:publish:${topic}`;
      const ok = _check(token, cap) || _check(token, "pubsub:publish");
      _audit("pubsub.publish", { topic }, cap, ok);
      if (!ok) return { ok: false, reason: "denied" };
      const subs = subscribers.get(topic);
      let n = 0;
      if (subs) for (const cb of subs) { try { cb(message); n++; } catch (e) {} }
      return { ok: true, delivered: n };
    }

    // ---- Identity API (stub — full identity in identity.js) ----
    function identityWho(token) {
      const ok = _check(token, "identity:who");
      _audit("identity.who", {}, "identity:who", ok);
      if (!ok) return { ok: false, reason: "denied" };
      return { ok: true, handle: opts.handle || "anon", pubkey: opts.pubkey || "ed25519:anon" };
    }

    // ---- Audit ----
    function recentLog(n) { return log.slice(-(n || 50)); }

    return {
      grant, revoke, capsOf,
      storageRead, storageWrite, storageList, storageDelete,
      pubsubSubscribe, pubsubPublish,
      identityWho,
      recentLog,
      _capMatches,
    };
  }

  return { createSidecar };
});
