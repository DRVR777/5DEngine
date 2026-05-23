/**
 * ecs_perk.js — ECS perk selection and application system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 1194-1251 (_PERKS + perk apply logic).
 *
 * Perk effect ops:
 *   multiply  — target *= value            (e.g. _perkDmgMul, _perkReloadMul)
 *   add       — target += value            (e.g. _perkSpeedBonus, _perkRegenBonus, heroArmor, _perkMaxHpBonus)
 *   flag      — target = value (boolean)   (e.g. _perkLifesteal)
 *   addItem   — counter += value, capped   (e.g. grenadeCount, smokeGrenadeCount)
 *   addAmmo   — active weapon ammo += value
 *
 * Hero components read/mutated:
 *   PerkState:    { _perkDmgMul, _perkSpeedBonus, _perkRegenBonus, _perkReloadMul,
 *                   _perkMaxHpBonus, _perkLifesteal }
 *   Health:       { hp, maxHp }      — maxhp perk adjusts maxHp + heals 15
 *   Counters:     { grenadeCount, smokeGrenadeCount }
 *   Stats:        { armor, maxArmor }
 *   ActiveWeapon: { ammoItem }       — addAmmo perk looks up current weapon's ammo pool
 *   Inventory:    { items: {} }      — addAmmo mutates here
 *
 * Events emitted on Core:
 *   "perk:offer"    { choices: string[], heroId }  — 3 random perks to display
 *   "perk:applied"  { perkId, perk, heroId }       — perk was applied successfully
 *   "perk:invalid"  { perkId }                     — unknown perkId selected
 *
 * Events listened to:
 *   "wave:end"      { wave }         — triggers perk offer (3 random choices)
 *   "perk:selected" { perkId, heroId? } — player chose a perk from the offer UI
 *
 * Usage:
 *   const sys = createPerkSystem(perkCatalog, { HERO_MAX_ARMOR: 75 });
 *   Core.addSystem(sys, 30, "perk");
 */

const PERK_CHOICES = 3; // number of perks offered per wave clear

/**
 * applyPerk(perk, heroId, core, constants) → void
 *
 * Applies a single perk facets object to the hero entity.
 *
 * @param {object} perk      - The perk's $facets object (including .effect)
 * @param {number} heroId    - Entity ID of the hero
 * @param {object} core      - Core API
 * @param {object} constants - Named constants e.g. { HERO_MAX_ARMOR: 75 }
 */
export function applyPerk(perk, heroId, core, constants = {}) {
  const { effect } = perk;
  if (!effect) return;

  const perkState = core.getComponent(heroId, "PerkState");

  if (effect.op === "multiply" && perkState && effect.target in perkState) {
    perkState[effect.target] *= effect.value;
    return;
  }

  if (effect.op === "add") {
    // heroArmor lives on Stats; everything else lives on PerkState
    if (effect.target === "heroArmor") {
      const stats = core.getComponent(heroId, "Stats");
      if (stats) {
        const cap = typeof effect.max === "string" ? (constants[effect.max] ?? Infinity) : (effect.max ?? Infinity);
        stats.armor = Math.min(cap, (stats.armor || 0) + effect.value);
      }
    } else if (effect.target === "_perkMaxHpBonus") {
      // Resilient perk: raise maxHp ceiling + immediately heal
      if (perkState) perkState._perkMaxHpBonus = (perkState._perkMaxHpBonus || 0) + effect.value;
      const health = core.getComponent(heroId, "Health");
      if (health) {
        health.maxHp = (health.maxHp || 100) + effect.value;
        if (effect.healOnApply) {
          health.hp = Math.min(health.maxHp, (health.hp || 0) + effect.healOnApply);
        }
      }
    } else if (perkState && effect.target in perkState) {
      perkState[effect.target] = (perkState[effect.target] || 0) + effect.value;
    }
    return;
  }

  if (effect.op === "flag" && perkState && effect.target in perkState) {
    perkState[effect.target] = effect.value;
    return;
  }

  if (effect.op === "addItem") {
    const counters = core.getComponent(heroId, "Counters");
    if (counters && effect.target in counters) {
      const cap = typeof effect.max === "string" ? (constants[effect.max] ?? Infinity) : (effect.max ?? Infinity);
      counters[effect.target] = Math.min(cap, (counters[effect.target] || 0) + (effect.value || 0));
    }
    return;
  }

  if (effect.op === "addAmmo") {
    const weapon = core.getComponent(heroId, "ActiveWeapon");
    const inv    = core.getComponent(heroId, "Inventory");
    if (weapon && inv && weapon.ammoItem) {
      if (!inv.items) inv.items = {};
      inv.items[weapon.ammoItem] = (inv.items[weapon.ammoItem] || 0) + (effect.value || 0);
    }
    return;
  }
}

/**
 * createPerkSystem(perkCatalog, constants?) → system function
 *
 * @param {object} perkCatalog - Map of perkId → perk $facets (from atom)
 * @param {object} constants   - Named numeric constants e.g. { HERO_MAX_ARMOR: 75 }
 */
export function createPerkSystem(perkCatalog = {}, constants = { HERO_MAX_ARMOR: 75 }) {
  const _perkIds = Object.keys(perkCatalog);
  let _wired     = false;

  function _findHero(core) {
    const ids = core.query("PlayerControl", "PerkState");
    return ids.find(id => {
      const f = core.getComponent(id, "Faction");
      return !f || f.id === "player";
    }) ?? ids[0] ?? null;
  }

  function _randomChoices(n) {
    const shuffled = _perkIds.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  function system(dt, core) {
    if (_wired) return;
    _wired = true;

    // Offer perks when a wave ends
    core.on("wave:end", () => {
      const heroId = _findHero(core);
      if (heroId == null) return;
      const choices = _randomChoices(PERK_CHOICES);
      core.emit("perk:offer", { choices, heroId });
    });

    // Apply chosen perk
    core.on("perk:selected", ({ perkId, heroId: reqHeroId }) => {
      const heroId = reqHeroId ?? _findHero(core);
      if (heroId == null) return;

      const perk = perkCatalog[perkId];
      if (!perk) {
        core.emit("perk:invalid", { perkId });
        return;
      }

      applyPerk(perk, heroId, core, constants);
      core.emit("perk:applied", { perkId, perk, heroId });
    });
  }

  system.catalog = perkCatalog;

  return system;
}

export default { createPerkSystem, applyPerk };
