// test_iter_74.js — procedural city generator: WFC-lite, tile palette,
// deterministic by seed, materializes buildings/roads/parks/lots.
const C = require("./city_gen.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Tiny city
const plan = C.generate({
  bounds: { u0: 0, v0: 0, u1: 50, v1: 50 },
  cellSize: 10, seed: 7,
});
ok(plan.rows === 5 && plan.cols === 5, `5x5 grid (got ${plan.rows}x${plan.cols})`);
ok(plan.grid.length === 5, "grid rows");
ok(plan.grid[0].length === 5, "grid cols");
ok(plan.lots.length === 25, "25 lots");

// 2. Deterministic by seed
const a = C.generate({ bounds: { u0: 0, v0: 0, u1: 100, v1: 100 }, cellSize: 10, seed: 42 });
const b = C.generate({ bounds: { u0: 0, v0: 0, u1: 100, v1: 100 }, cellSize: 10, seed: 42 });
ok(JSON.stringify(a.grid) === JSON.stringify(b.grid), "same seed → same plan");

const c = C.generate({ bounds: { u0: 0, v0: 0, u1: 100, v1: 100 }, cellSize: 10, seed: 43 });
ok(JSON.stringify(a.grid) !== JSON.stringify(c.grid), "different seed → different plan");

// 3. Counts add up
const counts = C.countTiles(plan);
const total = Object.values(counts).reduce((s, n) => s + n, 0);
ok(total === 25, `tile counts sum to 25 (got ${total})`);

// 4. tileAt
const t00 = C.tileAt(plan, 5, 5);
ok(t00 === plan.grid[0][0], "tileAt(5,5) → grid[0][0]");
ok(C.tileAt(plan, 999, 999) === null, "out-of-bounds → null");

// 5. Adjacency is satisfied — every adjacent pair has matching edges
function edgeMatch(a, b, dir, palette) {
  const opp = { n: "s", s: "n", e: "w", w: "e" }[dir];
  return palette[a].edges[dir] === palette[b].edges[opp];
}
let adjOk = true, badCell = null;
for (let r = 0; r < plan.rows; r++) {
  for (let c = 0; c < plan.cols; c++) {
    const t = plan.grid[r][c];
    if (r + 1 < plan.rows) {
      const tS = plan.grid[r + 1][c];
      if (!edgeMatch(t, tS, "s", C.DEFAULT_PALETTE)) { adjOk = false; badCell = [r, c, "s", t, tS]; }
    }
    if (c + 1 < plan.cols) {
      const tE = plan.grid[r][c + 1];
      if (!edgeMatch(t, tE, "e", C.DEFAULT_PALETTE)) { adjOk = false; badCell = [r, c, "e", t, tE]; }
    }
  }
}
ok(adjOk, "all adjacent tiles compatible (bad: " + JSON.stringify(badCell) + ")");

// 6. Buildings have positive footprint
let buildingsOk = true;
for (const b2 of plan.buildings) {
  if (b2.u1 <= b2.u0 || b2.v1 <= b2.v0 || b2.height <= 0) { buildingsOk = false; break; }
}
ok(buildingsOk, "all buildings have positive footprint + height");

// 7. Roads come in pairs of endpoints
let roadsOk = plan.roads.every(r => r.from && r.to && r.kind);
ok(roadsOk, "all roads have from/to/kind");

// 8. Larger city
const big = C.generate({ bounds: { u0: 0, v0: 0, u1: 200, v1: 200 }, cellSize: 10, seed: 99 });
ok(big.lots.length === 400, `200x200/10 = 20x20 = 400 lots (got ${big.lots.length})`);

// 9. Custom palette (only empty + park, all-open edges)
const minimal = {
  empty: { weight: 1, edges: { n: "open", s: "open", e: "open", w: "open" } },
  park:  { weight: 1, edges: { n: "open", s: "open", e: "open", w: "open" } },
};
const minPlan = C.generate({
  bounds: { u0: 0, v0: 0, u1: 30, v1: 30 },
  cellSize: 10, seed: 1, palette: minimal,
});
const minCounts = C.countTiles(minPlan);
ok(Object.keys(minCounts).every(k => k === "empty" || k === "park"),
   "custom palette honored");

// 10. Lots include the original tile
ok(plan.lots[0].tile === plan.grid[0][0], "lot[0].tile === grid[0][0]");
ok(plan.lots[0].center.u === 5 && plan.lots[0].center.v === 5,
   "lot[0] center = (5,5) for cellSize 10");

// 11. Repeat for stability
for (let s = 0; s < 20; s++) {
  const p = C.generate({
    bounds: { u0: 0, v0: 0, u1: 80, v1: 80 },
    cellSize: 10, seed: 1000 + s,
  });
  if (p.lots.length !== 64) { ok(false, "lot count stable across seeds"); break; }
  if (s === 19) ok(true, "20 seeds all generate cleanly");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
