// test_iter_20.js — CWP v1.0 envelope + vector clocks + Hub.
const Net = require("./net.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

ok(Net.PROTOCOL_VERSION === "1.0", "PROTOCOL_VERSION = 1.0 (frozen)");

// 1. encode + decode round-trip
const env = Net.encodeEnvelope("ping", { hello: "world" }, { session: "s1" });
ok(env.cwp === "1.0", "encoded envelope has cwp=1.0");
ok(env.type === "ping", "type set");
ok(env.payload.hello === "world", "payload preserved");
ok(env.session === "s1", "session preserved");
ok(typeof env.ts === "number", "timestamp added");

const d = Net.decodeEnvelope(env);
ok(d.ok && d.env === env, "decode of object passes through");

const json = JSON.stringify(env);
const d2 = Net.decodeEnvelope(json);
ok(d2.ok && d2.env.type === "ping", "decode of JSON string works");

// Bad inputs
ok(Net.decodeEnvelope("garbage").ok === false, "bad JSON rejected");
ok(Net.decodeEnvelope({ cwp: "0.9" }).ok === false, "wrong protocol rejected");
ok(Net.decodeEnvelope({ cwp: "1.0" }).ok === false, "missing type rejected");
ok(Net.decodeEnvelope(null).ok === false, "null rejected");

// 2. vclock bump & merge
let vc = {};
vc = Net.vclockBump(vc, "A");
ok(vc.A === 1, "bump A → 1");
vc = Net.vclockBump(vc, "A");
ok(vc.A === 2, "bump A → 2");
vc = Net.vclockBump(vc, "B");
ok(vc.A === 2 && vc.B === 1, "B added without disturbing A");

const merged = Net.vclockMerge({ A: 2, B: 1 }, { A: 5, C: 3 });
ok(merged.A === 5 && merged.B === 1 && merged.C === 3, "merge takes per-key max");

// 3. vclock compare
ok(Net.vclockCompare({ A: 1 }, { A: 2 }) === -1, "a precedes b");
ok(Net.vclockCompare({ A: 3 }, { A: 1 }) ===  1, "b precedes a");
ok(Net.vclockCompare({ A: 1, B: 2 }, { A: 2, B: 1 }) === 0, "concurrent");
ok(Net.vclockCompare({ A: 1 }, { A: 1 }) === 0, "equal");

// 4. Hub: join + room_state notification
const hub = Net.createHub({ nodeId: "test_hub" });
const aMsgs = [], bMsgs = [];
hub.joinRoom("world1", "alice", env => aMsgs.push(env));
hub.joinRoom("world1", "bob",   env => bMsgs.push(env));
ok(aMsgs.length === 2,  `alice got room_state then peer_joined for bob (${aMsgs.length})`);
ok(aMsgs[0].type === "room_state", "first msg is room_state");
ok(aMsgs[1].type === "peer_joined", "second msg is peer_joined for bob");
ok(bMsgs.length === 1 && bMsgs[0].type === "room_state", "bob got room_state listing alice");
ok(bMsgs[0].payload.peers.includes("alice"), "bob's room_state lists alice");

// 5. Broadcast — sender excluded
const beforeA = aMsgs.length, beforeB = bMsgs.length;
hub.broadcast("world1", Net.encodeEnvelope("chat", { from: "alice", text: "hi" }), "alice");
ok(aMsgs.length === beforeA, "alice did NOT receive her own broadcast");
ok(bMsgs.length === beforeB + 1, "bob received the broadcast");
ok(bMsgs[bMsgs.length - 1].payload.text === "hi", "bob got the chat text");
ok(typeof bMsgs[bMsgs.length - 1].vclock.test_hub === "number", "vclock has hub's nodeId");

// 6. Intent push
hub.pushIntent("world1", "alice", { action: "move", direction: { u: 1, v: 0 } });
const lastB = bMsgs[bMsgs.length - 1];
ok(lastB.type === "intent", "intent broadcast type");
ok(lastB.payload.clientId === "alice", "intent carries clientId");

// 7. Leave — peer_left fires
hub.leaveRoom("world1", "alice");
const lastBafter = bMsgs[bMsgs.length - 1];
ok(lastBafter.type === "peer_left" && lastBafter.payload.clientId === "alice",
   "peer_left fires for bob");

// 8. Disconnect cleans up
hub.disconnect("bob");
ok(hub.rooms.has("world1") === false, "empty room is removed");
ok(hub.clients.has("bob") === false, "client gone");

// 9. Multiple rooms keep separate vclocks
const hub2 = Net.createHub({ nodeId: "n2" });
hub2.joinRoom("r1", "c1", () => {});
hub2.joinRoom("r2", "c1", () => {});
hub2.broadcast("r1", Net.encodeEnvelope("x", {}), null);
hub2.broadcast("r1", Net.encodeEnvelope("x", {}), null);
hub2.broadcast("r2", Net.encodeEnvelope("y", {}), null);
// Each joinRoom also fires a peer_joined broadcast that bumps vclock once.
// r1: join(+1) + 2 broadcasts(+2) = 3.  r2: join(+1) + 1 broadcast(+1) = 2.
ok(hub2.rooms.get("r1").vclock.n2 === 3, `r1 vclock at 3 (got ${hub2.rooms.get("r1").vclock.n2})`);
ok(hub2.rooms.get("r2").vclock.n2 === 2, `r2 vclock at 2, independent (got ${hub2.rooms.get("r2").vclock.n2})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
