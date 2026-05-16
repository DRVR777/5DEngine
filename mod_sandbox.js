// mod_sandbox.js — sandboxed mod execution with signed manifests +
// capability allowlist. Complements mod_loader.js (iter 36): that
// one applies static manifest content to engine registries; THIS one
// runs mod *code* inside an isolated vm context with explicitly
// granted host APIs.
//
// A mod package: {manifest, source}.
//   manifest = { id, version, author, capabilities[], signature }
//   source   = JS string, evaluated as a CommonJS module
//
// The signature is computed via signManifest(manifest_without_sig, source).
// Loaders may swap verifyFn at construction (e.g. real Ed25519 in prod).
//
// Capabilities are stable identifiers like "ui.toast", "world.spawn",
// "economy.deposit". Host registers caps + implementations; the
// allowlist gates which the loader will pass through to a mod.
//
// Returns an installed handle {id, exports, callHook(name, ...args)}.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAModSandbox = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function _fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  function _stripSig(m) {
    const x = Object.assign({}, m);
    delete x.signature;
    return x;
  }

  function signManifest(manifest, source) {
    return _fnv1a(JSON.stringify(_stripSig(manifest)) + source);
  }

  function defaultVerify(manifest, source) {
    if (!manifest || !manifest.signature) return false;
    return manifest.signature === signManifest(manifest, source);
  }

  function createLoader(opts) {
    opts = opts || {};
    const config = Object.assign({
      verifyFn: defaultVerify,
      maxModBytes: 1 << 20,         // 1 MiB
    }, opts.config || {});
    const allowed = new Set(opts.allowedCapabilities || []);
    const capImpls = new Map();   // name → fn
    const installed = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerCapability(name, fn) {
      if (typeof name !== "string" || !name) throw new Error("name required");
      if (typeof fn !== "function") throw new Error("fn required");
      capImpls.set(name, fn);
      return { ok: true };
    }
    function unregisterCapability(name) { capImpls.delete(name); }

    function allowCapability(name) { allowed.add(name); return { ok: true }; }
    function disallowCapability(name) { allowed.delete(name); }

    function _evalInSandbox(source, granted) {
      try {
        const vm = require("vm");
        const sandbox = Object.assign({
          module: { exports: {} },
          console: { log: () => {}, warn: () => {}, error: () => {} },
        }, granted);
        sandbox.global = sandbox;
        sandbox.exports = sandbox.module.exports;
        vm.createContext(sandbox);
        const wrapped = "(function(){ " + source + "\n; return module.exports; })()";
        const result = vm.runInContext(wrapped, sandbox, { timeout: 1000, displayErrors: true });
        return result || sandbox.module.exports || {};
      } catch (eVm) {
        // Browser fallback via Function constructor
        const argNames = Object.keys(granted);
        const argVals = argNames.map(n => granted[n]);
        const body =
          "var module={exports:{}}; var exports=module.exports;\n" +
          source +
          "\nreturn module.exports;";
        const fn = new Function(...argNames, body);
        return fn(...argVals);
      }
    }

    function load(modPkg) {
      if (!modPkg || !modPkg.manifest || typeof modPkg.source !== "string") {
        return { ok: false, reason: "bad_package" };
      }
      const m = modPkg.manifest;
      if (!m.id) return { ok: false, reason: "missing_id" };
      if (installed.has(m.id)) return { ok: false, reason: "already_loaded" };
      if (modPkg.source.length > config.maxModBytes) {
        return { ok: false, reason: "too_large" };
      }
      // 1. Verify signature
      if (!config.verifyFn(m, modPkg.source)) {
        _log("verify_fail", { id: m.id });
        return { ok: false, reason: "bad_signature" };
      }
      // 2. Capability gate
      const caps = Array.isArray(m.capabilities) ? m.capabilities : [];
      const granted = {};
      for (const c of caps) {
        if (!allowed.has(c)) {
          _log("capability_denied", { id: m.id, cap: c });
          return { ok: false, reason: "capability_denied", capability: c };
        }
        const impl = capImpls.get(c);
        if (!impl) {
          _log("capability_missing", { id: m.id, cap: c });
          return { ok: false, reason: "capability_missing", capability: c };
        }
        // Namespace: "ui.toast" → granted.ui = { toast: fn }
        const [ns, fnName] = c.includes(".") ? c.split(".", 2) : [c, null];
        if (fnName) {
          if (!granted[ns]) granted[ns] = {};
          granted[ns][fnName] = impl;
        } else {
          granted[ns] = impl;
        }
      }
      // 3. Eval
      let exports;
      try {
        exports = _evalInSandbox(modPkg.source, granted);
      } catch (e) {
        _log("eval_error", { id: m.id, message: e.message });
        return { ok: false, reason: "eval_error", message: e.message };
      }
      const handle = {
        id: m.id,
        version: m.version || "0.0.0",
        author: m.author || "unknown",
        capabilities: caps.slice(),
        exports,
        loadedAt: Date.now(),
        callHook(name) {
          const args = Array.prototype.slice.call(arguments, 1);
          const fn = exports && exports[name];
          if (typeof fn !== "function") return { ok: false, reason: "no_hook" };
          try { return { ok: true, value: fn.apply(null, args) }; }
          catch (e) { return { ok: false, reason: "hook_threw", message: e.message }; }
        },
      };
      installed.set(m.id, handle);
      _log("load", { id: m.id, version: handle.version, caps: caps.length });
      return { ok: true, handle };
    }

    function unload(id) {
      const h = installed.get(id);
      if (!h) return { ok: false, reason: "not_loaded" };
      if (h.exports && typeof h.exports.onUnload === "function") {
        try { h.exports.onUnload(); } catch (e) {}
      }
      installed.delete(id);
      _log("unload", { id });
      return { ok: true };
    }

    function get(id) { return installed.get(id) || null; }
    function listInstalled() { return Array.from(installed.values()); }
    function listAllowedCapabilities() { return Array.from(allowed); }
    function listRegisteredCapabilities() { return Array.from(capImpls.keys()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      registerCapability, unregisterCapability,
      allowCapability, disallowCapability,
      load, unload, get,
      listInstalled, listAllowedCapabilities, listRegisteredCapabilities,
      recentEvents,
    };
  }

  return {
    signManifest,
    defaultVerify,
    createLoader,
  };
});
