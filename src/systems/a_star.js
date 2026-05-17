// a_star.js — 5DEngine A* grid pathfinder
// Builds a walkability grid from world geometry (buildings as obstacles).
// Enemies use this to navigate around walls instead of walking through them.
//
// API (window.AStar):
//   build(worldData, opts)     — (re)build the grid; call once on load
//   findPath(fromU, fromV, toU, toV) → [{u, v}, ...] or []
//   isWalkable(u, v)           → bool
//   getGrid()                  → Float32Array (0=walkable, 1=blocked)
//   debugDraw(THREE, scene)    → draws the grid as colored squares
//   clearDebug()               → remove debug meshes

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AStar = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let _grid     = null;   // Uint8Array  (1 = blocked)
  let _cols     = 0;
  let _rows     = 0;
  let _cellSize = 1;
  let _originU  = 0;
  let _originV  = 0;
  let _debugMeshes = [];

  function _uvToCell(u, v) {
    return {
      col: Math.floor((u - _originU) / _cellSize),
      row: Math.floor((v - _originV) / _cellSize),
    };
  }
  function _cellToUV(col, row) {
    return {
      u: _originU + col * _cellSize + _cellSize / 2,
      v: _originV + row * _cellSize + _cellSize / 2,
    };
  }
  function _idx(col, row) { return row * _cols + col; }
  function _inBounds(col, row) { return col >= 0 && col < _cols && row >= 0 && row < _rows; }

  function build(worldData, opts = {}) {
    const halfSize = opts.halfSize || 50;
    _cellSize = opts.cellSize || 1;
    _cols = Math.ceil((halfSize * 2) / _cellSize);
    _rows = Math.ceil((halfSize * 2) / _cellSize);
    _originU = -halfSize;
    _originV = -halfSize;

    _grid = new Uint8Array(_cols * _rows);   // 0 = walkable

    // Mark building footprints as blocked
    const buildings = (worldData && worldData.buildings) || [];
    for (const b of buildings) {
      const c0 = Math.floor((Math.min(b.u0, b.u1) - _originU) / _cellSize);
      const c1 = Math.ceil( (Math.max(b.u0, b.u1) - _originU) / _cellSize);
      const r0 = Math.floor((Math.min(b.v0, b.v1) - _originV) / _cellSize);
      const r1 = Math.ceil( (Math.max(b.v0, b.v1) - _originV) / _cellSize);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (_inBounds(c, r)) _grid[_idx(c, r)] = 1;
        }
      }
    }
  }

  function isWalkable(u, v) {
    if (!_grid) return true;
    const { col, row } = _uvToCell(u, v);
    if (!_inBounds(col, row)) return false;
    return _grid[_idx(col, row)] === 0;
  }

  // ---- A* ----
  function _heuristic(ac, ar, bc, br) {
    // Octile distance (allows diagonals)
    const dx = Math.abs(ac - bc), dy = Math.abs(ar - br);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  const _DIRS = [
    [0,1],[0,-1],[1,0],[-1,0],
    [1,1],[1,-1],[-1,1],[-1,-1],   // diagonals (cost √2)
  ];

  function findPath(fromU, fromV, toU, toV) {
    if (!_grid) return [];
    const start = _uvToCell(fromU, fromV);
    const goal  = _uvToCell(toU, toV);
    if (!_inBounds(start.col, start.row) || !_inBounds(goal.col, goal.row)) return [];
    if (_grid[_idx(goal.col, goal.row)] === 1) {
      // Goal is blocked — find nearest walkable cell
      let found = false;
      for (let r = -2; r <= 2 && !found; r++) {
        for (let c = -2; c <= 2 && !found; c++) {
          const nc = goal.col + c, nr = goal.row + r;
          if (_inBounds(nc, nr) && _grid[_idx(nc, nr)] === 0) {
            goal.col = nc; goal.row = nr; found = true;
          }
        }
      }
      if (!found) return [];
    }

    const open = new Map();    // key → {col, row, g, f, parent}
    const closed = new Set();
    const startKey = _idx(start.col, start.row);
    open.set(startKey, { col: start.col, row: start.row, g: 0, f: _heuristic(start.col, start.row, goal.col, goal.row), parent: null });

    let iterations = 0;
    while (open.size && iterations++ < 4000) {
      // Pick node with lowest f
      let best = null, bestF = Infinity;
      for (const [, node] of open) { if (node.f < bestF) { bestF = node.f; best = node; } }
      if (!best) break;
      const key = _idx(best.col, best.row);
      open.delete(key);
      closed.add(key);

      if (best.col === goal.col && best.row === goal.row) {
        // Reconstruct path
        const path = [];
        let cur = best;
        while (cur) { path.unshift(_cellToUV(cur.col, cur.row)); cur = cur.parent; }
        return path;
      }

      for (const [dc, dr] of _DIRS) {
        const nc = best.col + dc, nr = best.row + dr;
        if (!_inBounds(nc, nr)) continue;
        const nk = _idx(nc, nr);
        if (closed.has(nk) || _grid[nk] === 1) continue;
        const isDiag = dc !== 0 && dr !== 0;
        // Diagonal: block if either adjacent straight cell is blocked (corner cutting)
        if (isDiag) {
          if (_grid[_idx(best.col + dc, best.row)] === 1 || _grid[_idx(best.col, best.row + dr)] === 1) continue;
        }
        const g = best.g + (isDiag ? Math.SQRT2 : 1);
        const existing = open.get(nk);
        if (!existing || g < existing.g) {
          const f = g + _heuristic(nc, nr, goal.col, goal.row);
          open.set(nk, { col: nc, row: nr, g, f, parent: best });
        }
      }
    }
    return [];   // no path found
  }

  function getGrid() { return _grid; }

  function debugDraw(THREE, scene) {
    clearDebug(scene);
    if (!_grid || !THREE || !scene) return;
    const geo = new THREE.PlaneGeometry(_cellSize * 0.8, _cellSize * 0.8);
    geo.rotateX(-Math.PI / 2);
    const mBlocked  = new THREE.MeshBasicMaterial({ color: 0xff4466, transparent: true, opacity: 0.35 });
    const mWalkable = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.15 });
    for (let r = 0; r < _rows; r++) {
      for (let c = 0; c < _cols; c++) {
        const blocked = _grid[_idx(c, r)] === 1;
        const mesh = new THREE.Mesh(geo, blocked ? mBlocked : mWalkable);
        const { u, v } = _cellToUV(c, r);
        mesh.position.set(u, 0.02, v);
        scene.add(mesh);
        _debugMeshes.push(mesh);
      }
    }
  }

  function clearDebug(scene) {
    for (const m of _debugMeshes) {
      if (scene) scene.remove(m);
    }
    _debugMeshes = [];
  }

  return { build, findPath, isWalkable, getGrid, debugDraw, clearDebug };
});
