/**
 * ecs_heavy_throw.js — Heavy enemy grenade throw system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7254-7275:
 *   Line 7255: trigger: type=heavy, canSee, 3.5m < dist < 12m
 *   Line 7256: cooldown: 4.0s normal, 2.5s enraged
 *   Line 7258: time-of-flight = 1.5s
 *   Line 7269: fuse = tof + 0.3 = 1.8s
 *
 * Events emitted on Core:
 *   "heavy:grenade_throw" { entityId, u, v, targetU, targetV, tof }  — for VFX arc
 *   "grenade:throw"       { ownerId, u, v, fuseOverride }            — spawns grenade entity
 *
 * The grenade:throw event is handled by ecs_grenade.js which spawns the fuse entity.
 * The grenade spawns at the hero's predicted position; ecs_grenade handles explosion.
 *
 * Usage:
 *   const sys = createHeavyThrowSystem();
 *   Core.addSystem(sys, 13, "heavy_throw"); // after ai_movement:12, before status:15
 */

export const HEAVY_THROW_MIN_DIST   = 3.5;  // monolith line 7255: dist > 3.5
export const HEAVY_THROW_MAX_DIST   = 12.0; // monolith line 7255: dist < 12
export const HEAVY_THROW_CD_NORMAL  = 4.0;  // monolith line 7256
export const HEAVY_THROW_CD_ENRAGED = 2.5;  // monolith line 7256: enraged ? 2.5 : 4.0
export const HEAVY_THROW_TOF        = 1.5;  // monolith line 7258: time-of-flight seconds
export const HEAVY_THROW_FUSE       = 1.8;  // monolith line 7269: tof + 0.3

/**
 * createHeavyThrowSystem() → system function
 */
export function createHeavyThrowSystem() {
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
      if (ai.type !== "heavy") continue;
      if (h.hp <= 0) continue;

      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 10);
      if (!canSee) continue;
      if (dist <= HEAVY_THROW_MIN_DIST || dist >= HEAVY_THROW_MAX_DIST) continue;

      const cd      = ai._enraged ? HEAVY_THROW_CD_ENRAGED : HEAVY_THROW_CD_NORMAL;
      const lastThrow = ai._grenadeT ?? -999;
      if (_elapsed - lastThrow < cd) continue;

      // Throw
      ai._grenadeT = _elapsed;

      core.emit("heavy:grenade_throw", {
        entityId: id,
        u: t.u, v: t.v,
        targetU: heroT.u, targetV: heroT.v,
        tof: HEAVY_THROW_TOF,
      });

      core.emit("grenade:throw", {
        ownerId:      id,
        u:            heroT.u,
        v:            heroT.v,
        y:            0.05,
        fuseOverride: HEAVY_THROW_FUSE,
      });
    }
  }

  return system;
}

export default {
  createHeavyThrowSystem,
  HEAVY_THROW_MIN_DIST, HEAVY_THROW_MAX_DIST,
  HEAVY_THROW_CD_NORMAL, HEAVY_THROW_CD_ENRAGED,
  HEAVY_THROW_TOF, HEAVY_THROW_FUSE,
};
