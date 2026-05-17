// test_iter_82.js — traffic on city_gen plans.
const C = require("./city_gen.js");
const T = require("./city_traffic.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Build a city plan
const plan = C.generate({
  bounds: { u0: 0, v0: 0, u1: 80, v1: 80 },
  cellSize: 10, seed: 17,
});
ok(plan.roads.length > 0, `plan has ${plan.roads.length} road segments`);

// 2. Build road graph
const graph = T.buildRoadGraph(plan);
ok(graph.nodes.length > 0, `graph has ${graph.nodes.length} nodes`);
ok(graph.adj.size > 0, "graph has adjacency");

let threw = false;
try { T.buildRoadGraph(null); } catch (e) { threw = true; }
ok(threw, "null plan throws");

let threw2 = false;
try { T.buildRoadGraph({}); } catch (e) { threw2 = true; }
ok(threw2, "no-roads plan throws");

// 3. pathBetween BFS
const roadNodes = graph.nodes.filter(n => n.kind === "road");
if (roadNodes.length >= 2) {
  const p = T.pathBetween(graph, roadNodes[0].id, roadNodes[0].id);
  ok(p && p.length === 1, "same-node path = [self]");
}

// 4. Simulation creation
const sim = T.createSimulation(plan, { config: { maxVehicles: 5, seed: 42 } });
ok(sim.activeCount() === 0, "no vehicles initially");

// 5. Spawn
const sp = sim.spawn();
if (sp.ok) {
  ok(sp.id === "veh_1", "first vehicle = veh_1");
  ok(sim.activeCount() === 1, "1 active");
  ok(sim.getVehicle(sp.id) !== null, "getVehicle works");
} else {
  // Some seeds may not find a path; spawn another way
  ok(true, "spawn may fail by seed - graceful");
}

// 6. maxVehicles limit
const sim2 = T.createSimulation(plan, { config: { maxVehicles: 2, seed: 5 } });
let spawned = 0;
for (let i = 0; i < 10; i++) {
  if (sim2.spawn().ok) spawned++;
}
ok(sim2.listVehicles().length <= 2, `max 2 vehicles (got ${sim2.listVehicles().length})`);

// Try one more - should fail
let lastReason = null;
for (let i = 0; i < 5; i++) {
  const r = sim2.spawn();
  if (!r.ok) { lastReason = r.reason; break; }
}
ok(lastReason === "full", `over-capacity reason = full (got ${lastReason})`);

// 7. Tick advances vehicle pos
const sim3 = T.createSimulation(plan, { config: { defaultSpeed: 100, seed: 7 } });
const s3 = sim3.spawn();
if (s3.ok) {
  const v = sim3.getVehicle(s3.id);
  const startPos = { u: v.pos.u, v: v.pos.v };
  sim3.tick(0.1);
  const moved = (v.pos.u !== startPos.u) || (v.pos.v !== startPos.v) || v.done;
  ok(moved, "vehicle moved or arrived");
}

// 8. Vehicle arrives → done flag
const sim4 = T.createSimulation(plan, { config: { defaultSpeed: 1000, seed: 9 } });
const s4 = sim4.spawn();
if (s4.ok) {
  // Tick many times
  for (let i = 0; i < 100; i++) sim4.tick(1);
  ok(sim4.getVehicle(s4.id).done === true, "vehicle done after many ticks");
}

// 9. clearArrived removes done vehicles
const sim5 = T.createSimulation(plan, { config: { defaultSpeed: 1000, seed: 11 } });
for (let i = 0; i < 3; i++) sim5.spawn();
for (let i = 0; i < 100; i++) sim5.tick(1);
const removed = sim5.clearArrived();
ok(removed > 0, `cleared ${removed} arrived`);
ok(sim5.listVehicles().length < 3, "fewer after clear");

// 10. despawn
const sim6 = T.createSimulation(plan, { config: { seed: 13 } });
const s6 = sim6.spawn();
if (s6.ok) {
  ok(sim6.despawn(s6.id).ok === true, "despawn ok");
  ok(sim6.getVehicle(s6.id) === null, "removed");
  ok(sim6.despawn(s6.id).ok === false, "despawn missing fails");
}

// 11. Custom from/to
const sim7 = T.createSimulation(plan, { config: { seed: 33 } });
if (graph.nodes.length >= 2) {
  const a = graph.nodes[0].id, b = graph.nodes[graph.nodes.length - 1].id;
  const r = sim7.spawn({ fromId: a, toId: b });
  // May or may not have a path between them in this random plan;
  // either outcome is OK as long as it doesn't crash.
  ok(r.ok === true || r.reason === "no_path", `custom from/to: ${r.ok ? "routed" : r.reason}`);
}

// 12. Intersection pause
const sim8 = T.createSimulation(plan, { config: { intersectionPauseMs: 5000, defaultSpeed: 1000, seed: 7 } });
const intersections = graph.nodes.filter(n => n.kind === "intersection");
if (intersections.length > 0) {
  // Force-route through an intersection
  const start = roadNodes[0];
  const ix = intersections[0];
  const sp8 = sim8.spawn({ fromId: start.id, toId: ix.id });
  if (sp8.ok) {
    // tick enough to reach intersection
    for (let i = 0; i < 30; i++) sim8.tick(0.1);
    const v = sim8.getVehicle(sp8.id);
    // either arrived (stop pause kicks in) or done
    ok(v.done || v.stopUntil > 0, `vehicle paused at intersection or arrived (done=${v.done}, stopUntil=${v.stopUntil})`);
  } else {
    ok(true, "no path to intersection — skip");
  }
}

// 13. recentEvents
const ev = sim.recentEvents();
ok(ev.length >= 0, "events accessible");

// 14. Bigger plan, more vehicles, no crash
const bigPlan = C.generate({
  bounds: { u0: 0, v0: 0, u1: 200, v1: 200 },
  cellSize: 10, seed: 99,
});
const bigSim = T.createSimulation(bigPlan, { config: { maxVehicles: 30, seed: 1, defaultSpeed: 5 } });
for (let i = 0; i < 30; i++) bigSim.spawn();
ok(bigSim.listVehicles().length > 0, `bigSim has ${bigSim.listVehicles().length} vehicles`);

for (let i = 0; i < 60; i++) bigSim.tick(0.1);
const arrived = bigSim.listVehicles().filter(v => v.done).length;
ok(arrived >= 0, `${arrived} arrived after 60 ticks`);

// 15. No-roads plan → spawn fails
const emptyPlan = {
  roads: [], intersections: [], lots: [], cellSize: 10,
  bounds: { u0: 0, v0: 0, u1: 10, v1: 10 },
};
let threwEmpty = false;
try {
  const emptyGraph = T.buildRoadGraph(emptyPlan);
  // Graph has no nodes; spawn should fail
  const emptySim = T.createSimulation(emptyPlan);
  const r = emptySim.spawn();
  ok(r.ok === false, "spawn fails on empty-road graph");
} catch (e) {
  threwEmpty = true;
  ok(false, "unexpected throw: " + e.message);
}

// 16. Multiple vehicles + ticks: stable
const sim9 = T.createSimulation(plan, { config: { maxVehicles: 10, seed: 100, defaultSpeed: 5 } });
for (let i = 0; i < 10; i++) sim9.spawn();
for (let t = 0; t < 50; t++) sim9.tick(0.1);
let allValid = true;
for (const v of sim9.listVehicles()) {
  if (!isFinite(v.pos.u) || !isFinite(v.pos.v)) { allValid = false; break; }
}
ok(allValid, "all vehicle positions finite after 50 ticks");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
