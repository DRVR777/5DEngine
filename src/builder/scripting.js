// scripting.js — per-object tick scripts for world-builder objects.
// Each scene object can carry a script string in its meta.script field.
// The engine calls ScriptRunner.tick(uuid, mesh, meta, dt, env) every frame.
// Script format: plain JS that runs as the body of a function whose
// parameters are: { mesh, scene, world, dt, time, state, CFG }.
//
// Examples:
//   mesh.rotation.y += dt * 1.5;            // spin
//   mesh.position.y = 1 + Math.sin(time * 2) * 0.4;  // hover
//   if (state.t == null) state.t = 0;
//   state.t += dt;
//   mesh.material.color.setHSL(state.t % 1, 1, 0.5); // color cycle
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScriptRunner = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const _cache   = new Map();   // uuid → { code, fn, state, started }
  const _errors  = new Map();   // uuid → last error string

  function _compile(code) {
    try {
      // Wrap in function accepting env spread as named params
      return new Function("mesh","scene","world","dt","time","state","CFG", code);
    } catch (e) {
      return null;
    }
  }

  function tick(uuid, mesh, meta, dt, env) {
    const code = (meta && meta.script) || "";
    if (!code.trim()) return;

    let entry = _cache.get(uuid);
    if (!entry || entry.code !== code) {
      entry = { code, fn: _compile(code), state: {}, started: false };
      _cache.set(uuid, entry);
      _errors.delete(uuid);
    }
    if (!entry.fn) return;

    try {
      entry.fn(
        mesh,
        env.scene,
        env.world,
        dt,
        performance.now() / 1000,
        entry.state,
        env.CFG || {}
      );
    } catch (e) {
      const msg = String(e);
      if (_errors.get(uuid) !== msg) {
        console.warn("[Script " + uuid + "]", msg);
        _errors.set(uuid, msg);
      }
    }
  }

  function clearCache(uuid) {
    _cache.delete(uuid);
    _errors.delete(uuid);
  }

  function getError(uuid) {
    return _errors.get(uuid) || null;
  }

  return { tick, clearCache, getError };
});
