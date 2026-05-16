// test_iter_49.js — A* pathfinding on a grid.
const PF = require("./pathfinding.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Grid creation
const g = PF.createGrid(20, 20, 2);
ok(g.width === 20 && g.height === 20, "grid dims");
ok(g.cellSize === 2, "cell size");
ok(g.isWalkable(0, 0), "default walkable");
ok(!g.isWalkable(-1, 0), "out of bounds blocked");
ok(!g.isWalkable(20, 20), "out of bounds (high) blocked");

// 2. Block + check
g.setBlocked(5, 5, true);
ok(!g.isWalkable(5, 5), "blocked cell not walkable");
g.setBlocked(5, 5, false);
ok(g.isWalkable(5, 5), "unblocked");

// 3. setRect
g.setRect(3, 3, 7, 7, true);
ok(!g.isWalkable(5, 5), "rect blocked");
ok(!g.isWalkable(3, 3), "rect corner blocked");
ok(g.isWalkable(2, 5), "outside rect still open");

// 4. worldToCell / cellToWorld inverse-ish
const c1 = g.worldToCell(11, 7);
ok(c1.x === 5 && c1.y === 3, `world (11,7) cellSize 2 → cell (5,3)`);
const w1 = g.cellToWorld(5, 3);
ok(w1.u === 11 && w1.v === 7, "cellToWorld returns center (cell+0.5)*size");

// 5. heuristic (octile)
ok(PF.heuristic(0, 0, 3, 0) === 3, "straight horizontal");
ok(PF.heuristic(0, 0, 3, 3) > 3 && PF.heuristic(0, 0, 3, 3) < 5, "diagonal ~4.24");

// 6. Direct path (no obstacles)
const g2 = PF.createGrid(10, 10);
const p1 = PF.findPath(g2, 0, 0, 9, 9);
ok(p1 !== null, "path found");
ok(p1[0].x === 0 && p1[0].y === 0, "starts at (0,0)");
ok(p1[p1.length-1].x === 9 && p1[p1.length-1].y === 9, "ends at (9,9)");

// 7. Wall in the middle — path must detour
const g3 = PF.createGrid(10, 10);
for (let y = 1; y < 8; y++) g3.setBlocked(5, y, true);
const p2 = PF.findPath(g3, 0, 4, 9, 4);
ok(p2 !== null, "path around wall found");
ok(p2.some(p => p.x === 5 && (p.y === 0 || p.y === 8 || p.y === 9)),
   "path goes around the wall");

// 8. Closed box: no path
const g4 = PF.createGrid(10, 10);
g4.setRect(2, 2, 7, 7, true);
// Goal inside the box but border blocked → unreachable from outside
g4.setBlocked(4, 4, false);  // open interior cell, surrounded by walls
const p3 = PF.findPath(g4, 0, 0, 4, 4);
ok(p3 === null, "no path into sealed box");

// 9. Same start/goal
const p4 = PF.findPath(g4, 0, 0, 0, 0);
ok(p4 !== null && p4.length === 1, "same start/goal → 1-step path");

// 10. Start/goal on blocked cell → null
const p5 = PF.findPath(g4, 4, 4, 0, 0); // start in walled interior (surrounded by blocked)
// Walls at (3,4) (4,3) (5,4) (4,5) all blocked → interior unreachable, but if 4,4
// itself is walkable AND its neighbors are walls, no exit → null
ok(p5 === null, "trapped start → null");

// Setting goal itself blocked
g4.setBlocked(9, 9, true);
const p6 = PF.findPath(PF.createGrid(10, 10).setBlocked ? g4 : g4, 0, 0, 9, 9);
ok(p6 === null, "blocked goal → null");

// 11. Diagonal allowed by default; no diagonal option
const g5 = PF.createGrid(5, 5);
const pDiag = PF.findPath(g5, 0, 0, 4, 4);
const pNoDiag = PF.findPath(g5, 0, 0, 4, 4, { allowDiagonal: false });
ok(pDiag.length === 5, `diagonal path length 5 (got ${pDiag.length})`);
ok(pNoDiag.length === 9, `4-connected path length 9 (got ${pNoDiag.length})`);

// 12. Diagonal corner-cutting blocked
const g6 = PF.createGrid(5, 5);
g6.setBlocked(1, 0, true);
g6.setBlocked(0, 1, true);
// Trying to go (0,0) → (1,1) would cut through both walls
const pCut = PF.findPath(g6, 0, 0, 1, 1);
// Either null or routes around (no direct diagonal cut allowed)
ok(pCut === null || pCut.length > 2, "diagonal cut blocked");

// 13. Smoothing reduces waypoint count on straight runs
const g7 = PF.createGrid(20, 20);
const longPath = PF.findPath(g7, 0, 0, 15, 15);
const smoothed = PF.smoothPath(g7, longPath);
ok(smoothed.length < longPath.length, `smoothed (${smoothed.length}) < raw (${longPath.length})`);
ok(smoothed[0].x === 0 && smoothed[0].y === 0, "smoothed keeps start");
ok(smoothed[smoothed.length-1].x === 15, "smoothed keeps end");

// 14. pathToWorld converts cells → world centers
const wp = PF.pathToWorld(g, p1);
ok(wp[0].u === 1 && wp[0].v === 1, "first waypoint = (0.5+0)*2=1");
ok(wp[wp.length-1].u === 19 && wp[wp.length-1].v === 19, "last waypoint");

// 15. Heap PQ correctness (indirect): a long path that requires reorder
const g8 = PF.createGrid(30, 30);
// Spiral wall to force the open set to grow
for (let i = 0; i < 14; i++) g8.setBlocked(15, i, true);
for (let i = 5; i < 28; i++) g8.setBlocked(i, 14, true);
const longSpiral = PF.findPath(g8, 0, 0, 29, 0);
ok(longSpiral !== null, "complex path found");

// 16. Performance smoke (100x100 grid, no obstacles)
const big = PF.createGrid(100, 100);
const t0 = process.hrtime.bigint();
const longP = PF.findPath(big, 0, 0, 99, 99);
const ns = Number(process.hrtime.bigint() - t0);
ok(longP !== null, "100x100 path found");
ok(ns < 100e6, `100x100 < 100ms (got ${(ns/1e6).toFixed(1)}ms)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
