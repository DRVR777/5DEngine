// cinematics.js — timeline-driven cutscenes.
// A cutscene is a sequence of `tracks`, each track is a sequence of
// `keyframes` over time. The Director plays a cutscene, interpolates
// keyframe values per track per tick, fires events at marker timestamps,
// and (optionally) hands camera authority back to the player on end.
//
// Track kinds:
//   "camera"    — position + lookAt over time
//   "subtitle"  — text shown at a timestamp for a duration
//   "audio"     — sound cue at a timestamp
//   "marker"    — fires a named event at a timestamp
//   "entity"    — moves an entity along a position track
//
// Easing: "linear", "easeIn", "easeOut", "easeInOut", "step"
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACinematics = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EASING = {
    linear:    (t) => t,
    easeIn:    (t) => t * t,
    easeOut:   (t) => 1 - (1 - t) * (1 - t),
    easeInOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    step:      (t) => t < 1 ? 0 : 1,
  };

  function _lerp(a, b, t) { return a + (b - a) * t; }
  function _lerpVec(a, b, t) {
    return { u: _lerp(a.u, b.u, t), v: _lerp(a.v, b.v, t), y: _lerp(a.y || 0, b.y || 0, t) };
  }

  function createCutscene(spec) {
    spec = spec || {};
    if (!spec.id) throw new Error("cutscene needs id");
    if (!Array.isArray(spec.tracks)) throw new Error("cutscene needs tracks[]");
    // Validate keyframes are sorted ascending by t
    for (const tr of spec.tracks) {
      if (!Array.isArray(tr.keys)) throw new Error("track needs keys[]");
      for (let i = 1; i < tr.keys.length; i++) {
        if (tr.keys[i].t < tr.keys[i - 1].t) {
          throw new Error("track " + tr.kind + " keyframes not in ascending t");
        }
      }
    }
    return {
      id: spec.id,
      duration: spec.duration || _inferDuration(spec.tracks),
      tracks: spec.tracks.slice(),
      meta: spec.meta || {},
    };
  }

  function _inferDuration(tracks) {
    let max = 0;
    for (const tr of tracks) {
      for (const k of tr.keys) if (k.t > max) max = k.t;
      if (tr.kind === "subtitle") {
        for (const k of tr.keys) if (k.t + (k.duration || 0) > max) max = k.t + (k.duration || 0);
      }
    }
    return max;
  }

  // Evaluate a track at time t → either an interpolated value or null
  // if the track has nothing relevant at that time.
  function _evalTrack(track, t) {
    const keys = track.keys;
    if (keys.length === 0) return null;
    if (t <= keys[0].t) {
      if (track.kind === "marker" || track.kind === "audio") return null;
      return keys[0].value;
    }
    if (t >= keys[keys.length - 1].t) {
      if (track.kind === "marker" || track.kind === "audio") return null;
      return keys[keys.length - 1].value;
    }
    // Find segment
    for (let i = 0; i < keys.length - 1; i++) {
      const k0 = keys[i], k1 = keys[i + 1];
      if (t >= k0.t && t < k1.t) {
        const span = k1.t - k0.t;
        const easing = EASING[k0.easing || track.easing || "linear"];
        const raw = span > 0 ? (t - k0.t) / span : 0;
        const eased = easing(raw);
        if (track.kind === "camera") {
          return {
            pos:    _lerpVec(k0.value.pos, k1.value.pos, eased),
            lookAt: _lerpVec(k0.value.lookAt, k1.value.lookAt, eased),
          };
        }
        if (track.kind === "entity") {
          return _lerpVec(k0.value, k1.value, eased);
        }
        if (typeof k0.value === "number" && typeof k1.value === "number") {
          return _lerp(k0.value, k1.value, eased);
        }
        // step / non-interpolable
        return k0.value;
      }
    }
    return keys[keys.length - 1].value;
  }

  // The Director plays cutscenes. tick(dt) advances time and emits
  // events {kind, ...} for the consumer to process.
  function createDirector(opts) {
    opts = opts || {};
    let active = null;          // {cutscene, t, fired:Set, paused, onEnd, returnCamTo}
    const eventLog = [];

    function _log(ev) { eventLog.push(Object.assign({ ts: Date.now() }, ev)); }

    function play(cutscene, playOpts) {
      playOpts = playOpts || {};
      if (active && !playOpts.force) return { ok: false, reason: "already_playing" };
      active = {
        cutscene, t: 0,
        fired: new Set(),
        paused: false,
        onEnd: playOpts.onEnd || null,
        returnCamTo: playOpts.returnCamTo || null,
        speed: playOpts.speed || 1,
      };
      _log({ kind: "play", cutsceneId: cutscene.id });
      return { ok: true };
    }

    function tick(dt) {
      if (!active || active.paused) return [];
      active.t += dt * active.speed;
      const events = [];
      const { cutscene, t } = active;

      for (let i = 0; i < cutscene.tracks.length; i++) {
        const tr = cutscene.tracks[i];
        if (tr.kind === "marker" || tr.kind === "audio" || tr.kind === "subtitle") {
          for (let k = 0; k < tr.keys.length; k++) {
            const kf = tr.keys[k];
            const fireKey = i + ":" + k;
            if (t >= kf.t && !active.fired.has(fireKey)) {
              active.fired.add(fireKey);
              const ev = { kind: tr.kind, trackIdx: i, keyIdx: k };
              if (tr.kind === "marker") ev.name = kf.name || kf.value;
              if (tr.kind === "audio")  { ev.cue = kf.cue || kf.value; ev.volume = kf.volume; }
              if (tr.kind === "subtitle") {
                ev.text = kf.text || kf.value;
                ev.duration = kf.duration || 3;
                ev.expiresAt = active.t + ev.duration;
              }
              events.push(ev);
            }
          }
        } else {
          const value = _evalTrack(tr, t);
          if (value != null) {
            events.push({ kind: tr.kind + "_update", trackIdx: i, value, targetId: tr.targetId });
          }
        }
      }

      if (t >= cutscene.duration) {
        const onEnd = active.onEnd;
        const returnCamTo = active.returnCamTo;
        _log({ kind: "end", cutsceneId: cutscene.id });
        events.push({ kind: "end", cutsceneId: cutscene.id, returnCamTo });
        active = null;
        if (onEnd) try { onEnd(); } catch (e) {}
      }

      return events;
    }

    function stop() {
      if (!active) return { ok: false };
      _log({ kind: "stop", cutsceneId: active.cutscene.id, atT: active.t });
      const returnCamTo = active.returnCamTo;
      active = null;
      return { ok: true, returnCamTo };
    }

    function pause() {
      if (!active) return { ok: false };
      active.paused = true;
      return { ok: true };
    }
    function resume() {
      if (!active) return { ok: false };
      active.paused = false;
      return { ok: true };
    }
    function isPlaying() { return active != null; }
    function currentT() { return active ? active.t : 0; }
    function currentCutscene() { return active ? active.cutscene.id : null; }
    function recentEvents(n) { return eventLog.slice(-(n || 20)); }

    return {
      play, stop, pause, resume, tick,
      isPlaying, currentT, currentCutscene, recentEvents,
      _evalTrack,
    };
  }

  // Scrub a cutscene to time t and return the state of every continuous
  // track (camera, entity, scalar). Useful for previews + editor.
  function evaluateAt(cutscene, t) {
    const state = { t, tracks: [] };
    for (let i = 0; i < cutscene.tracks.length; i++) {
      const tr = cutscene.tracks[i];
      if (tr.kind === "marker" || tr.kind === "audio" || tr.kind === "subtitle") continue;
      state.tracks.push({
        idx: i, kind: tr.kind, targetId: tr.targetId,
        value: _evalTrack(tr, t),
      });
    }
    return state;
  }

  return {
    EASING,
    createCutscene,
    createDirector,
    evaluateAt,
  };
});
