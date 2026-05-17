// test_iter_26.js — nested impossible interiors per conviction.pdf.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Sub  = require("./subworlds.js");
const WG   = require("./world_graph.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// Outer world has a tiny 2x2 shed. Wire it to a 200x200 interior world.
const outer = new WorldState(1, { worldId: "city" });
const inner = new WorldState(1, { worldId: "shed_inside" });

const graph = WG.createWorldGraph();
graph.addWorld("city", outer);
graph.addWorld("shed_inside", inner);

// Player starts in outer
outer.addEntity("hero", Entity.createEntity("player", {
  position: { u: 5, v: 5, y: 0 },
}));

// Tiny shed entity
const shed = Entity.createEntity("building", {
  position: { u: 5, v: 6, y: 0 },
  hitbox: { w: 2, d: 2, h: 3 },
});
outer.addEntity("shed1", shed);

// 1. Wire subworld
const wired = Sub.wireSubworld({
  outerEntity: shed,
  outerEntityId: "shed1",
  outerWorldId: "city",
  innerWorld: inner,
  innerWorldId: "shed_inside",
  worldGraph: graph,
  spawnAt: { u: 0, v: 0, y: 0 },
});
ok(wired.ok === true, "wireSubworld returns ok");
ok(typeof wired.enterEdge === "string", "enter edge created");
ok(typeof wired.exitEdge === "string", "exit edge created");
ok(shed.subworld.worldId === "shed_inside", "subworld facet attached to shed");
ok(shed.subworld.returnSpawnAt.u === 5, "returnSpawnAt = shed exterior pos");
ok(shed.$header.$facets.includes("subworld"), "subworld facet listed in header");

// 2. Enter the shed: hero should leave outer.entities, appear in inner.entities at spawn
const e = Sub.enterSubworld("hero", shed, "city", graph);
ok(e.ok === true, `enterSubworld ok (got ${e.ok})`);
ok(!outer.entities.has("hero"), "hero gone from outer");
ok(inner.entities.has("hero"), "hero now in inner");
const heroIn = inner.entities.get("hero");
ok(heroIn.position.u === 0 && heroIn.position.v === 0, "hero at inner spawn");

// 3. THE IMPOSSIBILITY: hero walks 50 units inside the shed (whose exterior is 2x2).
heroIn.position.u = 50;
heroIn.position.v = 50;
const innerTraveled = Math.hypot(50, 50);
const outerExtent = 2;     // shed.hitbox.w
const ratio = Sub.impossibilityRatio(outerExtent, innerTraveled);
ok(ratio > 35, `impossibility ratio ${ratio.toFixed(1)} > 35 (interior dwarfs exterior)`);

// 4. Exit back to outer
const x = Sub.exitSubworld("hero", "shed_inside", "city", graph);
ok(x.ok === true, "exitSubworld ok");
ok(outer.entities.has("hero"), "hero back in outer");
ok(!inner.entities.has("hero"), "hero no longer in inner");
const heroOut = outer.entities.get("hero");
// Returns to the shed's exterior position (5, 6) — that's where the door is
ok(heroOut.position.u === 5 && heroOut.position.v === 6,
   `hero back at door exterior (got u=${heroOut.position.u}, v=${heroOut.position.v})`);

// 5. Multiple subworlds — independence
const inner2 = new WorldState(1, { worldId: "tower_inside" });
graph.addWorld("tower_inside", inner2);
const tower = Entity.createEntity("building", { position: { u: 20, v: 20, y: 0 }, hitbox: { w: 4, d: 4, h: 8 } });
outer.addEntity("tower1", tower);
const wired2 = Sub.wireSubworld({
  outerEntity: tower,
  outerEntityId: "tower1",
  outerWorldId: "city",
  innerWorld: inner2,
  innerWorldId: "tower_inside",
  worldGraph: graph,
  spawnAt: { u: 0, v: 0, y: 100 },
});
ok(wired2.ok === true, "second subworld wired");
ok(graph._nodes.size === 3, "3 worlds in graph (city + 2 interiors)");
const cityNeighbors = graph.neighbors("city");
ok(cityNeighbors.length === 2, `city has 2 outgoing portals (got ${cityNeighbors.length})`);

// 6. Wrong building (no subworld) → reject
const noSub = Entity.createEntity("building", { position: { u: 0, v: 0 } });
const fail1 = Sub.enterSubworld("hero", noSub, "city", graph);
ok(fail1.ok === false && fail1.reason === "no_subworld", "rejects building without subworld");

// 7. Self-connecting corridor: an interior whose exit portal goes back
// to ITSELF (different spawnAt) — perfectly valid, just nested loop.
const corridor = new WorldState(1, { worldId: "corridor" });
graph.addWorld("corridor", corridor);
const door1 = Entity.createEntity("door", { position: { u: 0, v: 0, y: 0 } });
corridor.addEntity("door1", door1);
const selfWired = Sub.wireSubworld({
  outerEntity: door1, outerEntityId: "door1",
  outerWorldId: "corridor", innerWorld: corridor, innerWorldId: "corridor",
  worldGraph: graph,
  spawnAt: { u: 100, v: 0, y: 0 },
});
ok(selfWired.ok === true, "self-wire ok (corridor → corridor)");
ok(door1.subworld.worldId === "corridor", "self-subworld facet correct");

// 8. Imp ratio edge cases
ok(Sub.impossibilityRatio(0, 100) === Infinity, "div-by-zero → Infinity");
ok(Sub.impossibilityRatio(10, 5) === 0.5, "shrunk interior also valid");

// 9. Validate via missing args
const nothing = Sub.wireSubworld({});
ok(nothing.ok === false && nothing.reason === "missing_args", "missing args rejected");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
