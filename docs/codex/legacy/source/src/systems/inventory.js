// inventory.js — slot-based inventory. One inventory per entity (facet).
// Items are plain { type, qty, meta? } records. Stacks merge by type when
// item.stackable !== false. Slots are indexed; -1 means "no preference".
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAInventory = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Item-type registry: each type declares its stackability and category.
  const ITEM_TYPES = {
    // ammo
    pistol_9mm:   { category: "ammo", stackable: true,  maxStack: 200, weight: 0.01 },
    rifle_556:    { category: "ammo", stackable: true,  maxStack: 200, weight: 0.012 },
    shotgun_12g:  { category: "ammo", stackable: true,  maxStack: 100, weight: 0.05 },
    energy_cell:  { category: "ammo", stackable: true,  maxStack: 100, weight: 0.04 },
    rocket:       { category: "ammo", stackable: true,  maxStack: 12,  weight: 1.5  },
    // collectibles
    coin:         { category: "currency", stackable: true, maxStack: 9999, weight: 0 },
    // health
    medkit:       { category: "consumable", stackable: true, maxStack: 5, weight: 0.5 },
    // guns (instances are non-stackable so each carries its own ammo state)
    gun_pistol:   { category: "weapon", stackable: false, weight: 1.2 },
    gun_smg:      { category: "weapon", stackable: false, weight: 2.5 },
    gun_rifle:    { category: "weapon", stackable: false, weight: 3.5 },
    gun_shotgun:  { category: "weapon", stackable: false, weight: 3.0 },
    gun_sniper:   { category: "weapon", stackable: false, weight: 4.5 },
    gun_rocket:   { category: "weapon", stackable: false, weight: 6.0 },
    gun_plasma:   { category: "weapon", stackable: false, weight: 3.2 },
    // car parts (iter 16 will use these)
    part_engine:  { category: "part", stackable: false, weight: 50 },
    part_wheel:   { category: "part", stackable: true,  maxStack: 4, weight: 12 },
    part_body:    { category: "part", stackable: false, weight: 80 },
  };

  function registerItemType(name, def) {
    if (ITEM_TYPES[name]) throw new Error(`item type ${name} already registered`);
    ITEM_TYPES[name] = Object.assign({ stackable: true, maxStack: 99, weight: 0, category: "misc" }, def);
  }
  function getItemType(name) { return ITEM_TYPES[name] || null; }
  function itemNames() { return Object.keys(ITEM_TYPES); }

  function makeInventory(slots) {
    return {
      slots: new Array(slots || 24).fill(null),  // each slot: null | {type, qty, meta?}
      hotbar: [0, 1, 2, 3, 4, 5, 6, 7],          // first 8 slots are hotbar
      activeHotbar: 0,
    };
  }

  // Add `qty` of `type` — fills existing matching stacks first, then empties.
  // Returns the qty NOT added (0 if all fit, >0 if overflow).
  function addItem(inv, type, qty, meta) {
    const def = ITEM_TYPES[type];
    if (!def) return qty;
    let remaining = qty;
    if (def.stackable) {
      const cap = def.maxStack || 99;
      // Fill existing stacks
      for (const s of inv.slots) {
        if (!s || s.type !== type) continue;
        const room = cap - s.qty;
        if (room <= 0) continue;
        const add = Math.min(room, remaining);
        s.qty += add; remaining -= add;
        if (remaining === 0) return 0;
      }
      // Open new stacks
      while (remaining > 0) {
        const i = inv.slots.findIndex(s => s === null);
        if (i === -1) return remaining;
        const add = Math.min(cap, remaining);
        inv.slots[i] = { type, qty: add, meta: meta || null };
        remaining -= add;
      }
      return 0;
    }
    // Non-stackable: one slot per item
    while (remaining > 0) {
      const i = inv.slots.findIndex(s => s === null);
      if (i === -1) return remaining;
      inv.slots[i] = { type, qty: 1, meta: meta || null };
      remaining -= 1;
    }
    return 0;
  }

  // Remove `qty` of `type`. Returns the qty actually removed.
  function removeItem(inv, type, qty) {
    let need = qty;
    for (let i = 0; i < inv.slots.length && need > 0; i++) {
      const s = inv.slots[i];
      if (!s || s.type !== type) continue;
      const take = Math.min(s.qty, need);
      s.qty -= take; need -= take;
      if (s.qty === 0) inv.slots[i] = null;
    }
    return qty - need;
  }

  function countItem(inv, type) {
    let n = 0;
    for (const s of inv.slots) if (s && s.type === type) n += s.qty;
    return n;
  }
  function hasItem(inv, type, qty) { return countItem(inv, type) >= (qty || 1); }

  function totalWeight(inv) {
    let w = 0;
    for (const s of inv.slots) {
      if (!s) continue;
      const def = ITEM_TYPES[s.type];
      if (def) w += (def.weight || 0) * s.qty;
    }
    return w;
  }

  function toRows(inv) {
    return inv.slots.map((s, i) => ({
      idx: i,
      hotbar: inv.hotbar.indexOf(i) >= 0,
      active: inv.hotbar[inv.activeHotbar] === i,
      type: s ? s.type : null,
      qty:  s ? s.qty  : 0,
      category: s ? (ITEM_TYPES[s.type] && ITEM_TYPES[s.type].category) || "misc" : null,
    }));
  }

  return {
    makeInventory, addItem, removeItem, countItem, hasItem,
    totalWeight, toRows,
    registerItemType, getItemType, itemNames,
    ITEM_TYPES,
  };
});
