/**
 * ecs_combat.js — ECS combat system for 5DEngine
 *
 * Ported faithfully from 5DEngineMassive/index.html lines 6600-6650 (player→enemy)
 * and 7494-7534 (enemy melee→hero).
 *
 * This file exports two things:
 *   applyPlayerDamage — pure function, no ECS dependency, safe to unit-test
 *   combatSystem      — ECS system fn: (dt, core, ctx) => void
 *
 * What this system handles:
 *   - Enemy melee attacks on the hero entity (when state==="attack", in attackRange, cooldown elapsed)
 *   - Armor absorption (ARMOR_ABSORB = 0.6 from tuning/hero.json)
 *   - Emits "hero:damaged" and "hero:died" on the core event bus
 *
 * What is NOT handled here (monolith owns it until bullets become ECS entities):
 *   - Player bullet → enemy damage (use applyPlayerDamage standalone in the bullet loop)
 *   - Ranged enemy projectiles (poisoner spit, sniper shot, heavy grenade)
 *   - Status effects (poison, burning) — handled by src/systems/status_effects.js
 */

// ── Constants (mirror monolith lines 1536, 7062) ──────────────────────────────
const ARMOR_ABSORB = 0.6;   // fraction of each hit absorbed by armor before HP
const ATTACK_CD    = 1.0;   // seconds between enemy melee swings
// attackCD is stored on EnemyAI.lastAttackT as seconds-since-epoch elapsed.
// Initial value is -99 so the first swing triggers immediately on contact.

// ── applyPlayerDamage ─────────────────────────────────────────────────────────
/**
 * Pure damage formula — mirrors monolith line 6607.
 * Returns the final integer damage dealt (clamped ≥ 0).
 *
 * @param {number} rawDamage        - base weapon damage
 * @param {string} weaponId         - "pistol"|"shotgun"|"rifle"|"smg"|"sniper"
 * @param {string} enemyType        - enemy.$id, e.g. "heavy", "robot"
 * @param {object} damageMultipliers - $facets from damage_multipliers.json
 *                                     (keyed by enemyType → {weaponId: multiplier})
 * @param {object} [modifiers]      - optional hit modifiers
 * @param {boolean} [modifiers.headshot]
 * @param {boolean} [modifiers.backstab]
 * @param {boolean} [modifiers.frontalBlock] - boss/heavy frontal armor
 * @param {boolean} [modifiers.crit]
 * @param {number}  [modifiers.heroLvlDmgMul=1.0]
 * @param {number}  [modifiers.perkDmgMul=1.0]
 * @param {number}  [modifiers.falloffMul=1.0]
 * @returns {number} integer damage
 */
export function applyPlayerDamage(rawDamage, weaponId, enemyType, damageMultipliers, modifiers = {}) {
  const {
    headshot = false,
    backstab = false,
    frontalBlock = false,
    crit = false,
    heroLvlDmgMul = 1.0,
    perkDmgMul = 1.0,
    falloffMul = 1.0,
  } = modifiers;

  const wResist = (damageMultipliers[enemyType] || {})[weaponId] ?? 1.0;

  const modMul = headshot      ? 1.85
               : backstab      ? 1.50
               : frontalBlock  ? 0.50
               : crit          ? 2.50
               : 1.0;

  return Math.max(0, Math.round(rawDamage * modMul * wResist * heroLvlDmgMul * perkDmgMul * falloffMul));
}

// ── combatSystem ─────────────────────────────────────────────────────────────
/**
 * ECS system — runs enemy melee attacks on the hero every fixed tick (dt = 1/60s).
 * Register via Core.addSystem(combatSystem, 10, "combat").
 *
 * ctx must carry:
 *   ctx.damageMultipliers — $facets from damage_multipliers.json (load once at boot)
 *   ctx.elapsedS          — total game time in seconds (used for attack cooldown)
 *
 * Emits:
 *   "hero:damaged"  { amount, sourceId }
 *   "hero:died"     { killedBy }
 */
export function combatSystem(dt, core, ctx) {
  if (!ctx || !ctx.damageMultipliers) return;

  // Find hero — there should be exactly one entity with PlayerControl + Health
  const heroIds = core.query("PlayerControl", "Health", "Transform");
  if (!heroIds.length) return;
  const heroId = heroIds[0];
  const heroHealth = core.getComponent(heroId, "Health");
  const heroPos    = core.getComponent(heroId, "Transform");
  if (!heroHealth || !heroPos) return;
  if (heroHealth.hp <= 0) return;  // already dead

  const enemies = core.query("EnemyAI", "Transform", "Health", "Faction");
  for (const id of enemies) {
    const faction = core.getComponent(id, "Faction");
    if (faction.id !== "enemy") continue;

    const ai  = core.getComponent(id, "EnemyAI");
    const pos = core.getComponent(id, "Transform");
    const hp  = core.getComponent(id, "Health");
    if (!ai || !pos || !hp) continue;
    if (hp.hp <= 0) continue;  // dead enemy

    // Cooldown check: lastAttackT starts at -99, holds elapsed-seconds timestamp
    const elapsed = (ctx.elapsedS || 0);
    if (elapsed - ai.lastAttackT < ATTACK_CD) continue;

    // Distance check
    const dist = Math.hypot(heroPos.u - pos.u, heroPos.v - pos.v);
    if (dist > (ai.attackRange || 1.8)) continue;

    // Commit attack
    ai.lastAttackT = elapsed;

    // Armor absorb — mirrors monolith lines 7499-7503
    let dmg = ai.damage || 6;
    if (heroHealth.armor > 0) {
      const armorHit = Math.min(heroHealth.armor, dmg * ARMOR_ABSORB);
      heroHealth.armor = Math.max(0, heroHealth.armor - armorHit);
      dmg -= armorHit;
    }
    dmg = Math.max(0, Math.round(dmg));
    heroHealth.hp = Math.max(0, heroHealth.hp - dmg);

    core.emit("hero:damaged", { amount: dmg, sourceId: id, type: ai.type });

    if (heroHealth.hp <= 0) {
      core.emit("hero:died", { killedBy: id });
    }
  }
}

export default { applyPlayerDamage, combatSystem };
