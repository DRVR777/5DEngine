// spectator_director.js — auto-pick the most interesting camera angle.
// Subscribers register "cameras" each with a current focus target +
// activity score (kills/sec, damage taken, proximity to action).
// The director ticks periodically and picks the highest-score camera,
// applying a smooth transition (so cuts don't flash) + a minimum hold
// time so we don't strobe between two cameras.
//
// Activity scoring is caller-supplied per camera: scoreFn(camera, ctx)
// → number. Higher = more interesting.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTASpectatorDirector = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TRANSITIONS = ["cut", "fade", "slide", "ease"];

  function _ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _lerpVec(a, b, t) {
    return {
      u: _lerp(a.u || 0, b.u || 0, t),
      v: _lerp(a.v || 0, b.v || 0, t),
      y: _lerp(a.y || 0, b.y || 0, t),
    };
  }

  function createDirector(opts) {
    opts = opts || {};
    const config = Object.assign({
      minHoldMs: 2500,
      transition: "ease",      // ease / cut / fade / slide
      transitionMs: 800,
      hysteresis: 0.15,        // new cam must score 15% higher to switch
      scoreFn: null,           // optional global default
    }, opts.config || {});

    const cameras = new Map();       // camId → {id, pos, target, scoreFn}
    let activeCamId = null;
    let activeSince = 0;
    let transition = null;          // {from, to, startMs, endMs}
    const events = [];
    const history = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerCamera(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (cameras.has(opts2.id)) return { ok: false, reason: "duplicate" };
      cameras.set(opts2.id, {
        id: opts2.id,
        pos: opts2.pos || { u: 0, v: 0, y: 0 },
        target: opts2.target || { u: 0, v: 0, y: 0 },
        scoreFn: opts2.scoreFn || config.scoreFn || (() => 0),
        meta: Object.assign({}, opts2.meta || {}),
      });
      _log("register", { id: opts2.id });
      if (activeCamId == null) {
        activeCamId = opts2.id;
        activeSince = Date.now();
        _log("initial", { id: opts2.id });
      }
      return { ok: true };
    }
    function unregisterCamera(id) {
      if (!cameras.has(id)) return { ok: false };
      cameras.delete(id);
      if (activeCamId === id) {
        activeCamId = cameras.keys().next().value || null;
        activeSince = Date.now();
      }
      return { ok: true };
    }

    function updateCamera(id, patch) {
      const c = cameras.get(id);
      if (!c) return { ok: false };
      if (patch.pos) c.pos = patch.pos;
      if (patch.target) c.target = patch.target;
      if (patch.scoreFn) c.scoreFn = patch.scoreFn;
      if (patch.meta) Object.assign(c.meta, patch.meta);
      return { ok: true };
    }

    function activeCamera() { return cameras.get(activeCamId) || null; }

    function focusOn(id, opts2) {
      opts2 = opts2 || {};
      const c = cameras.get(id);
      if (!c) return { ok: false };
      if (id !== activeCamId) {
        _startTransition(activeCamId, id, opts2.transitionMs || config.transitionMs);
        activeCamId = id;
        activeSince = Date.now();
        history.push({ id, ts: Date.now() });
        _log("manual_focus", { id });
      }
      return { ok: true };
    }

    function _startTransition(fromId, toId, durationMs, nowOverride) {
      const from = cameras.get(fromId);
      const to = cameras.get(toId);
      if (!from || !to) { transition = null; return; }
      const now = nowOverride != null ? nowOverride : Date.now();
      transition = {
        from: { pos: Object.assign({}, from.pos), target: Object.assign({}, from.target) },
        to:   { pos: Object.assign({}, to.pos),   target: Object.assign({}, to.target) },
        startMs: now, endMs: now + durationMs,
        style: config.transition,
      };
    }

    // Tick — evaluates scores, switches if needed (respecting minHold + hysteresis).
    // Returns the resolved {camId, pos, target, transitioning, t (0..1)} for renderer.
    function tick(ctx) {
      ctx = ctx || {};
      const now = ctx.now != null ? ctx.now : Date.now();
      // Auto-correct clock mismatch when caller uses a different time source
      if (activeSince > now) activeSince = now;

      // Evaluate scores
      let best = null, bestScore = -Infinity;
      const scores = {};
      for (const cam of cameras.values()) {
        let s;
        try { s = cam.scoreFn(cam, ctx) || 0; }
        catch (e) { s = 0; }
        scores[cam.id] = s;
        if (s > bestScore) { bestScore = s; best = cam; }
      }

      // Switch decision
      if (best && best.id !== activeCamId) {
        const currentScore = scores[activeCamId] || 0;
        const elapsed = now - activeSince;
        if (elapsed >= config.minHoldMs &&
            bestScore > currentScore * (1 + config.hysteresis)) {
          _startTransition(activeCamId, best.id, config.transitionMs, now);
          activeCamId = best.id;
          activeSince = now;
          history.push({ id: best.id, ts: now, score: bestScore });
          _log("auto_switch", { id: best.id, score: bestScore });
        }
      }

      // Resolve current camera state with transition
      const active = cameras.get(activeCamId);
      if (!active) return null;

      if (transition && now < transition.endMs) {
        const t = (now - transition.startMs) / (transition.endMs - transition.startMs);
        const eased = config.transition === "ease" ? _ease(t) : t;
        return {
          camId: activeCamId,
          pos: _lerpVec(transition.from.pos, transition.to.pos, eased),
          target: _lerpVec(transition.from.target, transition.to.target, eased),
          transitioning: true,
          t,
          style: transition.style,
        };
      }
      if (transition && now >= transition.endMs) transition = null;
      return {
        camId: activeCamId,
        pos: Object.assign({}, active.pos),
        target: Object.assign({}, active.target),
        transitioning: false,
        t: 1,
      };
    }

    function listCameras() { return Array.from(cameras.values()); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getHistory(n) { return history.slice(-(n || 20)); }
    function setTransition(style) {
      if (!TRANSITIONS.includes(style)) return { ok: false };
      config.transition = style;
      return { ok: true };
    }
    function setMinHold(ms) {
      if (typeof ms !== "number" || ms < 0) return { ok: false };
      config.minHoldMs = ms;
      return { ok: true };
    }

    return {
      TRANSITIONS,
      registerCamera, unregisterCamera, updateCamera,
      focusOn, tick, activeCamera,
      listCameras, getHistory, recentEvents,
      setTransition, setMinHold,
    };
  }

  return { TRANSITIONS, createDirector };
});
