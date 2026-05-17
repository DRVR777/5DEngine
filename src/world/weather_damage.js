// weather_damage.js — environmental damage from weather effects.
// Lightning: random AoE strikes during storms; tall structures take more.
// Flood: low-ground areas accumulate water during heavy_rain; entities
// below flood line take HP-per-sec damage.
// Hail: light damage to entities outdoors during snowstorms.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWeatherDamage = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createDamageSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      lightningDamageBase: 80,        // direct strike
      lightningSplashRadius: 8,       // AoE
      lightningSplashFalloff: 1.0,
      lightningHeightBonus: 0.2,      // per unit of height
      floodFillRate: 0.05,            // height per sec at heavy_rain intensity
      floodDamagePerSec: 4,
      hailDamagePerSec: 1,
      strikePerSecChance: 0.05,       // 5%/s in storm at intensity 1
    }, opts.config || {});

    const floodHeight = new Map();    // areaId → current flood height
    const strikes = [];               // last 50 strike events
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }

    // Lightning: returns {struck: true, pos, damage, splashDamage} on hit,
    // or {struck: false}. Caller supplies an rng and the world bounds.
    function rollLightning(weatherName, intensity, bounds, rng) {
      if (weatherName !== "storm") return { struck: false };
      rng = rng || Math.random;
      const baseChance = config.strikePerSecChance * intensity;
      if (rng() >= baseChance) return { struck: false };
      const pos = {
        u: bounds.u0 + rng() * (bounds.u1 - bounds.u0),
        v: bounds.v0 + rng() * (bounds.v1 - bounds.v0),
      };
      const strike = {
        pos, damage: config.lightningDamageBase,
        splashRadius: config.lightningSplashRadius,
        ts: Date.now(),
      };
      strikes.push(strike);
      if (strikes.length > 50) strikes.shift();
      _log("lightning", strike);
      return Object.assign({ struck: true }, strike);
    }

    // Apply a lightning strike's damage to nearby entities. Caller passes
    // the entities Map and an apply-damage function.
    // Tall entities (taller hitbox.h) take a height bonus.
    function applyLightningStrike(strike, entities, applyDamage) {
      const hits = [];
      for (const [id, e] of entities) {
        if (!e.position) continue;
        const du = e.position.u - strike.pos.u;
        const dv = e.position.v - strike.pos.v;
        const dist = Math.hypot(du, dv);
        if (dist > strike.splashRadius) continue;
        const falloff = Math.max(0, 1 - (dist / strike.splashRadius) * config.lightningSplashFalloff);
        const heightBonus = e.hitbox && e.hitbox.h
          ? (1 + e.hitbox.h * config.lightningHeightBonus) : 1;
        const dmg = Math.round(strike.damage * falloff * heightBonus);
        if (dmg > 0 && e.health && !e.health.dead) {
          applyDamage(e, dmg, "lightning");
          hits.push({ entityId: id, damage: dmg, dist });
        }
      }
      return hits;
    }

    // Flood: accumulate per area. weather=heavy_rain, dt seconds.
    // floodArea = "u_v" cell key for some grid; caller decides.
    function tickFlood(areaId, weatherName, intensity, dt) {
      const rate = (weatherName === "heavy_rain" || weatherName === "storm")
        ? config.floodFillRate * intensity
        : -config.floodFillRate * 0.5;     // drain otherwise
      const cur = floodHeight.get(areaId) || 0;
      const next = Math.max(0, cur + rate * dt);
      floodHeight.set(areaId, next);
      return next;
    }

    function getFloodHeight(areaId) { return floodHeight.get(areaId) || 0; }

    // Apply flood damage to entities in flooded areas (below floodLevel).
    // areaResolver: (entityPos) → areaId
    function applyFloodDamage(entities, areaResolver, applyDamage, dt) {
      const hits = [];
      for (const [id, e] of entities) {
        if (!e.position || !e.health || e.health.dead) continue;
        const areaId = areaResolver(e.position);
        const fh = getFloodHeight(areaId);
        const entityY = e.position.y || 0;
        if (fh > entityY + 0.5) {  // entity submerged
          const dmg = config.floodDamagePerSec * dt;
          applyDamage(e, dmg, "flood");
          hits.push({ entityId: id, damage: dmg, floodHeight: fh });
        }
      }
      return hits;
    }

    // Hail damage during snow weather (light continuous damage to outdoor entities)
    function applyHailDamage(entities, isIndoorsFn, applyDamage, weatherName, intensity, dt) {
      if (weatherName !== "snow") return [];
      const hits = [];
      for (const [id, e] of entities) {
        if (!e.position || !e.health || e.health.dead) continue;
        if (isIndoorsFn && isIndoorsFn(e.position)) continue;
        const dmg = config.hailDamagePerSec * intensity * dt;
        applyDamage(e, dmg, "hail");
        hits.push({ entityId: id, damage: dmg });
      }
      return hits;
    }

    function recentStrikes(n) { return strikes.slice(-(n || 10)); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function clearFloods() { floodHeight.clear(); }

    return {
      config,
      rollLightning, applyLightningStrike,
      tickFlood, getFloodHeight, applyFloodDamage, clearFloods,
      applyHailDamage,
      recentStrikes, recentEvents,
    };
  }

  return { createDamageSystem };
});
