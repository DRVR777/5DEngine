/**
 * ecs_inventory.js — ECS-native inventory helpers and system for 5DEngine
 *
 * Wraps the flat Inventory component used by ecs_weapon, ecs_shop, ecs_perk.
 * The component is a plain object: Inventory = { items: { [itemId]: qty } }
 *
 * This module provides:
 *   1. Pure helper functions (invAdd, invRemove, invCount, invHas, invClear)
 *      that operate directly on an Inventory component object — usable by any
 *      system without going through the event bus.
 *   2. createInventorySystem() — wires event-bus ops so systems can mutate
 *      inventory via events rather than direct component access.
 *
 * Ported from src/systems/inventory.js (GTAInventory) monolith wrapper:
 *   addItem  → invAdd
 *   removeItem → invRemove
 *   countItem  → invCount
 *
 * Component shape (on hero and any entity that holds items):
 *   Inventory: { items: {} }   — itemId string → qty number (always >= 0)
 *
 * Events listened to (on Core):
 *   "inventory:add"    { entityId, item, qty }
 *   "inventory:remove" { entityId, item, qty }
 *
 * Events emitted (on Core):
 *   "inventory:changed" { entityId, item, qty, delta }  — after any mutation
 *   "inventory:empty"   { entityId, item }               — when qty drops to 0
 *
 * Usage:
 *   import { invAdd, invCount, createInventorySystem } from "./ecs_inventory.js";
 *   // Helpers used directly by other systems:
 *   invAdd(inv, "medkit", 2);
 *   const n = invCount(inv, "pistol_9mm");
 *   // Or via event bus:
 *   const sys = createInventorySystem();
 *   Core.addSystem(sys, 5, "inventory");
 */

// ── Pure helpers — operate on the Inventory component object ─────────────────

/** Add qty of item to inv. Clamps at zero. Returns new qty. */
export function invAdd(inv, item, qty = 1) {
  if (!inv || qty <= 0) return invCount(inv, item);
  inv.items[item] = (inv.items[item] || 0) + qty;
  return inv.items[item];
}

/** Remove qty of item from inv. Clamps at zero. Returns qty actually removed. */
export function invRemove(inv, item, qty = 1) {
  if (!inv || qty <= 0) return 0;
  const have   = inv.items[item] || 0;
  const removed = Math.min(have, qty);
  inv.items[item] = have - removed;
  if (inv.items[item] === 0) delete inv.items[item];
  return removed;
}

/** Return current qty of item (0 if absent). */
export function invCount(inv, item) {
  if (!inv) return 0;
  return inv.items[item] || 0;
}

/** Return true if inv has at least qty of item. */
export function invHas(inv, item, qty = 1) {
  return invCount(inv, item) >= qty;
}

/** Remove all of item from inv. */
export function invClear(inv, item) {
  if (!inv) return;
  delete inv.items[item];
}

// ── Event-driven system ───────────────────────────────────────────────────────

/**
 * createInventorySystem() → system function
 *
 * Wires inventory:add / inventory:remove events.
 * Priority 5 — runs before weapon (8) so ammo is ready when weapon fires.
 */
export function createInventorySystem() {
  let _wired = false;

  function system(dt, core) {
    if (_wired) return;
    _wired = true;

    core.on("inventory:add", ({ entityId, item, qty = 1 }) => {
      const inv = core.getComponent(entityId, "Inventory");
      if (!inv) return;
      const newQty = invAdd(inv, item, qty);
      core.emit("inventory:changed", { entityId, item, qty: newQty, delta: qty });
    });

    core.on("inventory:remove", ({ entityId, item, qty = 1 }) => {
      const inv = core.getComponent(entityId, "Inventory");
      if (!inv) return;
      const removed = invRemove(inv, item, qty);
      const newQty  = invCount(inv, item);
      core.emit("inventory:changed", { entityId, item, qty: newQty, delta: -removed });
      if (newQty === 0) core.emit("inventory:empty", { entityId, item });
    });
  }

  return system;
}

export default { invAdd, invRemove, invCount, invHas, invClear, createInventorySystem };
