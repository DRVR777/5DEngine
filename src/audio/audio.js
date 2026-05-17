// audio.js — sidecar-mediated audio routing.
// Engine never touches Web Audio directly — it dispatches play/stop events
// through this module, which routes to a sidecar capability ("audio:play")
// OR to an injected adapter for testing.
//
// Routes: sfx, music, voice, ambient. Each has its own mixer slot and a
// volume that multiplies with masterVolume.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAudio = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ROUTES = ["sfx", "music", "voice", "ambient"];

  function createMixer(opts) {
    opts = opts || {};
    const volumes = {
      master: opts.master != null ? opts.master : 0.8,
      sfx:    opts.sfx    != null ? opts.sfx    : 1.0,
      music:  opts.music  != null ? opts.music  : 0.6,
      voice:  opts.voice  != null ? opts.voice  : 1.0,
      ambient:opts.ambient!= null ? opts.ambient: 0.4,
    };
    const active = new Map();   // handle → { route, src, startedAt, loop, position?, listeners }
    let nextHandle = 1;
    const adapter = opts.adapter || null;    // optional: {play, stop, setVolume}
    const eventListeners = { play: [], stop: [], finish: [] };

    function _emit(event, payload) {
      const fns = eventListeners[event] || [];
      for (const fn of fns) try { fn(payload); } catch (e) {}
    }

    function effectiveVolume(route, baseVol) {
      const r = volumes[route] != null ? volumes[route] : 1.0;
      const m = volumes.master;
      const b = baseVol != null ? baseVol : 1.0;
      return Math.max(0, Math.min(1, b * r * m));
    }

    function setVolume(route, value) {
      if (!(route in volumes)) return false;
      volumes[route] = Math.max(0, Math.min(1, value));
      // Re-push to adapter for any active sounds on that route
      if (adapter && adapter.setVolume) {
        for (const [h, s] of active) {
          if (s.route === route || route === "master") {
            adapter.setVolume(h, effectiveVolume(s.route, s.baseVolume));
          }
        }
      }
      return true;
    }

    // Play a sound. Returns a handle (number) for stop/adjust.
    function play(spec) {
      if (!spec || !spec.src) return { ok: false, reason: "missing_src" };
      const route = spec.route || "sfx";
      if (!ROUTES.includes(route)) return { ok: false, reason: `bad_route:${route}` };
      const handle = nextHandle++;
      const baseVolume = spec.volume != null ? spec.volume : 1.0;
      const entry = {
        route, src: spec.src,
        startedAt: Date.now(),
        loop: !!spec.loop,
        position: spec.position || null,
        baseVolume,
      };
      active.set(handle, entry);
      const v = effectiveVolume(route, baseVolume);
      if (adapter && adapter.play) {
        try { adapter.play(handle, spec.src, v, !!spec.loop, spec.position); }
        catch (e) { /* swallow */ }
      }
      _emit("play", { handle, route, src: spec.src, volume: v });
      return { ok: true, handle, volume: v };
    }

    function stop(handle) {
      const entry = active.get(handle);
      if (!entry) return false;
      active.delete(handle);
      if (adapter && adapter.stop) { try { adapter.stop(handle); } catch (e) {} }
      _emit("stop", { handle, route: entry.route, src: entry.src });
      return true;
    }

    function stopAll(route) {
      const toStop = [];
      for (const [h, e] of active) {
        if (!route || e.route === route) toStop.push(h);
      }
      for (const h of toStop) stop(h);
      return toStop.length;
    }

    function activeCount(route) {
      let n = 0;
      for (const [, e] of active) if (!route || e.route === route) n++;
      return n;
    }

    function on(event, fn) {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(fn);
    }
    function off(event, fn) {
      if (eventListeners[event]) {
        eventListeners[event] = eventListeners[event].filter(f => f !== fn);
      }
    }

    // 3D spatialization helper: attenuate by distance from listener.
    function spatialVolume(soundPos, listenerPos, falloff) {
      if (!soundPos || !listenerPos) return 1.0;
      const d = Math.hypot(soundPos.u - listenerPos.u, soundPos.v - listenerPos.v);
      const f = falloff != null ? falloff : 20;
      return Math.max(0, 1 - d / f);
    }

    return {
      ROUTES, volumes, active,
      play, stop, stopAll, activeCount,
      setVolume, effectiveVolume,
      on, off, spatialVolume,
    };
  }

  return { createMixer, ROUTES };
});
