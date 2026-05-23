// accessibility.js — colorblind sims, subtitle queue, UI scale, motion
// reduction, high-contrast. A single AccessibilityState that the rest
// of the engine reads to adapt rendering, captions, and motion intensity.
//
// Colorblind transforms approximate three forms of color blindness by
// projecting RGB into a confusion-line subspace (standard Brettel/Mollon
// matrices, simplified for performance).
//
// Subtitles: queue of {id, text, speaker, duration, ts}. expireSubtitles
// trims expired entries. activeSubtitles returns currently visible ones
// sorted by ts.
//
// uiScale: 0.5..2.0. The renderer multiplies font sizes / panel sizes
// by this. motionScale: 0..1 for camera shake, parallax, etc.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAccessibility = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 3x3 matrices for daltonized RGB projections (Brettel-style simplifications)
  // Each entry: out_channel = sum_i (matrix[ch][i] * rgb[i])
  const COLORBLIND_MATRICES = {
    none:        [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    protanopia:  [[0.567, 0.433, 0    ], [0.558, 0.442, 0    ], [0,     0.242, 0.758]],
    deuteranopia:[[0.625, 0.375, 0    ], [0.700, 0.300, 0    ], [0,     0.300, 0.700]],
    tritanopia:  [[0.95,  0.05,  0    ], [0,     0.433, 0.567], [0,     0.475, 0.525]],
    achromatopsia:[[0.299,0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]],
  };
  const COLORBLIND_MODES = Object.keys(COLORBLIND_MATRICES);

  function _clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function applyColorblind(rgba, mode) {
    const M = COLORBLIND_MATRICES[mode];
    if (!M) throw new Error("unknown colorblind mode: " + mode);
    if (mode === "none") return rgba;
    for (let i = 0; i < rgba.length; i += 4) {
      const r = rgba[i], g = rgba[i+1], b = rgba[i+2];
      rgba[i]   = _clamp((M[0][0]*r + M[0][1]*g + M[0][2]*b) | 0, 0, 255);
      rgba[i+1] = _clamp((M[1][0]*r + M[1][1]*g + M[1][2]*b) | 0, 0, 255);
      rgba[i+2] = _clamp((M[2][0]*r + M[2][1]*g + M[2][2]*b) | 0, 0, 255);
    }
    return rgba;
  }

  function createState(opts) {
    opts = opts || {};
    const state = {
      colorblindMode: opts.colorblindMode || "none",
      uiScale: opts.uiScale != null ? opts.uiScale : 1.0,
      motionScale: opts.motionScale != null ? opts.motionScale : 1.0,
      highContrast: opts.highContrast || false,
      subtitlesEnabled: opts.subtitlesEnabled !== false,
      subtitleSize: opts.subtitleSize || 1.0,
      reduceFlashes: opts.reduceFlashes || false,
    };
    const subtitles = [];
    let nextSubId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }

    function setColorblindMode(m) {
      if (!COLORBLIND_MODES.includes(m)) return { ok: false, reason: "unknown_mode" };
      state.colorblindMode = m;
      _log("colorblind", { mode: m });
      return { ok: true };
    }

    function setUIScale(s) {
      if (typeof s !== "number" || s < 0.5 || s > 2.0) {
        return { ok: false, reason: "out_of_range" };
      }
      state.uiScale = s;
      _log("uiScale", { scale: s });
      return { ok: true };
    }

    function setMotionScale(s) {
      if (typeof s !== "number" || s < 0 || s > 1) {
        return { ok: false, reason: "out_of_range" };
      }
      state.motionScale = s;
      _log("motionScale", { scale: s });
      return { ok: true };
    }

    function setHighContrast(b) {
      state.highContrast = !!b;
      return { ok: true };
    }

    function setReduceFlashes(b) {
      state.reduceFlashes = !!b;
      return { ok: true };
    }

    function setSubtitlesEnabled(b) {
      state.subtitlesEnabled = !!b;
      if (!b) subtitles.length = 0;
      return { ok: true };
    }

    function setSubtitleSize(s) {
      if (typeof s !== "number" || s < 0.5 || s > 3.0) {
        return { ok: false, reason: "out_of_range" };
      }
      state.subtitleSize = s;
      return { ok: true };
    }

    // pushSubtitle({text, speaker?, duration?, kind?}) → {ok, id}
    function pushSubtitle(opts2) {
      if (!state.subtitlesEnabled) return { ok: false, reason: "disabled" };
      opts2 = opts2 || {};
      if (!opts2.text) return { ok: false, reason: "missing_text" };
      const id = "sub_" + nextSubId++;
      const sub = {
        id, text: opts2.text,
        speaker: opts2.speaker || null,
        kind: opts2.kind || "dialogue",   // dialogue / sfx / narration / system
        duration: opts2.duration || 3.5,
        ts: opts2.ts != null ? opts2.ts : Date.now(),
      };
      subtitles.push(sub);
      _log("subtitle", { id, text: sub.text });
      return { ok: true, id, subtitle: sub };
    }

    // Drop expired subs given a "now" wall-clock time.
    function expireSubtitles(now) {
      now = now != null ? now : Date.now();
      const before = subtitles.length;
      for (let i = subtitles.length - 1; i >= 0; i--) {
        if (now - subtitles[i].ts > subtitles[i].duration * 1000) {
          subtitles.splice(i, 1);
        }
      }
      return before - subtitles.length;
    }

    function activeSubtitles(now) {
      now = now != null ? now : Date.now();
      return subtitles
        .filter(s => now >= s.ts && now - s.ts <= s.duration * 1000)
        .sort((a, b) => a.ts - b.ts);
    }

    function clearSubtitles() {
      subtitles.length = 0;
      _log("clearSubtitles", {});
    }

    function getState() { return Object.assign({}, state); }

    // Helpers for the renderer to use
    function fontSize(base) { return (base || 14) * state.uiScale; }
    function panelSize(base) { return (base || 200) * state.uiScale; }
    function motion(magnitude) { return magnitude * state.motionScale; }

    function toJSON() { return Object.assign({}, state); }
    function fromJSON(obj) {
      if (!obj) return { ok: false };
      const allowed = ["colorblindMode", "uiScale", "motionScale", "highContrast",
                       "subtitlesEnabled", "subtitleSize", "reduceFlashes"];
      for (const k of allowed) if (obj[k] != null) state[k] = obj[k];
      _log("load", { keys: Object.keys(obj) });
      return { ok: true };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      COLORBLIND_MODES,
      setColorblindMode, setUIScale, setMotionScale,
      setHighContrast, setReduceFlashes, setSubtitlesEnabled, setSubtitleSize,
      pushSubtitle, expireSubtitles, activeSubtitles, clearSubtitles,
      getState, fontSize, panelSize, motion,
      toJSON, fromJSON, recentEvents,
    };
  }

  return {
    COLORBLIND_MODES,
    COLORBLIND_MATRICES,
    applyColorblind,
    createState,
  };
});
