/**
 * ecs_arena_clamp.js — Arena boundary enforcement for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html line 7589-7592:
 *   const _AR = 27.5;
 *   if (Math.abs(_epc.u) > _AR || Math.abs(_epc.v) > _AR)
 *     clamp to [-27.5, 27.5] on both axes
 *
 * Safety net applied after all movement systems — prevents any entity from
 * escaping the arena regardless of physics/AI bugs. Runs on every entity
 * with Transform + EnemyAI (hero movement is handled by ecs_player_movement).
 *
 * Events emitted on Core:
 *   "arena:clamped" { entityId, prevU, prevV } — when a clamp is applied
 *
 * Usage:
 *   const sys = createArenaClampSystem();
 *   Core.addSystem(sys, 16, "arena_clamp"); // last AI system — after all movement
 */

export const ARENA_RADIUS = 27.5;  // monolith line 7589: _AR = 27.5

/**
 * createArenaClampSystem() → system function
 */
export function createArenaClampSystem() {
  function system(dt, core) {
    const entities = core.query("EnemyAI", "Transform");

    for (const id of entities) {
      const t = core.getComponent(id, "Transform");
      if (!t) continue;

      if (Math.abs(t.u) > ARENA_RADIUS || Math.abs(t.v) > ARENA_RADIUS) {
        const prevU = t.u;
        const prevV = t.v;
        t.u = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, t.u));
        t.v = Math.max(-ARENA_RADIUS, Math.min(ARENA_RADIUS, t.v));
        core.emit("arena:clamped", { entityId: id, prevU, prevV });
      }
    }
  }

  return system;
}

export default {
  createArenaClampSystem,
  ARENA_RADIUS,
};
