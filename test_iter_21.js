// test_iter_21.js — multi-client world: client→intent→server→snapshot→client.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const MP  = require("./multiplayer.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// 1. Server boots with a world
const world = new WorldState(1);
const server = MP.createServer({ world, nodeId: "S" });
ok(server.world === world, "server uses supplied world");

// 2. Two clients attach. Each client's "send" pushes envelopes to a queue.
const aQ = [], bQ = [];
const aClient = MP.createClient();
const bClient = MP.createClient();
server.attachClient("world1", "alice", env => { aQ.push(env); aClient.handleEnvelope(env); });
server.attachClient("world1", "bob",   env => { bQ.push(env); bClient.handleEnvelope(env); });

ok(world.players.has("alice"), "alice in world");
ok(world.players.has("bob"),   "bob in world");

// 3. alice sends a move intent. server tick applies + broadcasts snapshot.
server.receiveIntent("world1", "alice", { action: "move", direction: { u: 1, v: 0 } });
const dt = 0.1;
server.tick(dt);

const ap = world.players.get("alice");
ok(ap.u > 0, `alice's position advanced (u=${ap.u.toFixed(3)})`);

// bob's client should now know alice's position via snapshot
ok(bClient.remotePositions.has("alice"), "bob's client has alice's position");
const bView = bClient.remotePositions.get("alice");
ok(Math.abs(bView.u - ap.u) < 1e-9, `bob sees alice at correct u (${bView.u.toFixed(3)})`);

// 4. alice's client also gets a snapshot containing herself
ok(aClient.remotePositions.has("alice"), "alice's client also has self in snapshot");

// 5. Repeated moves accumulate
server.receiveIntent("world1", "alice", { action: "move", direction: { u: 1, v: 0 } });
server.receiveIntent("world1", "alice", { action: "move", direction: { u: 1, v: 0 } });
server.tick(dt);
const ap2 = world.players.get("alice");
ok(ap2.u > ap.u, `alice moved further (${ap2.u.toFixed(2)} > ${ap.u.toFixed(2)})`);

// 6. Different direction
server.receiveIntent("world1", "bob", { action: "move", direction: { u: 0, v: 1 } });
server.tick(dt);
const bp = world.players.get("bob");
ok(bp.v > 0 && bp.u === 0, `bob moved along +v only (u=${bp.u}, v=${bp.v.toFixed(2)})`);

// 7. detach removes from world + room
server.detachClient("world1", "bob");
ok(!world.players.has("bob"), "bob removed from world");
server.tick(dt);
const lastA = aQ[aQ.length - 1];
ok(!Object.keys(lastA.payload.positions).includes("bob"), "bob no longer in snapshots");

// 8. Idle intent (no move) doesn't crash
server.receiveIntent("world1", "alice", null);
server.receiveIntent("world1", "alice", { action: "noop" });
server.tick(dt);
ok(true, "idle/null intents handled without error");

// 9. Snapshots carry vclock
const lastSnap = aQ[aQ.length - 1];
ok(typeof lastSnap.vclock.S === "number", `snapshot has hub's nodeId in vclock`);
ok(lastSnap.cwp === "1.0", "snapshot is CWP v1.0");

// 10. Multi-room isolation
const room2 = MP.createServer({ world: new WorldState(2), nodeId: "S2" });
const cQ = [];
room2.attachClient("worldX", "carol", env => cQ.push(env));
ok(room2.world.players.has("carol"), "carol in room2 world");
ok(!world.players.has("carol"), "carol NOT in world1");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
