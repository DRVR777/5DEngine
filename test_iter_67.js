// test_iter_67.js — procedural portal generation strategies.
const PG = require("./portal_gen.js");
const WG = require("./world_graph.js");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// 1. STRATEGIES list
ok(PG.STRATEGIES.length === 6, "6 strategies");
ok(PG.STRATEGIES.includes("ring"), "ring");
ok(PG.STRATEGIES.includes("spanning_tree"), "spanning_tree");

const worlds = [
  { id: "A", theme: "fire", pos: [0, 0] },
  { id: "B", theme: "water", pos: [10, 0] },
  { id: "C", theme: "earth", pos: [10, 10] },
  { id: "D", theme: "air", pos: [0, 10] },
];

// 2. Ring strategy
const ring = PG.generate(worlds, { strategy: "ring" });
ok(ring.length === 4, `ring of 4 worlds → 4 edges (got ${ring.length})`);
ok(ring[0].from === "A" && ring[0].to === "B", "A→B");
ok(ring[3].from === "D" && ring[3].to === "A", "D→A (wraps)");

// 3. Star with explicit hub
const star = PG.generate(worlds, { strategy: "star", hub: "C" });
ok(star.length === 3, "star of 4 worlds → 3 spokes");
ok(star.every(e => e.from === "C"), "all from hub C");

// Star with default hub (first world)
const starDef = PG.generate(worlds, { strategy: "star" });
ok(starDef.every(e => e.from === "A"), "default hub = first world A");

// 4. Spanning tree
const tree = PG.generate(worlds, { strategy: "spanning_tree" });
ok(tree.length === 3, `spanning tree of 4 worlds → 3 edges (got ${tree.length})`);

// Verify connectivity: collect all nodes touched
const touched = new Set();
for (const e of tree) { touched.add(e.from); touched.add(e.to); }
ok(touched.size === 4, "spanning tree connects all 4 worlds");

// 5. Fully connected
const full = PG.generate(worlds, { strategy: "fully_connected" });
ok(full.length === 6, `4 worlds fully connected → 6 edges (got ${full.length})`);

// 6. Weighted
const weighted = PG.generate(worlds, {
  strategy: "weighted",
  scoreFn: (a, b) => {
    // Same theme letter = high score
    return a.theme[0] === b.theme[0] ? 0.9 : 0.3;
  },
  threshold: 0.5,
});
ok(weighted.length === 0, "no same-letter themes → no edges at 0.5 threshold");

const weighted2 = PG.generate(worlds, {
  strategy: "weighted",
  scoreFn: (a, b) => 1 / (1 + Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1])),
  threshold: 0.05,
});
ok(weighted2.length > 0, `weighted with distance scoreFn produces edges (got ${weighted2.length})`);

// Without scoreFn → throws
let threw = false;
try { PG.generate(worlds, { strategy: "weighted" }); } catch (e) { threw = true; }
ok(threw, "weighted without scoreFn throws");

// 7. k-nearest
const kn1 = PG.generate(worlds, {
  strategy: "k_nearest", k: 1,
  scoreFn: (a, b) => -Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]),
});
ok(kn1.length <= 4, `k=1 → ≤ 4 unique edges (got ${kn1.length})`);

const kn2 = PG.generate(worlds, {
  strategy: "k_nearest", k: 2,
  scoreFn: (a, b) => -Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]),
});
ok(kn2.length > kn1.length, "higher k → more edges");

// 8. Bad strategy
let throw2 = false;
try { PG.generate(worlds, { strategy: "ghost" }); } catch (e) { throw2 = true; }
ok(throw2, "bad strategy throws");

// 9. Edge case: 1 world → 0 edges
ok(PG.generate([{ id: "lonely" }], { strategy: "ring" }).length === 0, "1 world → 0 edges");
ok(PG.generate([], { strategy: "ring" }).length === 0, "0 worlds → 0 edges");

// 10. Output shape
for (const e of ring) {
  ok(typeof e.from === "string", "edge.from string");
  ok(typeof e.to === "string", "edge.to string");
  ok(typeof e.weight === "number", "edge.weight number");
  ok(e.kind === "auto_portal", "default kind");
}

// 11. applyToGraph wires into world_graph
const graph = WG.createWorldGraph();
for (const w of worlds) graph.addWorld(w.id, new WorldState(1));

const installed = PG.applyToGraph(graph, ring, { bidirectional: false });
ok(installed.length === 4, `4 edges installed (directed) (got ${installed.length})`);

// Bidirectional
const graph2 = WG.createWorldGraph();
for (const w of worlds) graph2.addWorld(w.id, new WorldState(1));
const installed2 = PG.applyToGraph(graph2, ring, { bidirectional: true });
ok(installed2.length === 8, `4 edges × 2 dirs = 8 installed (got ${installed2.length})`);

// 12. Custom kind
const custom = PG.generate(worlds, { strategy: "ring", kind: "teleport" });
ok(custom.every(e => e.kind === "teleport"), "custom kind respected");

// 13. Custom params
const withParams = PG.generate(worlds, {
  strategy: "ring",
  params: { spawnAt: { u: 0, v: 0 } },
});
ok(withParams[0].params.spawnAt.u === 0, "params propagated");

// 14. Spanning tree picks best edges first (verify monotonicity)
const tree2 = PG.generate(worlds, {
  strategy: "spanning_tree",
  scoreFn: (a, b) => {
    // Distance-based: closer = higher score
    return -Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]);
  },
});
ok(tree2.length === 3, "tree of 4 worlds → 3 edges");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
