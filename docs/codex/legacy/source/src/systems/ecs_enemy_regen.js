/**
 * ecs_enemy_regen.js — Enemy out-of-combat HP regeneration for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7707-7721:
 *   Line 7709: skip if dead or at maxHp
 *   Line 7710: recentDmg = _hpBarShowT && elapsed - _hpBarShowT < 8s
 *   Line 7711: !recentDmg && !_wasChasing → regen
 *   Line 7712: hp += 4 * dt (4 HP/s)
 *   Line 7715: visual tick every 1.8s → "+HP" float event
 *
 * Events emitted on Core:
 *   "enemy:regen_tick" { entityId, amount }  — fired every REGEN_DISPLAY_INTERVAL
 *
 * Usage:
 *   const sys = createEnemyRegenSystem();
 *   Core.addSystem(sys, 8, "enemy_regen"); // before AI:12
 */

export const ENEMY_REGEN_RATE          = 4;    // monolith line 7712: 4 HP/s
export const ENEMY_REGEN_OOC_DELAY     = 8;    // monolith line 7710: 8s since last damage
export const ENEMY_REGEN_DISPLAY_INTERVAL = 1.8; // monolith line 7715: "+HP" float every 1.8s

/**
 * createEnemyRegenSystem() → system function
 */
export function createEnemyRegenSystem() {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    for (const id of enemies) {
      const h  = core.getComponent(id, "Health");
      const ai = core.getComponent(id, "EnemyAI");
      if (!h || !ai) continue;
      if (h.hp <= 0) continue;
      if (h.hp >= h.maxHp) continue;

      const recentDmg = ai._hpBarShowT != null && (_elapsed - ai._hpBarShowT) < ENEMY_REGEN_OOC_DELAY;
      const chasing   = !!ai._wasChasing;

      if (recentDmg || chasing) {
        ai._regenT = 0;
        continue;
      }

      h.hp = Math.min(h.maxHp, h.hp + ENEMY_REGEN_RATE * dt);

      ai._regenT = (ai._regenT ?? 0) - dt;
      if (ai._regenT <= 0) {
        ai._regenT = ENEMY_REGEN_DISPLAY_INTERVAL;
        core.emit("enemy:regen_tick", { entityId: id, amount: ENEMY_REGEN_RATE });
      }
    }
  }

  return system;
}

export default {
  createEnemyRegenSystem,
  ENEMY_REGEN_RATE, ENEMY_REGEN_OOC_DELAY, ENEMY_REGEN_DISPLAY_INTERVAL,
};
