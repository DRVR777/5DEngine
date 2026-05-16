// test_iter_54.js — traffic agents on a road network.
const T = require("./traffic.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Network construction
const net = T.createRoadNetwork();
ok(net.addNode("A", 0, 0), "add A");
ok(net.addNode("B", 10, 0), "add B");
ok(net.addNode("C", 10, 10), "add C");
ok(net.addNode("D", 0, 10), "add D");
ok(!net.addNode("A", 5, 5), "duplicate node rejected");

// 2. Edges (square loop A→B→C→D→A)
net.addBidi("A", "B");
net.addBidi("B", "C");
net.addBidi("C", "D");
net.addBidi("D", "A");
ok(net.neighbors("A").length === 2, "A has 2 neighbors (B, D)");
ok(net.neighbors("B").length === 2, "B has 2");

// 3. Shortest path
const p1 = net.shortestPath("A", "C");
ok(p1 !== null, "path A→C found");
ok(p1.length === 3, `A→C is 3 nodes (got ${p1.length}: ${p1.join(",")})`);
ok(p1[0] === "A" && p1[2] === "C", "starts/ends correct");

// Same node
const pSelf = net.shortestPath("A", "A");
ok(pSelf.length === 1 && pSelf[0] === "A", "same start/goal → [A]");

// Missing node
ok(net.shortestPath("ghost", "A") === null, "missing start → null");

// 4. Disconnected island
const net2 = T.createRoadNetwork();
net2.addNode("X", 0, 0); net2.addNode("Y", 1, 1); net2.addNode("Z", 100, 100);
net2.addEdge("X", "Y");
ok(net2.shortestPath("X", "Y") !== null, "X→Y reachable");
ok(net2.shortestPath("X", "Z") === null, "X→Z unreachable");

// 5. Agent creation requires network
let threw = false;
try { T.createAgent({ pos: { u: 0, v: 0 } }); } catch (e) { threw = true; }
ok(threw, "missing network throws");

// 6. setDestination snaps to nearest node, finds route
const agent = T.createAgent({ network: net, pos: { u: 0.5, v: 0.5 } });
const r1 = T.setDestination(agent, "C");
ok(r1 === true, "setDestination ok");
ok(agent.route.length >= 3, `route to C (${agent.route.join(",")})`);
ok(agent.currentDestId === "C", "currentDestId set");

// Bad dest
ok(T.setDestination(agent, "ghost") === false, "bad destination rejected");

// 7. tick advances toward waypoint.
// First tick consumes the start waypoint (agent is already on A); second
// actually moves toward B.
const agent2 = T.createAgent({ network: net, pos: { u: 0, v: 0 }, speed: 5 });
T.setDestination(agent2, "C");
T.tick(agent2, 0.1);                     // consumes A
const ev1 = T.tick(agent2, 0.1);         // now moving toward B
ok(agent2.pos.u > 0 || agent2.pos.v > 0, "agent moved");
ok(!ev1.arrivedAtDest, "not arrived yet");

// Tick until arrival (sufficient steps)
let arrived = false, ticks = 0;
while (!arrived && ticks < 200) {
  const e = T.tick(agent2, 0.5);
  if (e.arrivedAtDest) arrived = true;
  ticks++;
}
ok(arrived, `arrived at C in ${ticks} ticks`);
ok(agent2.arrivedAt === "C", "arrivedAt = C");

// 8. Heading updates as agent moves (first tick consumes start node)
const agent3 = T.createAgent({ network: net, pos: { u: 0, v: 0 }, speed: 5 });
T.setDestination(agent3, "B"); // east (B is at u=10, v=0)
T.tick(agent3, 0.1);            // consumes A
T.tick(agent3, 0.1);            // now moving toward B
ok(Math.abs(agent3.heading - Math.PI / 2) < 0.01,
   `heading east (PI/2) (got ${agent3.heading.toFixed(2)})`);

const agent4 = T.createAgent({ network: net, pos: { u: 0, v: 0 }, speed: 5 });
T.setDestination(agent4, "D"); // north (D is at u=0, v=10)
T.tick(agent4, 0.1);            // consumes A
T.tick(agent4, 0.1);
ok(Math.abs(agent4.heading) < 0.01, `heading north (0) (got ${agent4.heading.toFixed(2)})`);

// 9. spawnTraffic produces N agents with destinations
const fleet = T.spawnTraffic(net, 5);
ok(fleet.length === 5, "spawned 5");
for (const a of fleet) {
  ok(a.route.length > 0, "agent has a route");
  ok(a.network === net, "agent uses shared network");
}

// 10. tickFleet auto-respawns
const initialDests = fleet.map(a => a.currentDestId);
let respawned = false;
for (let i = 0; i < 500 && !respawned; i++) {
  T.tickFleet(fleet, 0.5);
  for (let j = 0; j < fleet.length; j++) {
    if (fleet[j].currentDestId !== initialDests[j]) { respawned = true; break; }
  }
}
ok(respawned, "at least one agent picked a new destination on arrival");

// tickFleet with respawn disabled — agents stop after arrival
const stopFleet = T.spawnTraffic(net, 2);
for (let i = 0; i < 500; i++) T.tickFleet(stopFleet, 0.5, { respawnOnArrival: false });
const allArrived = stopFleet.every(a => a.arrivedAt !== null);
ok(allArrived, "all agents arrived (no respawn)");

// 11. tick on empty route is safe
const empty = T.createAgent({ network: net, pos: { u: 0, v: 0 } });
const e = T.tick(empty, 0.5);
ok(e.reachedWaypoint === null, "empty route → no waypoint reached");

// 12. Speed limit hint propagated through neighbors
const net3 = T.createRoadNetwork();
net3.addNode("P", 0, 0); net3.addNode("Q", 10, 0);
net3.addEdge("P", "Q", { speedLimit: 25 });
const ns = net3.neighbors("P");
ok(ns[0].speedLimit === 25, "speedLimit on edge");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
