/**
 * ecs_incendiary_bomb.js — Incendiary fire bomb throw system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7322-7344:
 *   Line 7323: trigger: type=incendiary, canSee, 4m < dist < 12m
 *   Line 7324: cooldown: 5.0s
 *   Line 7326: time-of-flight = 1.4s
 *   Line 7337: fuse = tof + 0.3 = 1.7s
 *
 * Events emitted on Core:
 *   "incendiary:fireball" { entityId, u, v, targetU, targetV, tof }  — for VFX arc + audio
 *   "grenade:throw"       { ownerId, u, v, fuseOverride }             — spawns explosion entity
 *
 * Usage:
 *   const sys = createIncendiaryBombSystem();
 *   Core.addSystem(sys, 13, "incendiary_bomb"); // after ai_movement:12
 */

export const INCENDIARY_BOMB_MIN_DIST = 4;    // monolith line 7323: dist > 4
export const INCENDIARY_BOMB_MAX_DIST = 12;   // monolith line 7323: dist < 12
export const INCENDIARY_BOMB_CD       = 5.0;  // monolith line 7324
export const INCENDIARY_BOMB_TOF      = 1.4;  // monolith line 7326
export const INCENDIARY_BOMB_FUSE     = 1.7;  // monolith line 7337: tof + 0.3

/**
 * createIncendiaryBombSystem() → system function
 */
export function createIncendiaryBombSystem() {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    if (!enemies.length) return;

    const heroIds = core.query("PlayerControl", "Transform");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (ai.type !== "incendiary") continue;
      if (h.hp <= 0) continue;

      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 12);
      if (!canSee) continue;
      if (dist <= INCENDIARY_BOMB_MIN_DIST || dist >= INCENDIARY_BOMB_MAX_DIST) continue;

      const lastFire = ai._fireT ?? -999;
      if (_elapsed - lastFire < INCENDIARY_BOMB_CD) continue;

      // Throw
      ai._fireT = _elapsed;

      core.emit("incendiary:fireball", {
        entityId: id,
        u: t.u, v: t.v,
        targetU: heroT.u, targetV: heroT.v,
        tof: INCENDIARY_BOMB_TOF,
      });

      core.emit("grenade:throw", {
        ownerId:      id,
        u:            heroT.u,
        v:            heroT.v,
        y:            0.05,
        fuseOverride: INCENDIARY_BOMB_FUSE,
      });
    }
  }

  return system;
}

export default {
  createIncendiaryBombSystem,
  INCENDIARY_BOMB_MIN_DIST, INCENDIARY_BOMB_MAX_DIST,
  INCENDIARY_BOMB_CD, INCENDIARY_BOMB_TOF, INCENDIARY_BOMB_FUSE,
};
