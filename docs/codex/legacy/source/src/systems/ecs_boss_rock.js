/**
 * ecs_boss_rock.js — Boss boulder throw system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7276-7298:
 *   Line 7277: trigger: type=boss, canSee, 5m <= dist < 15m
 *   Line 7278: cooldown: 6.0s normal, 3.5s enraged
 *   Line 7280: time-of-flight = 1.8s
 *   Line 7291: fuse = tof + 0.5 = 2.3s
 *
 * Events emitted on Core:
 *   "boss:rock_throw" { entityId, u, v, targetU, targetV, tof }  — for VFX arc + audio
 *   "grenade:throw"   { ownerId, u, v, fuseOverride, kind }       — spawns explosion entity
 *
 * Usage:
 *   const sys = createBossRockSystem();
 *   Core.addSystem(sys, 14, "boss_rock"); // after enrage:13, before status_effects:15
 */

export const BOSS_ROCK_MIN_DIST   = 5;    // monolith line 7277: dist >= 5
export const BOSS_ROCK_MAX_DIST   = 15;   // monolith line 7277: dist < 15
export const BOSS_ROCK_CD_NORMAL  = 6.0;  // monolith line 7278
export const BOSS_ROCK_CD_ENRAGED = 3.5;  // monolith line 7278: enraged ? 3.5 : 6.0
export const BOSS_ROCK_TOF        = 1.8;  // monolith line 7280: time-of-flight seconds
export const BOSS_ROCK_FUSE       = 2.3;  // monolith line 7291: tof + 0.5

/**
 * createBossRockSystem() → system function
 */
export function createBossRockSystem() {
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
      if (ai.type !== "boss") continue;
      if (h.hp <= 0) continue;

      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 20);
      if (!canSee) continue;
      if (dist < BOSS_ROCK_MIN_DIST || dist >= BOSS_ROCK_MAX_DIST) continue;

      const cd       = ai._enraged ? BOSS_ROCK_CD_ENRAGED : BOSS_ROCK_CD_NORMAL;
      const lastRock = ai._rockT ?? -999;
      if (_elapsed - lastRock < cd) continue;

      // Throw
      ai._rockT = _elapsed;

      core.emit("boss:rock_throw", {
        entityId: id,
        u: t.u, v: t.v,
        targetU: heroT.u, targetV: heroT.v,
        tof: BOSS_ROCK_TOF,
      });

      core.emit("grenade:throw", {
        ownerId:      id,
        u:            heroT.u,
        v:            heroT.v,
        y:            0.05,
        kind:         "frag",
        fuseOverride: BOSS_ROCK_FUSE,
      });
    }
  }

  return system;
}

export default {
  createBossRockSystem,
  BOSS_ROCK_MIN_DIST, BOSS_ROCK_MAX_DIST,
  BOSS_ROCK_CD_NORMAL, BOSS_ROCK_CD_ENRAGED,
  BOSS_ROCK_TOF, BOSS_ROCK_FUSE,
};
