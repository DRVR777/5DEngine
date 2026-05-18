/**
 * ecs_enrage.js — Enemy enrage + low-HP behavior system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7101-7111:
 *   Line 7102: hpFrac threshold = 0.25
 *   Line 7104: boss/heavy speed ×1.35 (enrage); others ×0.55 (weakened)
 *   Line 7106: _enraged flag set once on first crossing
 *
 * Behavior:
 *   - Boss + Heavy at < 25% HP: speed ×1.35 (ENRAGE)
 *   - All other types at < 25% HP: speed ×0.55 (WEAKENED — slowed down)
 *   - Above 25% HP: base speed restored
 *
 * This system directly mutates EnemyAI.moveSpeed each tick (reversible via
 * EnemyAI._baseMoveSpeed cache), so ecs_ai_movement.js picks up the change
 * without modification.
 *
 * Events emitted on Core:
 *   "enemy:enraged"  { entityId, type } — once per enemy, on first HP crossing
 *   "enemy:weakened" { entityId, type } — once per enemy, on first HP crossing (non-boss/heavy)
 *
 * Usage:
 *   const sys = createEnrageSystem();
 *   Core.addSystem(sys, 13, "enrage"); // after ai_movement:12, before status:15
 */

export const ENRAGE_HP_FRAC     = 0.25;  // monolith line 7102
export const ENRAGE_SPEED_MUL   = 1.35;  // monolith line 7104 — boss + heavy
export const WEAKENED_SPEED_MUL = 0.55;  // monolith line 7104 — all other types

const ENRAGEABLE_TYPES = new Set(["boss", "heavy"]);

/**
 * createEnrageSystem() → system function
 */
export function createEnrageSystem() {
  function system(dt, core) {
    const enemies = core.query("EnemyAI", "Health");

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const h  = core.getComponent(id, "Health");
      if (!ai || !h || h.hp <= 0) continue;

      // Cache base speed once (on first tick this enemy is seen)
      if (ai._baseMoveSpeed == null) {
        ai._baseMoveSpeed = ai.moveSpeed;
      }

      const hpFrac = h.hp / (h.maxHp || 1);
      const isEnrageable = ENRAGEABLE_TYPES.has(ai.type);

      if (hpFrac < ENRAGE_HP_FRAC) {
        const mul = isEnrageable ? ENRAGE_SPEED_MUL : WEAKENED_SPEED_MUL;
        ai.moveSpeed = ai._baseMoveSpeed * mul;

        // First crossing — announce
        if (isEnrageable && !ai._enraged) {
          ai._enraged = true;
          core.emit("enemy:enraged", { entityId: id, type: ai.type });
        } else if (!isEnrageable && !ai._weakened) {
          ai._weakened = true;
          core.emit("enemy:weakened", { entityId: id, type: ai.type });
        }
      } else {
        // Above threshold — restore base speed
        ai.moveSpeed = ai._baseMoveSpeed;
      }
    }
  }

  return system;
}

export default { createEnrageSystem, ENRAGE_HP_FRAC, ENRAGE_SPEED_MUL, WEAKENED_SPEED_MUL };
