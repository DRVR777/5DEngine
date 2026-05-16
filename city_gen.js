// city_gen.js — procedural city generator using a tile palette + WFC-lite.
// Splits a rectangular bounds into a grid of cell-sized tiles, runs a
// reduced wave-function-collapse pass to pick tiles whose adjacency
// constraints all line up, then materializes a `CityPlan` with road
// segments, building footprints, intersections, and lot polygons that
// other modules (the renderer, traffic, NPC routing) can consume.
//
// Goals:
//  - Deterministic given (bounds, cellSize, seed).
//  - Tile palette is data — register new tiles without changing core.
//  - WFC is greedy + backtracking-free; on a contradiction we resample.
//
// Tile types:
//   "empty"          — open lot
//   "road_ns"        — north/south road segment
//   "road_ew"        — east/west road segment
//   "intersection"   — 4-way
//   "building_s"     — small building footprint
//   "building_m"     — medium
//   "building_l"     — large (occupies a 2×2 footprint)
//   "park"           — green space
//
// Adjacency: tiles have edge labels (n/s/e/w). Two adjacent tiles are
// compatible iff their facing labels match.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACityGen = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const DEFAULT_PALETTE = {
    empty:        { weight: 0.6, edges: { n: "open",  s: "open",  e: "open",  w: "open"  } },
    road_ns:      { weight: 1.0, edges: { n: "road",  s: "road",  e: "open",  w: "open"  } },
    road_ew:      { weight: 1.0, edges: { n: "open",  s: "open",  e: "road",  w: "road"  } },
    intersection: { weight: 0.4, edges: { n: "road",  s: "road",  e: "road",  w: "road"  } },
    building_s:   { weight: 0.8, edges: { n: "open",  s: "open",  e: "open",  w: "open"  } },
    building_m:   { weight: 0.5, edges: { n: "open",  s: "open",  e: "open",  w: "open"  } },
    park:         { weight: 0.3, edges: { n: "open",  s: "open",  e: "open",  w: "open"  } },
  };

  const OPPOSITE = { n: "s", s: "n", e: "w", w: "e" };

  function _compatible(tileA, dir, tileB, palette) {
    return palette[tileA].edges[dir] === palette[tileB].edges[OPPOSITE[dir]];
  }

  // WFC-lite: each cell starts with the full set of options. Pick the
  // lowest-entropy cell, collapse it (weighted random), propagate
  // constraints to neighbors. If a cell becomes empty, restart with the
  // next seed step (bounded retries).
  function generate(opts) {
    opts = opts || {};
    const bounds = opts.bounds || { u0: 0, v0: 0, u1: 100, v1: 100 };
    const cellSize = opts.cellSize || 10;
    const seed = opts.seed != null ? opts.seed : 42;
    const palette = opts.palette || DEFAULT_PALETTE;
    const maxRetries = opts.maxRetries || 8;

    const cols = Math.max(1, Math.floor((bounds.u1 - bounds.u0) / cellSize));
    const rows = Math.max(1, Math.floor((bounds.v1 - bounds.v0) / cellSize));
    const tileNames = Object.keys(palette);

    let attempt = 0;
    let lastErr = null;
    let grid = null;
    while (attempt < maxRetries) {
      try {
        grid = _runWFC(rows, cols, palette, tileNames, mulberry32(seed + attempt));
        break;
      } catch (e) {
        lastErr = e;
        attempt++;
      }
    }
    if (!grid) {
      throw new Error("WFC failed after " + maxRetries + " retries: " + (lastErr && lastErr.message));
    }

    return _materialize(grid, bounds, cellSize, rows, cols);
  }

  function _runWFC(rows, cols, palette, tileNames, rng) {
    // possibilities[r][c] = Set of tileName
    const poss = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(new Set(tileNames));
      }
      poss.push(row);
    }

    function neighbors(r, c) {
      const out = [];
      if (r > 0)        out.push({ r: r - 1, c, dir: "n" });
      if (r < rows - 1) out.push({ r: r + 1, c, dir: "s" });
      if (c < cols - 1) out.push({ r, c: c + 1, dir: "e" });
      if (c > 0)        out.push({ r, c: c - 1, dir: "w" });
      return out;
    }

    function propagate(startR, startC) {
      const stack = [[startR, startC]];
      while (stack.length) {
        const [r, c] = stack.pop();
        const here = poss[r][c];
        for (const n of neighbors(r, c)) {
          const there = poss[n.r][n.c];
          if (there.size === 0) continue;
          const before = there.size;
          for (const tB of Array.from(there)) {
            let ok = false;
            for (const tA of here) {
              if (_compatible(tA, n.dir, tB, palette)) { ok = true; break; }
            }
            if (!ok) there.delete(tB);
          }
          if (there.size === 0) throw new Error("contradiction at " + n.r + "," + n.c);
          if (there.size !== before) stack.push([n.r, n.c]);
        }
      }
    }

    let collapsed = 0;
    const total = rows * cols;
    while (collapsed < total) {
      // Find min-entropy uncollapsed cell
      let pick = null, minH = Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const s = poss[r][c].size;
          if (s > 1 && s < minH) { minH = s; pick = { r, c }; }
        }
      }
      if (!pick) {
        // All size 1 or 0; if any 0 → bad (would have thrown). Otherwise done.
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (poss[r][c].size === 0) throw new Error("empty cell at " + r + "," + c);
        }
        break;
      }
      // Weighted-random collapse
      const opts = Array.from(poss[pick.r][pick.c]);
      const weights = opts.map(t => palette[t].weight);
      const sum = weights.reduce((a, b) => a + b, 0);
      let pickedTile = opts[0];
      let acc = 0;
      const target = rng() * sum;
      for (let i = 0; i < opts.length; i++) {
        acc += weights[i];
        if (target < acc) { pickedTile = opts[i]; break; }
      }
      poss[pick.r][pick.c] = new Set([pickedTile]);
      collapsed++;
      propagate(pick.r, pick.c);
    }

    // Snapshot
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(Array.from(poss[r][c])[0] || "empty");
      }
      grid.push(row);
    }
    return grid;
  }

  function _materialize(grid, bounds, cellSize, rows, cols) {
    const buildings = [];
    const roads = [];
    const intersections = [];
    const parks = [];
    const lots = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = grid[r][c];
        const u0 = bounds.u0 + c * cellSize;
        const v0 = bounds.v0 + r * cellSize;
        const u1 = u0 + cellSize, v1 = v0 + cellSize;
        const center = { u: (u0 + u1) / 2, v: (v0 + v1) / 2 };
        const lot = { r, c, u0, v0, u1, v1, tile, center };
        lots.push(lot);

        if (tile === "road_ns" || tile === "road_ew") {
          roads.push({ from: tile === "road_ns" ? { u: center.u, v: v0 } : { u: u0, v: center.v },
                       to:   tile === "road_ns" ? { u: center.u, v: v1 } : { u: u1, v: center.v },
                       kind: tile });
        } else if (tile === "intersection") {
          intersections.push({ pos: center });
        } else if (tile === "building_s" || tile === "building_m") {
          const inset = tile === "building_s" ? cellSize * 0.3 : cellSize * 0.15;
          buildings.push({
            u0: u0 + inset, v0: v0 + inset,
            u1: u1 - inset, v1: v1 - inset,
            kind: tile,
            height: tile === "building_s" ? 6 : 12,
          });
        } else if (tile === "park") {
          parks.push({ u0, v0, u1, v1 });
        }
      }
    }

    return {
      bounds, cellSize, rows, cols, grid,
      buildings, roads, intersections, parks, lots,
    };
  }

  // Helpers for tests / renderers
  function tileAt(plan, u, v) {
    const c = Math.floor((u - plan.bounds.u0) / plan.cellSize);
    const r = Math.floor((v - plan.bounds.v0) / plan.cellSize);
    if (r < 0 || r >= plan.rows || c < 0 || c >= plan.cols) return null;
    return plan.grid[r][c];
  }

  function countTiles(plan) {
    const counts = {};
    for (const row of plan.grid) for (const t of row) counts[t] = (counts[t] || 0) + 1;
    return counts;
  }

  return {
    DEFAULT_PALETTE,
    generate,
    tileAt,
    countTiles,
  };
});
