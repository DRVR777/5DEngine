// loot.js — death drops. A `loot` facet declares what an entity may drop.
//   loot: { table: [{type, qty, chance}], radius }
// On death, dropLoot() materializes pickup entities in the world.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTALoot = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function makeLoot(table, opts) {
    opts = opts || {};
    return { table: table || [], radius: opts.radius != null ? opts.radius : 0.6 };
  }

  // Roll the loot table; returns array of {type, qty} actually dropped.
  function roll(loot, rng) {
    rng = rng || Math.random;
    const drops = [];
    for (const e of (loot.table || [])) {
      const chance = e.chance != null ? e.chance : 1.0;
      if (rng() < chance) {
        const qty = e.qty != null ? e.qty : 1;
        drops.push({ type: e.type, qty });
      }
    }
    return drops;
  }

  // Spawn pickup entities at the dead entity's position. Caller supplies
  // entity factory (so we don't import it; modular).
  function dropLoot(world, deadEntity, createEntity, idPrefix, rng) {
    if (!deadEntity || !deadEntity.loot || !deadEntity.position) return [];
    const drops = roll(deadEntity.loot, rng);
    const out = [];
    let i = 0;
    for (const d of drops) {
      const ang = (rng || Math.random)() * Math.PI * 2;
      const r   = (rng || Math.random)() * deadEntity.loot.radius;
      const id = `${idPrefix || "loot"}_${Date.now()}_${i++}`;
      const e = createEntity("pickup", {
        position: {
          u: deadEntity.position.u + Math.cos(ang) * r,
          v: deadEntity.position.v + Math.sin(ang) * r,
          y: deadEntity.position.y || 0,
        },
        pickup: { kind: d.type, qty: d.qty },
      });
      world.addEntity(id, e);
      out.push({ id, entity: e });
    }
    return out;
  }

  return { makeLoot, roll, dropLoot };
});
