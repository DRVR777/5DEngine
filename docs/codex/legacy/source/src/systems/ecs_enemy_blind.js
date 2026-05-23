/**
 * ecs_enemy_blind.js — Flash grenade blind effect for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 2390-2395, 7119-7120:
 *   const FLASH_R = 6;
 *   if (d < FLASH_R) en._blindT = 2.5 * (1 - d / FLASH_R) + 0.5;
 *   if (en._blindT > 0) en._blindT -= dt;
 *   const canSee = !_smokeBlind && !(en._blindT > 0) && ...
 *
 * Listens for grenade:flash_explode and stamps ai._blindT on nearby enemies.
 * Each tick decrements _blindT toward 0. canSee checks !(ai._blindT > 0).
 *
 * Events consumed:
 *   "grenade:flash_explode" { u, v } — flash detonation position
 *
 * Events emitted on Core:
 *   "enemy:blinded" { entityId, duration } — when blind is applied
 *
 * Usage:
 *   const sys = createEnemyBlindSystem();
 *   sys.wireListeners(Core);
 *   Core.addSystem(sys, 12, "enemy_blind"); // same priority as ai_movement
 */

export const FLASH_RADIUS     = 6;    // monolith line 2390: FLASH_R = 6
export const FLASH_NEAR_SCALE = 2.5;  // monolith line 2395: coefficient on (1 - d/R)
export const FLASH_BASE       = 0.5;  // monolith line 2395: baseline blind seconds

export function createEnemyBlindSystem() {
  function system(dt, core) {
    const entities = core.query("EnemyAI", "Transform");
    for (const id of entities) {
      const ai = core.getComponent(id, "EnemyAI");
      if (!ai) continue;
      if (ai._blindT > 0) ai._blindT = Math.max(0, ai._blindT - dt);
    }
  }

  function wireListeners(core) {
    core.on("grenade:flash_explode", ({ u, v }) => {
      const entities = core.query("EnemyAI", "Transform");
      for (const id of entities) {
        const t  = core.getComponent(id, "Transform");
        const ai = core.getComponent(id, "EnemyAI");
        if (!t || !ai) continue;
        const d = Math.hypot(t.u - u, t.v - v);
        if (d < FLASH_RADIUS) {
          const duration = FLASH_NEAR_SCALE * (1 - d / FLASH_RADIUS) + FLASH_BASE;
          ai._blindT = duration;
          core.emit("enemy:blinded", { entityId: id, duration });
        }
      }
    });
  }

  system.wireListeners = wireListeners;
  return system;
}

export default { createEnemyBlindSystem, FLASH_RADIUS, FLASH_NEAR_SCALE, FLASH_BASE };
