/**
 * ecs_melee_attack.js — Enemy melee attack + strafe system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7479-7534 (BT onAttack callback):
 *   Line 7062:  attackCD = 1.0s (BT setup param)
 *   Line 7481:  strafe skips sniper/boss/robot/heavy
 *   Line 7485:  strafeDur = 1.2 + rand*1.3
 *   Line 7489:  strafeSpeed = moveSpeed * 0.5
 *   Line 7517:  poisoner 55% chance → "poison" status
 *   Line 7518:  incendiary 45% chance → "burning" status
 *   Line 7528:  heavy knockback 9m/s, boss 14m/s
 *   Line 7531:  knockback duration 0.22s
 *
 * Events emitted on Core:
 *   "enemy:melee_hit"      { entityId, damage, type }
 *   "enemy:melee_knockback"{ entityId, dirU, dirV, speed, duration }
 *   "status:apply"         { targetId, effect, sourceId }
 *
 * Usage:
 *   const sys = createMeleeAttackSystem();
 *   Core.addSystem(sys, 14, "melee_attack"); // after ai_movement:12
 */

export const MELEE_ATTACK_CD       = 1.0;   // monolith BT line 7062: attackCD
export const MELEE_STRAFE_SPD_MUL  = 0.5;   // monolith line 7489: moveSpeed * 0.5
export const MELEE_STRAFE_DUR_MIN  = 1.2;   // monolith line 7485
export const MELEE_STRAFE_DUR_RAND = 1.3;   // monolith line 7485
export const MELEE_KB_HEAVY_SPD    = 9;     // monolith line 7528
export const MELEE_KB_BOSS_SPD     = 14;    // monolith line 7528
export const MELEE_KB_DUR          = 0.22;  // monolith line 7531
export const MELEE_POISON_CHANCE   = 0.55;  // monolith line 7517
export const MELEE_BURNING_CHANCE  = 0.45;  // monolith line 7518

// Types that do NOT strafe (monolith line 7481)
export const MELEE_NO_STRAFE_TYPES = ["sniper", "boss", "robot", "heavy"];
const _noStrafe = new Set(MELEE_NO_STRAFE_TYPES);

/**
 * createMeleeAttackSystem() → system function
 */
export function createMeleeAttackSystem() {
  let _elapsed = 0;

  function system(dt, core) {
    _elapsed += dt;

    const enemies = core.query("EnemyAI", "Transform", "Health");
    if (!enemies.length) return;

    const heroIds = core.query("PlayerControl", "Transform", "Health");
    const heroId  = heroIds[0] ?? null;
    const heroT   = heroId != null ? core.getComponent(heroId, "Transform") : null;
    const heroH   = heroId != null ? core.getComponent(heroId, "Health") : null;

    for (const id of enemies) {
      const ai = core.getComponent(id, "EnemyAI");
      const t  = core.getComponent(id, "Transform");
      const h  = core.getComponent(id, "Health");
      if (!ai || !t || !h) continue;
      if (h.hp <= 0) continue;
      if (!heroT || !heroH || heroH.hp <= 0) continue;

      const dist = Math.hypot(heroT.u - t.u, heroT.v - t.v);
      const canSee = dist <= (ai.sightRange ?? 12);
      if (!canSee) continue;

      const attackRange = ai.attackRange ?? 1.8;
      if (dist > attackRange) continue;

      // Strafe — light enemies orbit hero perpendicularly while in melee range
      if (!_noStrafe.has(ai.type)) {
        if (ai._strafeSwitchT == null || _elapsed - ai._strafeSwitchT > (ai._strafeDur ?? 1.5)) {
          ai._strafeSwitchT = _elapsed;
          ai._strafeDir     = Math.random() < 0.5 ? 1 : -1;
          ai._strafeDur     = MELEE_STRAFE_DUR_MIN + Math.random() * MELEE_STRAFE_DUR_RAND;
        }
        const heroAng = Math.atan2(heroT.u - t.u, heroT.v - t.v);
        const perpAng = heroAng + Math.PI * 0.5 * ai._strafeDir;
        const sSpd    = (ai.moveSpeed ?? 2.4) * MELEE_STRAFE_SPD_MUL;
        t.u += Math.sin(perpAng) * sSpd * dt;
        t.v += Math.cos(perpAng) * sSpd * dt;
      }

      // Melee hit — cooldown gated
      const lastHit = ai._meleeAttackT ?? -999;
      if (_elapsed - lastHit < MELEE_ATTACK_CD) continue;

      ai._meleeAttackT = _elapsed;

      core.emit("enemy:melee_hit", {
        entityId: id,
        damage:   ai.damage ?? 6,
        type:     ai.type,
      });

      // Knockback for heavy/boss
      if (ai.type === "heavy" || ai.type === "boss") {
        const dx  = heroT.u - t.u;
        const dz  = heroT.v - t.v;
        const mag = Math.hypot(dx, dz) || 1;
        core.emit("enemy:melee_knockback", {
          entityId: id,
          dirU:     dx / mag,
          dirV:     dz / mag,
          speed:    ai.type === "boss" ? MELEE_KB_BOSS_SPD : MELEE_KB_HEAVY_SPD,
          duration: MELEE_KB_DUR,
        });
      }

      // Type-specific status effects
      if (ai.type === "poisoner" && Math.random() < MELEE_POISON_CHANCE) {
        core.emit("status:apply", { targetId: heroId, effect: "poison",   sourceId: id });
      }
      if (ai.type === "incendiary" && Math.random() < MELEE_BURNING_CHANCE) {
        core.emit("status:apply", { targetId: heroId, effect: "burning",  sourceId: id });
      }
    }
  }

  return system;
}

export default {
  createMeleeAttackSystem,
  MELEE_ATTACK_CD, MELEE_STRAFE_SPD_MUL,
  MELEE_STRAFE_DUR_MIN, MELEE_STRAFE_DUR_RAND,
  MELEE_KB_HEAVY_SPD, MELEE_KB_BOSS_SPD, MELEE_KB_DUR,
  MELEE_POISON_CHANCE, MELEE_BURNING_CHANCE,
  MELEE_NO_STRAFE_TYPES,
};
