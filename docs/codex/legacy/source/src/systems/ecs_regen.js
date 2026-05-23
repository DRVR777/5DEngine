/**
 * ecs_regen.js — Hero passive HP regeneration system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 7709-7712.
 *
 * Logic: after REGEN_DELAY seconds of no damage, the hero regenerates
 * (REGEN_RATE + perkRegenBonus) HP per second, capped at maxHp.
 *
 * Entity components read:
 *   Health:    { hp, maxHp, lastDamageT }   — lastDamageT = seconds timestamp of last hit
 *   PerkState: { _perkRegenBonus, _perkMaxHpBonus }  — optional, defaults to 0
 *
 * Events emitted on Core:
 *   "hero:regen" { heroId, gained, hp }   — emitted each tick where HP increased
 *
 * Usage:
 *   Core.addSystem(regenSystem, 35, "regen");  // after perk(30)
 *
 * When a hero takes damage, the caller must set:
 *   health.lastDamageT = currentTimeSeconds
 * The combatSystem already does this via "hero:damaged" — or set it directly.
 *
 * REGEN_DELAY = 5s, REGEN_RATE = 4 HP/s — mirrored from monolith lines 1530-1531.
 */

const REGEN_DELAY = 5;   // seconds of no damage before regen kicks in
const REGEN_RATE  = 4;   // base HP/s restored

let _elapsed = 0; // tracks wall-clock time since boot (seconds)

/**
 * regenSystem(dt, core) — ECS system function, priority 35.
 */
export function regenSystem(dt, core) {
  _elapsed += dt;

  const heroIds = core.query("PlayerControl", "Health");
  for (const heroId of heroIds) {
    const health = core.getComponent(heroId, "Health");
    if (!health) continue;

    const maxHp = health.maxHp ?? 100;
    if (health.hp >= maxHp) continue; // already full

    const lastDmg = health.lastDamageT ?? -Infinity;
    if ((_elapsed - lastDmg) <= REGEN_DELAY) continue; // still in damage window

    const perk = core.getComponent(heroId, "PerkState");
    const bonus = perk ? (perk._perkRegenBonus || 0) : 0;

    const rate   = REGEN_RATE + bonus;
    const gained = Math.min(rate * dt, maxHp - health.hp);
    health.hp += gained;

    if (gained > 0) {
      core.emit("hero:regen", { heroId, gained, hp: health.hp });
    }
  }
}

export default { regenSystem };
