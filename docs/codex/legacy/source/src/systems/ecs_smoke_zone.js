/**
 * ecs_smoke_zone.js — Smoke grenade zone management for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 2121, 2129, 7119, 8355-8359:
 *   const smokeZones = []; // {u,v,radius,timeLeft}
 *   smokeZones.push({ u, v, radius: 3.5, timeLeft: 6.0 });
 *   sz.timeLeft -= dt; if (sz.timeLeft <= 0) smokeZones.splice(…)
 *   smokeZones.some(sz => hypot(ep.u-sz.u,ep.v-sz.v) < sz.radius || hypot(hero.u-sz.u,…) < sz.radius)
 *
 * Zones are plain objects (not ECS entities) to match monolith structure.
 * Exposes isSmoked(posU, posV, heroU, heroV) for AI canSee gate.
 *
 * Events consumed:
 *   "grenade:smoke_explode" { u, v } — smoke detonation position
 *
 * Events emitted on Core:
 *   "smoke:zone_added"   { u, v, radius, duration }
 *   "smoke:zone_expired" { u, v }
 *
 * Usage:
 *   const sys = createSmokeZoneSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 10, "smoke_zone");
 *   // in AI canSee check: const smoked = sys.isSmoked(ep.u, ep.v, hero.u, hero.v);
 */

export const SMOKE_RADIUS   = 3.5; // monolith line 2129: radius: 3.5
export const SMOKE_DURATION = 6.0; // monolith line 2129: timeLeft: 6.0

export function createSmokeZoneSystem() {
  const _zones = []; // { u, v, radius, timeLeft }

  function system(dt, core) {
    for (let i = _zones.length - 1; i >= 0; i--) {
      _zones[i].timeLeft -= dt;
      if (_zones[i].timeLeft <= 0) {
        const { u, v } = _zones[i];
        _zones.splice(i, 1);
        core.emit("smoke:zone_expired", { u, v });
      }
    }
  }

  function wireListeners(core) {
    core.on("grenade:smoke_explode", ({ u, v }) => {
      _zones.push({ u, v, radius: SMOKE_RADIUS, timeLeft: SMOKE_DURATION });
      core.emit("smoke:zone_added", { u, v, radius: SMOKE_RADIUS, duration: SMOKE_DURATION });
    });
  }

  function isSmoked(posU, posV, heroU, heroV) {
    return _zones.some(sz =>
      Math.hypot(posU - sz.u, posV - sz.v) < sz.radius ||
      Math.hypot(heroU - sz.u, heroV - sz.v) < sz.radius
    );
  }

  system.wireListeners = wireListeners;
  system.isSmoked      = isSmoked;
  system.getZones      = () => _zones;
  return system;
}

export default { createSmokeZoneSystem, SMOKE_RADIUS, SMOKE_DURATION };
