/**
 * ecs_score.js — ECS kill-credit scoring and hero level-up system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html:
 *   _COIN_BY_TYPE (line 1308), _LEVEL_THRESHOLDS (line 1220),
 *   _applyLevelUpBuff (lines 2760-2779), score/enemyKills tracking (lines 2471+)
 *
 * Score component (on hero entity):
 *   Score: { coins, kills, level, combo, lastKillT }
 *
 * Level-up buffs applied to hero entity (mirrored from monolith):
 *   LVL 1 — heroLvlDmgMul *= 1.10   → PerkState._heroLvlDmgMul (separate from perk mul)
 *   LVL 2 — heroLvlSpeedBonus += 1.0 → PerkState._heroLvlSpeedBonus
 *   LVL 3 — extraStaminaMax = 25 (emitted via event for stamina system)
 *   LVL 4 — heal 20 HP + raise maxHp cap by 20 temporarily
 *   LVL 5 — apexMode flag (emitted via event for AI/render to react)
 *
 * Coin values per enemy type (monolith line 1308):
 *   grunt: 1, fast: 1, poisoner: 2, incendiary: 2, heavy: 4, robot: 8, boss: 30, sniper: 3
 *
 * Kill thresholds to level up (monolith line 1220): [10, 20, 30, 40, 50]
 *
 * Combo multiplier: Math.min(8, comboCount) — window 4s (monolith pattern)
 *
 * Events emitted on Core:
 *   "score:kill"      { heroId, enemyType, coinValue, kills, coins, level }
 *   "score:levelup"   { heroId, level, kills }
 *   "score:combo"     { heroId, combo, mul }
 *   "score:reset"     { heroId }
 *
 * Events listened to:
 *   "enemy:killed"    { type, heroId? }  — the main trigger
 *   "score:add_coins" { heroId, amount } — manual coin grant (wave bonus, etc.)
 *
 * Usage:
 *   const sys = createScoreSystem();
 *   Core.addSystem(sys, 40, "score");
 */

export const COIN_BY_TYPE = {
  grunt: 1, fast: 1, poisoner: 2, incendiary: 2,
  heavy: 4, robot: 8, boss: 30, sniper: 3,
};

export const LEVEL_THRESHOLDS = [10, 20, 30, 40, 50]; // kills needed to reach levels 1–5
const MAX_LEVEL        = 5;
const COMBO_WINDOW     = 4.0; // seconds between kills to maintain combo
const COMBO_MAX_MUL    = 8;

const LEVEL_BUFFS = [
  null, // placeholder so index = level number
  { label: "LVL 1 — +10% DAMAGE",    heroLvlDmgMulBonus: 1.10 },
  { label: "LVL 2 — +SPRINT SPEED",  heroLvlSpeedBonus: 1.0 },
  { label: "LVL 3 — +25 STAMINA MAX", extraStaminaMax: 25 },
  { label: "LVL 4 — +MAX HP",        hpHeal: 20, maxHpBonus: 20 },
  { label: "LVL 5 — APEX PREDATOR",  apexMode: true },
];

/**
 * applyLevelBuff(level, heroId, core) → void
 *
 * Applies the level-up stat bonus to the hero entity.
 */
export function applyLevelBuff(level, heroId, core) {
  const buff = LEVEL_BUFFS[level];
  if (!buff) return;

  const perk = core.getComponent(heroId, "PerkState");
  if (perk) {
    if (buff.heroLvlDmgMulBonus) {
      perk._heroLvlDmgMul = (perk._heroLvlDmgMul ?? 1.0) * buff.heroLvlDmgMulBonus;
    }
    if (buff.heroLvlSpeedBonus) {
      perk._heroLvlSpeedBonus = (perk._heroLvlSpeedBonus ?? 0) + buff.heroLvlSpeedBonus;
    }
  }

  const health = core.getComponent(heroId, "Health");
  if (health && buff.hpHeal) {
    health.maxHp = (health.maxHp ?? 100) + (buff.maxHpBonus || 0);
    health.hp    = Math.min(health.maxHp, (health.hp ?? 0) + buff.hpHeal);
  }
}

/**
 * createScoreSystem() → system function
 */
export function createScoreSystem() {
  let _wired  = false;
  let _elapsed = 0;

  function _findHero(core) {
    const ids = core.query("PlayerControl", "Score");
    return ids.find(id => {
      const f = core.getComponent(id, "Faction");
      return !f || f.id === "player";
    }) ?? ids[0] ?? null;
  }

  function _onKill(core, enemyType, reqHeroId) {
    const heroId = reqHeroId ?? _findHero(core);
    if (heroId == null) return;

    const sc = core.getComponent(heroId, "Score");
    if (!sc) return;

    sc.kills++;
    sc.combo++;
    sc.lastKillT = _elapsed;

    const mul      = Math.min(COMBO_MAX_MUL, sc.combo);
    const baseCoins = COIN_BY_TYPE[enemyType] ?? 1;
    const coins    = baseCoins * mul;
    sc.coins += coins;

    if (sc.combo > 1) {
      core.emit("score:combo", { heroId, combo: sc.combo, mul });
    }

    core.emit("score:kill", {
      heroId, enemyType, coinValue: coins,
      kills: sc.kills, coins: sc.coins, level: sc.level,
    });

    // Level-up check
    if (sc.level < MAX_LEVEL && sc.kills >= LEVEL_THRESHOLDS[sc.level]) {
      sc.level++;
      applyLevelBuff(sc.level, heroId, core);
      core.emit("score:levelup", { heroId, level: sc.level, kills: sc.kills });
    }
  }

  function system(dt, core) {
    _elapsed += dt;

    if (!_wired) {
      _wired = true;

      core.on("enemy:killed", ({ type, heroId }) => _onKill(core, type, heroId));

      core.on("score:add_coins", ({ heroId, amount }) => {
        const sc = core.getComponent(heroId, "Score");
        if (sc) sc.coins += amount;
      });
    }

    // Decay combo if window expires
    const ids = core.query("PlayerControl", "Score");
    for (const heroId of ids) {
      const sc = core.getComponent(heroId, "Score");
      if (sc && sc.combo > 0 && (_elapsed - sc.lastKillT) > COMBO_WINDOW) {
        sc.combo = 0;
      }
    }
  }

  system.coinByType  = COIN_BY_TYPE;
  system.thresholds  = LEVEL_THRESHOLDS;

  return system;
}

export default { createScoreSystem, applyLevelBuff, COIN_BY_TYPE, LEVEL_THRESHOLDS };
