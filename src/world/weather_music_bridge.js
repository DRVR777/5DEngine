// weather_music_bridge.js — auto-tune radio stations based on weather.
// Wires weather_forecast.js (iter 98) → radio.js (iter 104).
// Caller registers a kind→station mapping; on tick, the bridge reads
// the current weather kind from a forecast and asks the radio to
// suggest/tune to the mapped station. Smooth crossfades happen at the
// radio layer; this bridge just decides "when" to switch.
//
// Hysteresis: requires N consecutive ticks of a new weather kind
// before switching, so brief blips don't strobe the station.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeatherMusicBridge = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createBridge(opts) {
    opts = opts || {};
    if (!opts.radio) throw new Error("radio required");
    if (!opts.weatherSource) throw new Error("weatherSource required");
    const radio = opts.radio;
    const wsrc = opts.weatherSource;       // {weatherAt(ts) → {kind, intensity}}
    const config = Object.assign({
      hysteresisTicks: 3,
      defaultMapping: {
        clear:      "ambient_clear",
        cloudy:     "ambient_clear",
        rain:       "calm_rain",
        heavy_rain: "calm_rain",
        storm:      "energetic_storm",
        snow:       "calm_rain",
        fog:        "ambient_clear",
      },
    }, opts.config || {});

    let kindToStation = Object.assign({}, config.defaultMapping);
    let currentKind = null;
    let candidateKind = null;
    let candidateStreak = 0;
    let lastDecisionTs = 0;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function setMapping(kind, stationId) {
      if (typeof stationId !== "string" || !stationId) {
        return { ok: false, reason: "bad_station" };
      }
      kindToStation[kind] = stationId;
      _log("set_mapping", { kind, stationId });
      return { ok: true };
    }

    function setMappings(map) {
      kindToStation = Object.assign({}, kindToStation, map);
      return { ok: true };
    }

    function getMapping(kind) { return kindToStation[kind] || null; }

    // Read weather, decide whether to switch
    function tick(ctx) {
      ctx = ctx || {};
      const now = ctx.now != null ? ctx.now : Date.now();
      const wx = wsrc.weatherAt
        ? wsrc.weatherAt(ctx.forecast || null, now)
        : null;
      if (!wx || !wx.kind) return { ok: false, reason: "no_weather" };
      const kind = wx.kind;

      // Hysteresis
      if (kind === currentKind) {
        candidateKind = null;
        candidateStreak = 0;
        return { ok: true, kind, kept: true };
      }
      if (kind !== candidateKind) {
        candidateKind = kind;
        candidateStreak = 1;
        if (candidateStreak < config.hysteresisTicks) {
          return { ok: true, kind, kept: true, candidate: kind, streak: 1 };
        }
        // fall through — hysteresisTicks=1 fires immediately
      } else {
        candidateStreak++;
      }
      if (candidateStreak < config.hysteresisTicks) {
        return { ok: true, kind: currentKind || kind, kept: true,
                 candidate: kind, streak: candidateStreak };
      }
      // Switch!
      const stationId = kindToStation[kind];
      if (!stationId) {
        return { ok: false, reason: "no_mapping", kind };
      }
      const prevKind = currentKind;
      currentKind = kind;
      candidateKind = null;
      candidateStreak = 0;
      lastDecisionTs = now;
      let tuneResult = { ok: false, reason: "no_radio" };
      try {
        tuneResult = radio.tuneTo(stationId, { now });
      } catch (e) {
        return { ok: false, reason: "tune_threw", message: e.message };
      }
      _log("switch", { from: prevKind, to: kind, stationId });
      return {
        ok: true,
        switched: true,
        from: prevKind, to: kind, stationId,
        radioResult: tuneResult,
      };
    }

    function getCurrentKind() { return currentKind; }
    function reset() {
      currentKind = null;
      candidateKind = null;
      candidateStreak = 0;
      lastDecisionTs = 0;
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      setMapping, setMappings, getMapping,
      tick, getCurrentKind, reset,
      recentEvents, getConfig,
    };
  }

  return { createBridge };
});
