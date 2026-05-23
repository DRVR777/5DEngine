// destruction.js — building HP + collapse → rubble physics.
// Buildings take damage from bullets / explosions / weather; when hp ≤ 0
// they "collapse": replace mesh with rubble pile, drop debris, splash damage.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTADestruction = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Material presets: hp-per-volume baseline + explosion resistance.
  const MATERIALS = {
    wood:        { hpPerM3: 50,   explosionResist: 0.3 },
    brick:       { hpPerM3: 150,  explosionResist: 0.6 },
    concrete:    { hpPerM3: 300,  explosionResist: 0.85 },
    steel:       { hpPerM3: 500,  explosionResist: 0.95 },
    reinforced:  { hpPerM3: 800,  explosionResist: 0.98 },
    glass:       { hpPerM3: 10,   explosionResist: 0.1 },
  };

  function registerMaterial(name, def) {
    if (MATERIALS[name]) throw new Error(`material ${name} exists`);
    MATERIALS[name] = def;
  }
  function getMaterial(name) { return MATERIALS[name] || null; }

  // Build a destructible facet for a building.
  function makeDestructible(opts) {
    opts = opts || {};
    const mat = MATERIALS[opts.material || "brick"];
    const vol = opts.volume != null
      ? opts.volume
      : (opts.w || 1) * (opts.d || 1) * (opts.h || 1);
    const maxHp = opts.maxHp != null ? opts.maxHp : Math.round(mat.hpPerM3 * vol);
    return {
      material: opts.material || "brick",
      maxHp, currentHp: maxHp,
      volume: vol,
      collapsed: false,
      damageHistory: [],          // [{amount, kind, ts}]
    };
  }

  function createSystem(opts) {
    opts = opts || {};
    const buildings = new Map();        // id → entity (must have .destructible facet)
    const debris = new Map();           // id → {pos, radius, age, color}
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 200) events.shift();
    }

    function register(buildingId, entity) {
      if (!entity || !entity.destructible) return { ok: false, reason: "no_destructible_facet" };
      buildings.set(buildingId, entity);
      return { ok: true };
    }
    function unregister(buildingId) { return buildings.delete(buildingId); }

    // Apply damage. damageKind is "bullet" | "explosion" | "weather" | "melee".
    // Returns { collapsed, hpRemaining, damageDealt }.
    function applyDamage(buildingId, amount, damageKind) {
      const entity = buildings.get(buildingId);
      if (!entity) return { ok: false, reason: "no_building" };
      const d = entity.destructible;
      if (d.collapsed) return { ok: false, reason: "already_collapsed" };
      const mat = MATERIALS[d.material] || MATERIALS.brick;
      // Explosion resistance reduces blast damage
      let effective = amount;
      if (damageKind === "explosion") effective = amount * (1 - mat.explosionResist);
      // Glass takes extra from bullets
      if (damageKind === "bullet" && d.material === "glass") effective = amount * 2;
      d.currentHp = Math.max(0, d.currentHp - effective);
      d.damageHistory.push({ amount: effective, kind: damageKind, ts: Date.now() });
      if (d.damageHistory.length > 50) d.damageHistory.shift();
      if (d.currentHp === 0) {
        d.collapsed = true;
        const debrisIds = _spawnDebris(buildingId, entity);
        _log("collapse", { buildingId, debrisCount: debrisIds.length });
        return { ok: true, collapsed: true, hpRemaining: 0, damageDealt: effective, debrisIds };
      }
      return { ok: true, collapsed: false, hpRemaining: d.currentHp, damageDealt: effective };
    }

    function _spawnDebris(buildingId, entity) {
      const pos = entity.position || { u: 0, v: 0, y: 0 };
      const vol = entity.destructible.volume;
      const count = Math.min(40, Math.max(3, Math.round(vol / 2)));
      const ids = [];
      for (let i = 0; i < count; i++) {
        const debrisId = `debris_${buildingId}_${i}`;
        debris.set(debrisId, {
          id: debrisId,
          pos: {
            u: pos.u + (Math.random() - 0.5) * (entity.hitbox && entity.hitbox.w || 2),
            v: pos.v + (Math.random() - 0.5) * (entity.hitbox && entity.hitbox.d || 2),
            y: 0,
          },
          radius: 0.3 + Math.random() * 0.4,
          age: 0,
          color: entity.destructible.material === "wood" ? 0x8b4513 : 0x888888,
        });
        ids.push(debrisId);
      }
      return ids;
    }

    // Explosion at a point: applies blast damage to nearby buildings.
    function applyExplosion(centerPos, blastDamage, blastRadius) {
      const hits = [];
      for (const [id, entity] of buildings) {
        if (entity.destructible.collapsed) continue;
        if (!entity.position) continue;
        const d = Math.hypot(entity.position.u - centerPos.u, entity.position.v - centerPos.v);
        if (d > blastRadius) continue;
        const falloff = 1 - (d / blastRadius);
        const damage = blastDamage * falloff;
        const r = applyDamage(id, damage, "explosion");
        if (r.ok) hits.push({ buildingId: id, distance: d, ...r });
      }
      return hits;
    }

    // Tick debris: ages it; old debris fades / removable.
    function tickDebris(dt) {
      const fadedIds = [];
      for (const [id, d] of debris) {
        d.age += dt;
        if (d.age > 120) fadedIds.push(id);
      }
      for (const id of fadedIds) debris.delete(id);
      return fadedIds;
    }

    function getDebris() { return Array.from(debris.values()); }
    function getBuilding(id) { return buildings.get(id) || null; }
    function listBuildings() { return Array.from(buildings.keys()); }
    function listCollapsed() {
      return Array.from(buildings.entries())
        .filter(([id, e]) => e.destructible.collapsed)
        .map(([id]) => id);
    }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    // Repair: heal a building. Cannot repair collapsed buildings.
    function repair(buildingId, amount) {
      const e = buildings.get(buildingId);
      if (!e) return { ok: false, reason: "no_building" };
      if (e.destructible.collapsed) return { ok: false, reason: "collapsed_cannot_repair" };
      const d = e.destructible;
      const before = d.currentHp;
      d.currentHp = Math.min(d.maxHp, d.currentHp + amount);
      return { ok: true, healed: d.currentHp - before, hp: d.currentHp };
    }

    return {
      MATERIALS, makeDestructible, registerMaterial, getMaterial,
      register, unregister, applyDamage, applyExplosion,
      tickDebris, getDebris, repair,
      getBuilding, listBuildings, listCollapsed, recentEvents,
    };
  }

  return { createSystem, makeDestructible, MATERIALS, registerMaterial, getMaterial };
});
