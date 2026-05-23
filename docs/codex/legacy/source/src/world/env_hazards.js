// env_hazards.js — environmental hazards: fire (spreads + burns out),
// flood (rises + drowns), shockwave (one-shot blast), gas cloud
// (lingers + drifts).
//
// Each hazard has position, radius, intensity, age, lifetime, and
// per-kind dynamics. Entities/buildings inside the hazard radius
// take damage per second. Spread mechanics let fire jump to nearby
// flammable buildings via _neighbors callback the caller supplies.
//
// Fires can be extinguished (water source) or burn out naturally.
// Floods rise based on weather intensity and drain when weather clears.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAEnvHazards = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KINDS = ["fire", "flood", "shockwave", "gas"];

  function _dist(a, b) { return Math.hypot(a.u - b.u, a.v - b.v); }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      fireBaseDamagePerSec: 5,
      fireSpreadRadius: 5,
      fireSpreadChance: 0.1,     // per sec per neighbor
      fireMaxLifetimeMs: 60 * 1000,
      fireExtinguishRate: 1.0,   // intensity dropped per sec when water applied
      floodBaseDamagePerSec: 2,
      floodRiseRate: 0.1,        // height/sec at intensity 1
      shockwaveDamage: 50,
      shockwaveRadius: 15,
      gasBaseDamagePerSec: 3,
      gasDriftPerSec: 1.0,
      gasMaxLifetimeMs: 30 * 1000,
    }, opts.config || {});

    const hazards = new Map();
    let nextId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function spawnFire(opts2) {
      opts2 = opts2 || {};
      if (!opts2.position) return { ok: false, reason: "no_position" };
      const id = "haz_" + (nextId++);
      hazards.set(id, {
        id, kind: "fire",
        position: { u: opts2.position.u, v: opts2.position.v },
        radius: opts2.radius || 3,
        intensity: opts2.intensity != null ? opts2.intensity : 1.0,
        ageMs: 0,
        maxLifetimeMs: opts2.maxLifetimeMs || config.fireMaxLifetimeMs,
        sourceBuildingId: opts2.sourceBuildingId || null,
        burnedOut: false,
        beingExtinguished: false,
      });
      _log("spawn_fire", { id, position: opts2.position });
      return { ok: true, id };
    }

    function spawnFlood(opts2) {
      opts2 = opts2 || {};
      if (!opts2.position) return { ok: false, reason: "no_position" };
      const id = "haz_" + (nextId++);
      hazards.set(id, {
        id, kind: "flood",
        position: { u: opts2.position.u, v: opts2.position.v },
        radius: opts2.radius || 20,
        height: opts2.height || 0,
        intensity: opts2.intensity != null ? opts2.intensity : 1.0,
        ageMs: 0,
      });
      _log("spawn_flood", { id });
      return { ok: true, id };
    }

    function spawnShockwave(opts2) {
      opts2 = opts2 || {};
      if (!opts2.position) return { ok: false, reason: "no_position" };
      const id = "haz_" + (nextId++);
      hazards.set(id, {
        id, kind: "shockwave",
        position: { u: opts2.position.u, v: opts2.position.v },
        radius: opts2.radius || config.shockwaveRadius,
        damage: opts2.damage || config.shockwaveDamage,
        oneShot: true,
        applied: false,
        ageMs: 0,
      });
      _log("spawn_shockwave", { id });
      return { ok: true, id };
    }

    function spawnGas(opts2) {
      opts2 = opts2 || {};
      if (!opts2.position) return { ok: false, reason: "no_position" };
      const id = "haz_" + (nextId++);
      hazards.set(id, {
        id, kind: "gas",
        position: { u: opts2.position.u, v: opts2.position.v },
        radius: opts2.radius || 5,
        intensity: opts2.intensity != null ? opts2.intensity : 1.0,
        ageMs: 0,
        maxLifetimeMs: opts2.maxLifetimeMs || config.gasMaxLifetimeMs,
        drift: opts2.drift || { u: 0, v: 0 },
      });
      _log("spawn_gas", { id });
      return { ok: true, id };
    }

    function removeHazard(id) {
      if (!hazards.has(id)) return { ok: false };
      hazards.delete(id);
      _log("removed", { id });
      return { ok: true };
    }

    function getHazard(id) { return hazards.get(id) || null; }
    function listHazards(kind) {
      const out = [];
      for (const h of hazards.values()) {
        if (!kind || h.kind === kind) out.push(h);
      }
      return out;
    }

    // Apply water to a fire to reduce its intensity
    function extinguish(id, dt) {
      const h = hazards.get(id);
      if (!h || h.kind !== "fire") return { ok: false };
      h.beingExtinguished = true;
      h.intensity = Math.max(0, h.intensity - config.fireExtinguishRate * dt);
      if (h.intensity <= 0) {
        h.intensity = 0;
        h.burnedOut = true;
      }
      _log("extinguish_tick", { id, intensity: h.intensity });
      return { ok: true, intensity: h.intensity };
    }

    // tick — advances all hazards. opts: {
    //   entities: Map<id, {position, hitbox}>,  // for damage application
    //   neighbors: (pos, radius) => [{id, pos, flammable}],  // fire spread
    //   rng: () => number,
    //   applyDamage: (entityId, damage, kind) => void,
    // }
    function tick(dt, opts2) {
      opts2 = opts2 || {};
      const rng = opts2.rng || Math.random;
      const removed = [];
      const spread = [];
      const hits = [];

      const snapshot = Array.from(hazards.values());
      for (const h of snapshot) {
        h.ageMs += dt * 1000;

        if (h.kind === "fire") {
          if (h.burnedOut || h.ageMs >= h.maxLifetimeMs) {
            removed.push(h.id); continue;
          }
          // Damage entities in radius
          if (opts2.entities) {
            for (const [eid, e] of opts2.entities) {
              if (!e.position) continue;
              if (_dist(e.position, h.position) > h.radius) continue;
              const dmg = config.fireBaseDamagePerSec * h.intensity * dt;
              if (opts2.applyDamage) opts2.applyDamage(eid, dmg, "fire");
              hits.push({ hazardId: h.id, entityId: eid, damage: dmg, kind: "fire" });
            }
          }
          // Spread to flammable neighbors
          if (opts2.neighbors && !h.beingExtinguished) {
            const neighbors = opts2.neighbors(h.position, config.fireSpreadRadius);
            for (const nb of neighbors) {
              if (!nb.flammable) continue;
              if (rng() < config.fireSpreadChance * dt * h.intensity) {
                const newFire = spawnFire({
                  position: nb.pos,
                  sourceBuildingId: nb.id,
                  intensity: h.intensity * 0.8,
                });
                spread.push({ from: h.id, to: newFire.id, atBuilding: nb.id });
              }
            }
          }
          h.beingExtinguished = false;   // reset each tick
        }

        if (h.kind === "flood") {
          // Rise based on intensity
          h.height += config.floodRiseRate * h.intensity * dt;
          if (opts2.entities) {
            for (const [eid, e] of opts2.entities) {
              if (!e.position) continue;
              if (_dist(e.position, h.position) > h.radius) continue;
              const ey = e.position.y || 0;
              if (h.height <= ey + 0.5) continue;
              const dmg = config.floodBaseDamagePerSec * dt;
              if (opts2.applyDamage) opts2.applyDamage(eid, dmg, "flood");
              hits.push({ hazardId: h.id, entityId: eid, damage: dmg, kind: "flood" });
            }
          }
        }

        if (h.kind === "shockwave") {
          if (h.applied) { removed.push(h.id); continue; }
          if (opts2.entities) {
            for (const [eid, e] of opts2.entities) {
              if (!e.position) continue;
              const d = _dist(e.position, h.position);
              if (d > h.radius) continue;
              const falloff = 1 - d / h.radius;
              const dmg = h.damage * falloff;
              if (opts2.applyDamage) opts2.applyDamage(eid, dmg, "shockwave");
              hits.push({ hazardId: h.id, entityId: eid, damage: dmg, kind: "shockwave" });
            }
          }
          h.applied = true;
          removed.push(h.id);
        }

        if (h.kind === "gas") {
          if (h.ageMs >= h.maxLifetimeMs) { removed.push(h.id); continue; }
          // Drift
          h.position.u += h.drift.u * config.gasDriftPerSec * dt;
          h.position.v += h.drift.v * config.gasDriftPerSec * dt;
          // Damage
          if (opts2.entities) {
            for (const [eid, e] of opts2.entities) {
              if (!e.position) continue;
              if (_dist(e.position, h.position) > h.radius) continue;
              const dmg = config.gasBaseDamagePerSec * h.intensity * dt;
              if (opts2.applyDamage) opts2.applyDamage(eid, dmg, "gas");
              hits.push({ hazardId: h.id, entityId: eid, damage: dmg, kind: "gas" });
            }
          }
        }
      }

      for (const id of removed) hazards.delete(id);
      return { spread, hits, removed };
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      KINDS,
      spawnFire, spawnFlood, spawnShockwave, spawnGas,
      removeHazard, getHazard, listHazards,
      extinguish, tick,
      recentEvents, getConfig,
    };
  }

  return { KINDS, createSystem };
});
