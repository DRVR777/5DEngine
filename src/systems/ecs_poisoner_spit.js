/**
 * ecs_poisoner_spit.js — Poisoner acid spit attack system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7299-7321:
 *   Line 7300: trigger: type=poisoner, canSee, 3m < dist < 10m
 *   Line 7301: cooldown: 4.0s
 *   Line 7303: time-of-flight = 1.1s
 *   Line 7314: fuse = tof + 0.25 = 1.35s
 *
 * Events emitted on Core:
 *   "poisoner:acid_spit" { entityId, u, v, targetU, targetV, tof }  — for VFX arc + audio
 *   "grenade:throw"      { ownerId, u, v, fuseOverride }             — spawns explosion entity
 *
 * Usage:
 *   const sys = createPoisonerSpitSystem();
 *   Core.addSystem(sys, 13, "poisoner_spit"); // after ai_movement:12
 */

export const POISONER_SPIT_MIN_DIST = 3;     // monolith line 7300: dist > 3
export const POISONER_SPIT_MAX_DIST = 10;    // monolith line 7300: dist < 10
export const POISONER_SPIT_CD       = 4.0;   // monolith line 7301
export const POISONER_SPIT_TOF      = 1.1;   // monolith line 7303
export const POISONER_SPIT_FUSE     = 1.35;  // monolith line 7314: tof + 0.25

/**
 * createPoisonerSpitSystem() → system function
 */
export function createPoisonerSpitSystem() {
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
      if (ai.type !== "poisoner") continue;
      if (h.hp <= 0) continue;

      if (!heroT) continue;

      const dist   = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 12);
      if (!canSee) continue;
      if (dist <= POISONER_SPIT_MIN_DIST || dist >= POISONER_SPIT_MAX_DIST) continue;

      const lastSpit = ai._acidT ?? -999;
      if (_elapsed - lastSpit < POISONER_SPIT_CD) continue;

      // Spit
      ai._acidT = _elapsed;

      core.emit("poisoner:acid_spit", {
        entityId: id,
        u: t.u, v: t.v,
        targetU: heroT.u, targetV: heroT.v,
        tof: POISONER_SPIT_TOF,
      });

      core.emit("grenade:throw", {
        ownerId:      id,
        u:            heroT.u,
        v:            heroT.v,
        y:            0.05,
        fuseOverride: POISONER_SPIT_FUSE,
      });
    }
  }

  return system;
}

export default {
  createPoisonerSpitSystem,
  POISONER_SPIT_MIN_DIST, POISONER_SPIT_MAX_DIST,
  POISONER_SPIT_CD, POISONER_SPIT_TOF, POISONER_SPIT_FUSE,
};
