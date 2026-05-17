// weather_damage_bridge.js — wire weather_damage.js → destruction.js.
// Bridges lightning strikes from the weather system into destructible
// building HP via the destruction system. Translates entity-level
// "applyDamage" calls into building "applyDamage" calls when the
// entity is a registered destructible building.
//
// Also handles flood + hail propagation onto buildings: flood corrodes
// wood structures over time; hail chips at glass.
//
// Modular: this file is the registry-only bridge — no hardcoded calls
// from either side know about the other.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeatherDamageBridge = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // bridge(weatherSys, destructionSys, buildingsMap, opts)
  // buildingsMap: id → entity. entity must have .destructible facet
  // for damage to land. opts.lightningRadius optional override.
  function createBridge(weatherSys, destructionSys, buildingsMap, opts) {
    opts = opts || {};
    if (!weatherSys || !destructionSys) {
      throw new Error("weatherSys + destructionSys required");
    }
    const events = [];
    const config = Object.assign({
      lightningKind: "explosion",   // damage kind for destruction.applyDamage
      floodKind: "water",           // wood + others vulnerable
      hailKind: "bullet",           // glass especially
      floodDamageScale: 1.0,
      hailDamageScale: 1.0,
      lightningExposureBonus: 0.3,  // tall buildings get amped
    }, opts.config || {});

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    // Apply a lightning strike from weatherSys to nearby buildings.
    // Returns array of {buildingId, damage, collapsed?}
    function applyLightning(strike) {
      if (!strike || !strike.pos) return [];
      const hits = [];
      const radius = strike.splashRadius;
      for (const [id, b] of buildingsMap) {
        if (!b.position || !b.destructible) continue;
        if (b.destructible.collapsed) continue;
        const du = b.position.u - strike.pos.u;
        const dv = b.position.v - strike.pos.v;
        const dist = Math.hypot(du, dv);
        if (dist > radius) continue;
        const falloff = Math.max(0, 1 - dist / radius);
        const heightMul = b.hitbox && b.hitbox.h
          ? (1 + b.hitbox.h * config.lightningExposureBonus)
          : 1;
        const dmg = Math.round(strike.damage * falloff * heightMul);
        if (dmg <= 0) continue;
        const r = destructionSys.applyDamage(id, dmg, config.lightningKind);
        if (r.ok) {
          hits.push({ buildingId: id, damage: r.damageDealt, collapsed: r.collapsed });
          _log("lightning_hit", { id, damage: r.damageDealt });
        }
      }
      return hits;
    }

    // Tick flood damage to buildings standing in flooded areas.
    // areaResolver(building.position) → areaId (caller supplies).
    function applyFloodTick(areaResolver, dt) {
      const hits = [];
      for (const [id, b] of buildingsMap) {
        if (!b.position || !b.destructible) continue;
        if (b.destructible.collapsed) continue;
        if (b.destructible.material === "concrete" || b.destructible.material === "steel" ||
            b.destructible.material === "reinforced") continue;   // resistant
        const areaId = areaResolver(b.position);
        const fh = weatherSys.getFloodHeight(areaId);
        if (fh <= (b.position.y || 0) + 0.5) continue;
        const dmg = weatherSys.config.floodDamagePerSec * dt * config.floodDamageScale;
        const r = destructionSys.applyDamage(id, dmg, config.floodKind);
        if (r.ok) {
          hits.push({ buildingId: id, damage: r.damageDealt, fh });
          _log("flood_tick", { id, damage: r.damageDealt, fh });
        }
      }
      return hits;
    }

    // Apply hail damage — primarily glass takes a hit, others negligible.
    function applyHailTick(isIndoorsFn, weatherName, intensity, dt) {
      if (weatherName !== "snow") return [];
      const hits = [];
      for (const [id, b] of buildingsMap) {
        if (!b.position || !b.destructible) continue;
        if (b.destructible.collapsed) continue;
        if (b.destructible.material !== "glass") continue;
        if (isIndoorsFn && isIndoorsFn(b.position)) continue;
        const dmg = weatherSys.config.hailDamagePerSec * intensity * dt * config.hailDamageScale;
        const r = destructionSys.applyDamage(id, dmg, config.hailKind);
        if (r.ok) {
          hits.push({ buildingId: id, damage: r.damageDealt });
          _log("hail_tick", { id, damage: r.damageDealt });
        }
      }
      return hits;
    }

    // Full weather→damage cycle: roll lightning + apply, plus apply
    // flood/hail ticks.
    function tick(opts2) {
      opts2 = opts2 || {};
      const weatherName = opts2.weather || "clear";
      const intensity = opts2.intensity || 0;
      const bounds = opts2.bounds || { u0: -100, v0: -100, u1: 100, v1: 100 };
      const dt = opts2.dt || 1 / 60;
      const rng = opts2.rng;
      const out = { lightning: [], flood: [], hail: [], struck: false };

      const strike = weatherSys.rollLightning(weatherName, intensity, bounds, rng);
      if (strike.struck) {
        out.struck = true;
        out.strike = strike;
        out.lightning = applyLightning(strike);
      }
      if (opts2.areaResolver) {
        out.flood = applyFloodTick(opts2.areaResolver, dt);
      }
      if (weatherName === "snow") {
        out.hail = applyHailTick(opts2.isIndoorsFn, weatherName, intensity, dt);
      }
      return out;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      config,
      applyLightning, applyFloodTick, applyHailTick,
      tick, recentEvents,
    };
  }

  return { createBridge };
});
