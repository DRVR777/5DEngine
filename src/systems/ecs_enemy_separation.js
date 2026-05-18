/**
 * ecs_enemy_separation.js — Enemy overlap prevention for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7723-7742:
 *   Line 7724: SEP_DIST = 1.2m (minimum separation distance)
 *   Line 7724: SEP_PUSH = 0.6 (push strength per frame)
 *   Line 7734: broad-phase skip: both |dU| and |dV| > SEP_DIST
 *   Line 7736: d < SEP_DIST && d > 0.001 → push apart
 *   Line 7737: push = (SEP_DIST - d) * SEP_PUSH * dt / d
 *
 * Pairwise N² overlap resolution — pushes enemy pairs apart when within
 * SEP_DIST. Works on EnemyAI+Transform pairs only; hero is unaffected.
 *
 * Events emitted on Core: none (pure position mutation)
 *
 * Usage:
 *   const sys = createEnemySeparationSystem();
 *   Core.addSystem(sys, 13, "enemy_separation"); // alongside ai_movement
 */

export const ENEMY_SEP_DIST = 1.2;   // monolith line 7724: minimum distance
export const ENEMY_SEP_PUSH = 0.6;   // monolith line 7724: push strength

/**
 * createEnemySeparationSystem() → system function
 */
export function createEnemySeparationSystem() {
  function system(dt, core) {
    const enemies = core.query("EnemyAI", "Transform", "Health");
    const n = enemies.length;

    for (let i = 0; i < n; i++) {
      const idA = enemies[i];
      const hA  = core.getComponent(idA, "Health");
      if (!hA || hA.hp <= 0) continue;
      const tA  = core.getComponent(idA, "Transform");
      if (!tA) continue;

      for (let j = i + 1; j < n; j++) {
        const idB = enemies[j];
        const hB  = core.getComponent(idB, "Health");
        if (!hB || hB.hp <= 0) continue;
        const tB  = core.getComponent(idB, "Transform");
        if (!tB) continue;

        const dU = tA.u - tB.u;
        const dV = tA.v - tB.v;

        // Broad-phase: skip if clearly out of range on both axes
        if (Math.abs(dU) > ENEMY_SEP_DIST && Math.abs(dV) > ENEMY_SEP_DIST) continue;

        const d = Math.hypot(dU, dV);
        if (d >= ENEMY_SEP_DIST || d < 0.001) continue;

        const push = (ENEMY_SEP_DIST - d) * ENEMY_SEP_PUSH * dt / d;
        tA.u += dU * push;
        tA.v += dV * push;
        tB.u -= dU * push;
        tB.v -= dV * push;
      }
    }
  }

  return system;
}

export default {
  createEnemySeparationSystem,
  ENEMY_SEP_DIST, ENEMY_SEP_PUSH,
};
