/**
 * ecs_stagger_movement.js — Enemy stagger spin movement for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7168-7178 (grenade stagger):
 *   Line 7171: _staggerAngle advances at PI*4 rad/s
 *   Line 7174: movement at moveSpeed * 0.35 in spin direction
 *   Line 7176: rotation.z = sin(now/70)*0.35 (VFX — emitted as event)
 *
 * Trigger: entity has "Stagger" component (set by ecs_knockback via grenade:stagger)
 * Duration: managed by ecs_knockback (removes Stagger when remaining <= 0)
 *
 * This system only handles spin movement during the stagger window.
 * ecs_ai_movement must skip entities with Stagger active (guard added there).
 *
 * Events emitted on Core:
 *   "enemy:staggering" { entityId, angle }  — each tick for VFX tilt
 *
 * Usage:
 *   const sys = createStaggerMovementSystem();
 *   Core.addSystem(sys, 13, "stagger_movement"); // after ai_movement:12, same priority as others
 */

export const STAGGER_SPIN_RATE = Math.PI * 4;   // monolith line 7171: dt * PI*4
export const STAGGER_MOVE_MUL  = 0.35;           // monolith line 7174: moveSpeed * 0.35

/**
 * createStaggerMovementSystem() → system function
 */
export function createStaggerMovementSystem() {

  function system(dt, core) {
    const ids = core.query("Stagger", "EnemyAI", "Transform", "Health");
    if (!ids.length) return;

    for (const id of ids) {
      const s  = core.getComponent(id, "Stagger");
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!s || !ai || !t || !h) continue;
      if (h.hp <= 0) continue;

      // Advance spin angle
      if (ai._staggerAngle == null) ai._staggerAngle = 0;
      ai._staggerAngle += dt * STAGGER_SPIN_RATE;

      const spd = (ai.moveSpeed ?? 2.4) * STAGGER_MOVE_MUL;
      t.u += Math.sin(ai._staggerAngle) * spd * dt;
      t.v += Math.cos(ai._staggerAngle) * spd * dt;

      core.emit("enemy:staggering", { entityId: id, angle: ai._staggerAngle });
    }
  }

  return system;
}

export default {
  createStaggerMovementSystem,
  STAGGER_SPIN_RATE,
  STAGGER_MOVE_MUL,
};
