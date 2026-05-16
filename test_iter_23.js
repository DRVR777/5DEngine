// test_iter_23.js — world graph + portal merge + proximity proposal.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const WG = require("./world_graph.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// 1. Add worlds + portals
const g = WG.createWorldGraph();
const wA = new WorldState(1);
const wB = new WorldState(1);
const wC = new WorldState(1);
ok(g.addWorld("A", wA), "added world A");
ok(g.addWorld("B", wB), "added world B");
ok(g.addWorld("C", wC), "added world C");
ok(!g.addWorld("A", wA), "duplicate add fails");

const e1 = g.addPortal("A", "B", { kind: "door", weight: 1 });
ok(typeof e1 === "string", "addPortal returns id");
ok(g.neighbors("A").length === 1, "A has 1 outgoing");
ok(g.neighbors("B").length === 0, "B has 0 outgoing (directed)");

// 2. Bidirectional
const [e2, e3] = g.addBidirectional("B", "C");
ok(g.neighbors("B").length === 1 && g.neighbors("C").length === 1,
   "bidirectional creates edges both ways");

// 3. mergeWorlds
const m = g.mergeWorlds("A", "C");
ok(m.ok === true, "merge A and C ok");
ok(g.neighbors("A").length === 2, "A now has 2 neighbors (B and C)");

const m2 = g.mergeWorlds("A", "C");
ok(m2.ok === false && m2.reason === "already_merged", "duplicate merge rejected");

// 4. Reachability
const reachFromA = g.reachable("A");
ok(reachFromA.length === 3, `reachable from A = 3 worlds (got ${reachFromA.length})`);

const reachFromAlimit = g.reachable("A", 1);
ok(reachFromAlimit.length === 3, `1-hop from A still reaches B and C`);

// 5. Isolated world
g.addWorld("Z", new WorldState(1));
const reachZ = g.reachable("Z");
ok(reachZ.length === 1, "isolated world reaches only itself");

// 6. removeWorld cleans up edges
g.addPortal("Z", "A");
ok(g.neighbors("Z").length === 1, "Z → A added");
g.removeWorld("Z");
ok(g._nodes.has("Z") === false, "Z gone");
let zEdge = false;
for (const e of g._edges.values()) if (e.from === "Z" || e.to === "Z") zEdge = true;
ok(!zEdge, "no edges touching Z remain");

// 7. traversePortal moves an entity from src.entities to dst.entities
const Entity = require("./entity.js");
wA.addEntity("hero", Entity.createEntity("player", { position: { u: 1, v: 2, y: 0 } }));
const portalAB = g.addPortal("A", "B", { kind: "door", weight: 1, params: { spawnAt: { u: 0, v: 0 } } });
const t = g.traversePortal(portalAB, "hero");
ok(t.ok === true, "traverse portal ok");
ok(!wA.entities.has("hero"), "hero removed from world A");
ok(wB.entities.has("hero"), "hero now in world B");
ok(wB.entities.get("hero").position.u === 0, "hero re-spawned at portal exit (0)");

// 8. traversePortal fails on missing edge / entity
const tBad = g.traversePortal("nope", "hero");
ok(tBad.ok === false, "missing edge → fail");
const tNoEnt = g.traversePortal(portalAB, "ghost");
ok(tNoEnt.ok === false, "missing entity → fail");

// 9. shouldMergeOnProximity proposes merges based on distance
const friends = [
  { profile: { handle: "alice", worldId: "A" },  lastKnownPos: { u: 100, v: 0 } }, // far
  { profile: { handle: "bob",   worldId: "X" },  lastKnownPos: { u: 1, v: 1 } },   // close
  { profile: { handle: "carol", worldId: "Y" },  lastKnownPos: { u: 10, v: 0 } },  // far
];
const proposals = WG.shouldMergeOnProximity("MY_WORLD", { u: 0, v: 0 }, friends, 5);
ok(proposals.length === 1 && proposals[0].friend === "bob",
   `only bob is within 5 (got ${proposals.length})`);

// Threshold tunable
const allProposals = WG.shouldMergeOnProximity("MY_WORLD", { u: 0, v: 0 }, friends, 200);
ok(allProposals.length === 3, `threshold=200 admits all 3`);

// Same-world friend not proposed (already merged)
const sameWorld = [{ profile: { handle: "x", worldId: "MY_WORLD" }, lastKnownPos: { u: 0, v: 0 } }];
const noProp = WG.shouldMergeOnProximity("MY_WORLD", { u: 0, v: 0 }, sameWorld, 100);
ok(noProp.length === 0, "same-world friend not proposed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
