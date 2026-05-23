/**
 * ecs_poisoner_dart.js — Poisoner direct venom dart attack for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7375-7390:
 *   Line 7376: trigger: type=poisoner, canSee, 3.5m < dist < 10m
 *   Line 7377: CD = 3.0 + rand*1.5 (randomized 3.0–4.5s)
 *   Line 7384: tof = 0.9 + dist/14 (distance-scaled travel time)
 *   Line 7387: speed = dist/tof, damage=4, range=11, poisonOnHit=true, dirY=0.18
 *
 * This is the DIRECT PROJECTILE spit (pushes to enemyBullets).
 * ecs_poisoner_spit.js handles the ARC GRENADE form (pushes to grenades3D).
 *
 * Events emitted on Core:
 *   "poisoner:venom_dart" { entityId, u, v, dirU, dirV, dirY, speed, damage, range }
 *
 * Usage:
 *   const sys = createPoisonerDartSystem();
 *   Core.addSystem(sys, 13, "poisoner_dart"); // after ai_movement:12
 */

export const POISONER_DART_MIN_DIST  = 3.5;   // monolith line 7376: dist > 3.5
export const POISONER_DART_MAX_DIST  = 10;    // monolith line 7376: dist < 10
export const POISONER_DART_CD_MIN    = 3.0;   // monolith line 7379: 3.0 + rand*1.5
export const POISONER_DART_CD_RAND   = 1.5;   // monolith line 7379
export const POISONER_DART_DAMAGE    = 4;     // monolith line 7387
export const POISONER_DART_RANGE     = 11;    // monolith line 7387
export const POISONER_DART_DIR_Y     = 0.18;  // monolith line 7387: slight upward arc

/**
 * createPoisonerDartSystem() → system function
 */
export function createPoisonerDartSystem() {
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
      if (dist <= POISONER_DART_MIN_DIST || dist >= POISONER_DART_MAX_DIST) continue;

      const lastSpit   = ai._dartT ?? -999;
      const dartCD     = ai._dartInterval ?? POISONER_DART_CD_MIN;
      if (_elapsed - lastSpit < dartCD) continue;

      ai._dartT        = _elapsed;
      ai._dartInterval = POISONER_DART_CD_MIN + Math.random() * POISONER_DART_CD_RAND;

      const dx    = heroT.u - t.u;
      const dz    = heroT.v - t.v;
      const mag   = Math.hypot(dx, dz) || 1;
      const tof   = 0.9 + dist / 14;   // monolith line 7384
      const speed = dist / tof;

      core.emit("poisoner:venom_dart", {
        entityId: id,
        u:    t.u,
        v:    t.v,
        dirU: dx / mag,
        dirV: dz / mag,
        dirY: POISONER_DART_DIR_Y,
        speed,
        damage:  POISONER_DART_DAMAGE,
        range:   POISONER_DART_RANGE,
      });
    }
  }

  return system;
}

export default {
  createPoisonerDartSystem,
  POISONER_DART_MIN_DIST, POISONER_DART_MAX_DIST,
  POISONER_DART_CD_MIN, POISONER_DART_CD_RAND,
  POISONER_DART_DAMAGE, POISONER_DART_RANGE, POISONER_DART_DIR_Y,
};
