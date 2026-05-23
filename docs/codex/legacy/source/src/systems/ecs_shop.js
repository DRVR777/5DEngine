/**
 * ecs_shop.js — ECS shop purchase system for 5DEngine
 *
 * Ported from 5DEngineMassive/index.html lines 1936-2001 (_SHOP_ITEMS + _openShop/_renderShopGrid).
 *
 * Pure data layer only — UI rendering stays in index.html until the render
 * system is extracted.
 *
 * Usage:
 *   const shopSys = createShopSystem(shopAtom.$facets, { HERO_MAX_ARMOR: 75 });
 *   Core.addSystem(shopSys, 25, "shop");   // priority 25 (after pickup)
 *   shopSys.buy(core, heroId, "ammo_pistol");
 *
 * Hero components read/mutated:
 *   Score:     { coins }                           — currency
 *   Inventory: { items: { [itemId]: qty } }        — addItem effects
 *   Counters:  { grenadeCount, smokeGrenadeCount, flashbangCount, _mineCount }
 *   Stats:     { armor, maxArmor }                 — addClamped / armor effects
 *
 * Events emitted on Core:
 *   "shop:bought"         { itemId, item, remainingCoins, heroId }
 *   "shop:insufficient"   { itemId, cost, have, heroId }
 *   "shop:unknown_item"   { itemId }
 *
 * Listening for purchases via event bus (preferred for UI → logic decoupling):
 *   Core.emit("shop:buy", { heroId, itemId });
 */

/**
 * applyShopEffect(effect, heroId, core, constants) → void
 *
 * Applies a single effect descriptor to the hero entity.
 * Supports ops: addItem, addCounter, addClamped, set, bundle.
 *
 * @param {object} effect    - The $facets.effect object from the shop item atom
 * @param {number} heroId    - Entity ID of the hero
 * @param {object} core      - Core API
 * @param {object} constants - Named constant values (e.g. { HERO_MAX_ARMOR: 75 })
 */
export function applyShopEffect(effect, heroId, core, constants = {}) {
  if (!effect) return;

  if (effect.op === "bundle") {
    for (const action of (effect.actions || [])) {
      applyShopEffect(action, heroId, core, constants);
    }
    return;
  }

  if (effect.op === "addItem") {
    const inv = core.getComponent(heroId, "Inventory");
    if (inv) {
      if (!inv.items) inv.items = {};
      inv.items[effect.item] = (inv.items[effect.item] || 0) + (effect.qty || 1);
    }
    return;
  }

  if (effect.op === "addCounter") {
    const counters = core.getComponent(heroId, "Counters");
    if (counters && effect.target in counters) {
      const cap = typeof effect.max === "string" ? (constants[effect.max] ?? Infinity) : (effect.max ?? Infinity);
      counters[effect.target] = Math.min(cap, counters[effect.target] + (effect.value || 0));
    }
    return;
  }

  if (effect.op === "addClamped") {
    const stats = core.getComponent(heroId, "Stats");
    if (stats && effect.target in stats) {
      const cap = typeof effect.max === "string" ? (constants[effect.max] ?? Infinity) : (effect.max ?? Infinity);
      stats[effect.target] = Math.min(cap, stats[effect.target] + (effect.value || 0));
    }
    return;
  }

  if (effect.op === "set") {
    const counters = core.getComponent(heroId, "Counters");
    if (counters && effect.target in counters) {
      counters[effect.target] = effect.value;
    }
    return;
  }
}

/**
 * tryBuy(shopItems, heroId, itemId, core, constants) → { ok, reason }
 *
 * Validates and applies a purchase. Does NOT emit events — callers emit.
 * Returns { ok: true } or { ok: false, reason: string }.
 */
export function tryBuy(shopItems, heroId, itemId, core, constants = {}) {
  const item = shopItems[itemId];
  if (!item) return { ok: false, reason: "unknown_item" };

  const score = core.getComponent(heroId, "Score");
  if (!score) return { ok: false, reason: "no_score_component" };

  const coins = score.coins ?? 0;
  if (coins < item.cost) return { ok: false, reason: "insufficient", cost: item.cost, have: coins };

  score.coins = coins - item.cost;
  applyShopEffect(item.effect, heroId, core, constants);
  return { ok: true, item };
}

/**
 * createShopSystem(shopItems, constants?) → system function with .buy() helper
 *
 * @param {object} shopItems  - Map of itemId → item descriptor (from atom $facets)
 * @param {object} constants  - Named numeric constants e.g. { HERO_MAX_ARMOR: 75 }
 */
export function createShopSystem(shopItems = {}, constants = { HERO_MAX_ARMOR: 75 }) {
  let _wired = false;

  function _findHero(core) {
    const ids = core.query("PlayerControl", "Score");
    return ids.find(id => {
      const f = core.getComponent(id, "Faction");
      return !f || f.id === "player";
    }) ?? ids[0] ?? null;
  }

  function system(dt, core) {
    if (_wired) return;
    _wired = true;

    // Wire the "shop:buy" event listener once — event-driven, not polled
    core.on("shop:buy", ({ heroId: reqHeroId, itemId }) => {
      const heroId = reqHeroId ?? _findHero(core);
      if (heroId == null) return;

      if (!shopItems[itemId]) {
        core.emit("shop:unknown_item", { itemId });
        return;
      }

      const result = tryBuy(shopItems, heroId, itemId, core, constants);
      if (result.ok) {
        const score = core.getComponent(heroId, "Score");
        core.emit("shop:bought", { itemId, item: result.item, remainingCoins: score?.coins ?? 0, heroId });
      } else if (result.reason === "insufficient") {
        core.emit("shop:insufficient", { itemId, cost: result.cost, have: result.have, heroId });
      } else {
        core.emit("shop:unknown_item", { itemId });
      }
    });
  }

  system.buy = function (core, heroId, itemId) {
    core.emit("shop:buy", { heroId, itemId });
  };

  system.catalog = shopItems;

  return system;
}

export default { createShopSystem, tryBuy, applyShopEffect };
