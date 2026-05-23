// pathfinding.js — A* on a 2D grid with obstacles.
// Grid coordinates are integers; world coords map by `cellSize`.
// Obstacles: any cell with `isWalkable === false` blocks. Returns a path
// of grid cells (with optional smoothing into world-space waypoints).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAPathfinding = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createGrid(width, height, cellSize) {
    cellSize = cellSize || 1;
    const cells = new Uint8Array(width * height); // 1 = blocked, 0 = walkable
    function idx(x, y) { return y * width + x; }
    function inBounds(x, y) { return x >= 0 && x < width && y >= 0 && y < height; }
    function isWalkable(x, y) { return inBounds(x, y) && cells[idx(x, y)] === 0; }
    function setBlocked(x, y, blocked) {
      if (!inBounds(x, y)) return;
      cells[idx(x, y)] = blocked ? 1 : 0;
    }
    function setRect(x0, y0, x1, y1, blocked) {
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) setBlocked(x, y, blocked);
    }
    function worldToCell(worldU, worldV) {
      return { x: Math.floor(worldU / cellSize), y: Math.floor(worldV / cellSize) };
    }
    function cellToWorld(x, y) {
      return { u: (x + 0.5) * cellSize, v: (y + 0.5) * cellSize };
    }
    return {
      width, height, cellSize, cells,
      idx, inBounds, isWalkable, setBlocked, setRect,
      worldToCell, cellToWorld,
    };
  }

  // Heap-based priority queue keyed by f-score
  function createPQ() {
    const heap = [];
    function push(item, key) {
      heap.push({ item, key });
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent].key <= heap[i].key) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    }
    function pop() {
      if (heap.length === 0) return null;
      const top = heap[0];
      const last = heap.pop();
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        while (true) {
          const l = 2*i+1, r = 2*i+2;
          let s = i;
          if (l < heap.length && heap[l].key < heap[s].key) s = l;
          if (r < heap.length && heap[r].key < heap[s].key) s = r;
          if (s === i) break;
          [heap[s], heap[i]] = [heap[i], heap[s]];
          i = s;
        }
      }
      return top.item;
    }
    function size() { return heap.length; }
    return { push, pop, size };
  }

  // Octile distance heuristic (allows diagonal movement)
  function heuristic(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  }

  // Find a path from (sx,sy) to (gx,gy) on a grid. Returns array of {x,y}
  // including start and goal, or null if no path exists.
  function findPath(grid, sx, sy, gx, gy, opts) {
    opts = opts || {};
    const allowDiagonal = opts.allowDiagonal !== false;
    const maxNodes = opts.maxNodes || grid.width * grid.height;
    if (!grid.isWalkable(sx, sy) || !grid.isWalkable(gx, gy)) return null;
    if (sx === gx && sy === gy) return [{ x: sx, y: sy }];

    const open = createPQ();
    const came = new Map();
    const gScore = new Map();
    const closed = new Set();
    const startKey = sx * grid.height + sy;
    gScore.set(startKey, 0);
    open.push({ x: sx, y: sy, key: startKey }, heuristic(sx, sy, gx, gy));

    let visited = 0;
    const neighbors = allowDiagonal
      ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
      : [[0,-1],[-1,0],[1,0],[0,1]];

    while (open.size() > 0 && visited < maxNodes) {
      const cur = open.pop();
      if (closed.has(cur.key)) continue;
      closed.add(cur.key);
      visited++;
      if (cur.x === gx && cur.y === gy) {
        // Reconstruct
        const path = [];
        let key = cur.key, x = cur.x, y = cur.y;
        path.push({ x, y });
        while (came.has(key)) {
          const prev = came.get(key);
          path.push({ x: prev.x, y: prev.y });
          key = prev.x * grid.height + prev.y;
          x = prev.x; y = prev.y;
        }
        path.reverse();
        return path;
      }
      for (const [dx, dy] of neighbors) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (!grid.isWalkable(nx, ny)) continue;
        // Diagonal: prevent cutting corners through walls
        if (dx !== 0 && dy !== 0) {
          if (!grid.isWalkable(cur.x + dx, cur.y) && !grid.isWalkable(cur.x, cur.y + dy)) continue;
        }
        const step = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
        const tentativeG = (gScore.get(cur.key) || 0) + step;
        const nkey = nx * grid.height + ny;
        if (!gScore.has(nkey) || tentativeG < gScore.get(nkey)) {
          gScore.set(nkey, tentativeG);
          came.set(nkey, { x: cur.x, y: cur.y });
          open.push({ x: nx, y: ny, key: nkey }, tentativeG + heuristic(nx, ny, gx, gy));
        }
      }
    }
    return null;
  }

  // Smoothing pass: drop intermediate waypoints when the line-of-sight
  // between adjacent kept waypoints is clear (Bresenham-ish).
  function smoothPath(grid, path) {
    if (!path || path.length <= 2) return path;
    const out = [path[0]];
    let i = 0;
    while (i < path.length - 1) {
      let j = path.length - 1;
      while (j > i + 1 && !losClear(grid, path[i], path[j])) j--;
      out.push(path[j]);
      i = j;
    }
    return out;
  }

  function losClear(grid, a, b) {
    let x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      if (!grid.isWalkable(x0, y0)) return false;
      if (x0 === x1 && y0 === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }

  // Convert cell path to world waypoints
  function pathToWorld(grid, path) {
    if (!path) return null;
    return path.map(p => grid.cellToWorld(p.x, p.y));
  }

  return { createGrid, findPath, smoothPath, pathToWorld, heuristic };
});
