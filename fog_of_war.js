// fog_of_war.js — fog-of-war state + waypoint markers for the minimap.
// FoW: a coarse grid of "explored" cells. Reveal is a function of player
// position + sight radius; once revealed, cells stay revealed (memory).
// Waypoints: named markers (objective, friend, custom) drawn on the map.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFogOfWar = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // FoW grid: each cell is FOG_HIDDEN | FOG_VISIBLE | FOG_EXPLORED.
  const FOG_HIDDEN   = 0;
  const FOG_VISIBLE  = 2;     // currently in sight
  const FOG_EXPLORED = 1;     // seen previously (dimmed on minimap)

  function createFog(width, height, cellSize) {
    cellSize = cellSize || 4;
    const cells = new Uint8Array(width * height);
    function idx(x, y) { return y * width + x; }
    function inBounds(x, y) { return x >= 0 && x < width && y >= 0 && y < height; }
    function get(x, y) { return inBounds(x, y) ? cells[idx(x, y)] : FOG_HIDDEN; }
    function set(x, y, v) { if (inBounds(x, y)) cells[idx(x, y)] = v; }
    function worldToCell(u, v) {
      // Origin at center of grid for symmetric world space
      return {
        x: Math.floor(u / cellSize) + Math.floor(width / 2),
        y: Math.floor(v / cellSize) + Math.floor(height / 2),
      };
    }
    function cellToWorld(x, y) {
      return {
        u: (x - Math.floor(width / 2) + 0.5) * cellSize,
        v: (y - Math.floor(height / 2) + 0.5) * cellSize,
      };
    }

    // Reveal cells around (u, v) within sight radius.
    // After this call, fresh-revealed cells become VISIBLE; previously
    // VISIBLE cells outside the new sight become EXPLORED (memory).
    function reveal(observerPos, sightRadius) {
      // First, demote all currently-VISIBLE to EXPLORED
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] === FOG_VISIBLE) cells[i] = FOG_EXPLORED;
      }
      const c = worldToCell(observerPos.u, observerPos.v);
      const cellSightRadius = Math.ceil(sightRadius / cellSize);
      for (let dy = -cellSightRadius; dy <= cellSightRadius; dy++) {
        for (let dx = -cellSightRadius; dx <= cellSightRadius; dx++) {
          if (dx * dx + dy * dy > cellSightRadius * cellSightRadius) continue;
          set(c.x + dx, c.y + dy, FOG_VISIBLE);
        }
      }
    }

    function isVisible(u, v) {
      const c = worldToCell(u, v);
      return get(c.x, c.y) === FOG_VISIBLE;
    }
    function isExplored(u, v) {
      const c = worldToCell(u, v);
      const v2 = get(c.x, c.y);
      return v2 === FOG_VISIBLE || v2 === FOG_EXPLORED;
    }

    function exploredFraction() {
      let n = 0;
      for (let i = 0; i < cells.length; i++) {
        if (cells[i] !== FOG_HIDDEN) n++;
      }
      return n / cells.length;
    }

    function revealAll() {
      for (let i = 0; i < cells.length; i++) cells[i] = FOG_EXPLORED;
    }

    function reset() {
      for (let i = 0; i < cells.length; i++) cells[i] = FOG_HIDDEN;
    }

    return {
      width, height, cellSize, cells,
      FOG_HIDDEN, FOG_VISIBLE, FOG_EXPLORED,
      worldToCell, cellToWorld, get, set,
      reveal, isVisible, isExplored, exploredFraction,
      revealAll, reset,
    };
  }

  // Waypoints: tagged markers on the map.
  function createWaypointSystem() {
    const waypoints = new Map();   // id → {kind, u, v, label, color, ttl}

    function add(id, opts) {
      if (waypoints.has(id)) return false;
      waypoints.set(id, {
        id,
        kind: opts.kind || "custom",          // "objective" | "friend" | "shop" | "custom"
        u: opts.u, v: opts.v,
        label: opts.label || id,
        color: opts.color || 0xffffff,
        ttl: opts.ttl != null ? opts.ttl : -1,  // -1 = persistent
      });
      return true;
    }
    function update(id, partial) {
      const w = waypoints.get(id);
      if (!w) return false;
      Object.assign(w, partial);
      return true;
    }
    function remove(id) { return waypoints.delete(id); }
    function get(id) { return waypoints.get(id) || null; }
    function listAll() { return Array.from(waypoints.values()); }
    function listByKind(kind) {
      return Array.from(waypoints.values()).filter(w => w.kind === kind);
    }

    function tick(dt) {
      const expired = [];
      for (const [id, w] of waypoints) {
        if (w.ttl <= 0) continue;          // persistent or already expiring
        // Wait — ttl <= 0 means persistent OR expired-handled. We use ttl > 0
        // for "lifetime remaining". After tick, ttl -= dt; if <=0, expire.
      }
      // Re-loop properly: persistent (ttl < 0) skip; ttl > 0 decrement.
      for (const [id, w] of waypoints) {
        if (w.ttl < 0) continue;            // persistent
        w.ttl -= dt;
        if (w.ttl <= 0) {
          waypoints.delete(id);
          expired.push(id);
        }
      }
      return { expired };
    }

    return { add, update, remove, get, listAll, listByKind, tick };
  }

  return {
    createFog, createWaypointSystem,
    FOG_HIDDEN: 0, FOG_VISIBLE: 2, FOG_EXPLORED: 1,
  };
});
