// weather_missions.js — gate mission availability by current weather.
// Caller registers missions with weather-condition requirements
// (e.g. {kind: "storm", minIntensity: 0.5}, or {kindAny: ["snow","fog"]}).
// availableMissions(weatherSource) filters the registry by what's
// currently valid; isAvailable(missionId, weather) is a one-shot check.
//
// Designed to bridge weather_forecast.js (iter 98) with mission_dsl
// (iter 84) — caller spawns weather-eligible missions through the
// generator/runner.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeatherMissions = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      anyKind: ["clear","cloudy","rain","heavy_rain","storm","snow","fog"],
    }, opts.config || {});

    const missions = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerMission(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (missions.has(opts2.id)) return { ok: false, reason: "duplicate" };
      if (!opts2.requirement) return { ok: false, reason: "missing_requirement" };
      const req = opts2.requirement;
      // Validate requirement shape
      if (!req.kind && !Array.isArray(req.kindAny)) {
        return { ok: false, reason: "needs_kind_or_kindAny" };
      }
      missions.set(opts2.id, {
        id: opts2.id,
        name: opts2.name || opts2.id,
        requirement: Object.assign({}, req),
        rewardCcy: opts2.rewardCcy || null,
        rewardAmount: opts2.rewardAmount || 0,
        meta: opts2.meta || {},
      });
      _log("register", { id: opts2.id, requirement: req });
      return { ok: true };
    }

    function unregisterMission(id) { return missions.delete(id); }
    function getMission(id) { return missions.get(id) || null; }
    function listMissions() { return Array.from(missions.values()); }

    function _matches(req, weather) {
      if (!weather || !weather.kind) return false;
      if (req.kind && weather.kind !== req.kind) return false;
      if (Array.isArray(req.kindAny) && !req.kindAny.includes(weather.kind)) return false;
      if (req.minIntensity != null && (weather.intensity || 0) < req.minIntensity) return false;
      if (req.maxIntensity != null && (weather.intensity || 0) > req.maxIntensity) return false;
      if (req.timeOfDay) {
        if (!weather.timeOfDay || weather.timeOfDay !== req.timeOfDay) return false;
      }
      if (req.season) {
        if (!weather.season || weather.season !== req.season) return false;
      }
      return true;
    }

    function isAvailable(missionId, weather) {
      const m = missions.get(missionId);
      if (!m) return false;
      return _matches(m.requirement, weather);
    }

    function availableMissions(weather) {
      const out = [];
      for (const m of missions.values()) {
        if (_matches(m.requirement, weather)) out.push(m);
      }
      return out;
    }

    // Watch over time: callback(missionId, weather) fires when a mission
    // becomes newly-available between two consecutive ticks.
    let lastWeatherKind = null;
    let lastAvailable = new Set();
    function tick(weather, onAvailable) {
      const nowSet = new Set();
      for (const m of missions.values()) {
        if (_matches(m.requirement, weather)) nowSet.add(m.id);
      }
      // New unlocks
      const newlyAvailable = [];
      for (const id of nowSet) {
        if (!lastAvailable.has(id)) {
          newlyAvailable.push(id);
          if (typeof onAvailable === "function") {
            try { onAvailable(id, weather); }
            catch (e) {}
          }
        }
      }
      lastAvailable = nowSet;
      if (weather) lastWeatherKind = weather.kind;
      return newlyAvailable;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      registerMission, unregisterMission, getMission, listMissions,
      isAvailable, availableMissions, tick,
      recentEvents,
    };
  }

  return { createSystem };
});
