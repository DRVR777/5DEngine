// test_iter_38.js — packet recorder + replay + hub instrumentation.
const Dbg = require("./debug.js");
const Net = require("./net.js");
const MP  = require("./multiplayer.js");
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

// 1. Recorder captures events
const rec = Dbg.createRecorder();
rec.record("out", "room:1", { cwp: "1.0", type: "ping", payload: {} });
rec.record("in",  "client", { cwp: "1.0", type: "pong", payload: {} });
ok(rec.events.length === 2, "2 events recorded");
ok(rec.events[0].direction === "out", "first event direction = out");
ok(rec.events[1].env.type === "pong", "second event type = pong");

// 2. pause/resume/clear
rec.pause();
rec.record("out", "x", { cwp: "1.0", type: "skipped" });
ok(rec.events.length === 2, "pause prevents recording");
rec.resume();
rec.record("out", "x", { cwp: "1.0", type: "after" });
ok(rec.events.length === 3, "resume re-enables");
rec.clear();
ok(rec.events.length === 0, "clear empties");

// 3. snapshot is JSON-serializable
rec.record("out", "r", { cwp: "1.0", type: "x" });
const snap = rec.snapshot();
ok(snap.version === "5DEngine.replay/1", "snapshot has version");
ok(snap.events.length === 1, "snapshot carries events");
const json = JSON.stringify(snap);
const back = JSON.parse(json);
ok(back.events[0].env.type === "x", "JSON round-trip preserves data");

// 4. replay sink invocation
const seen = [];
const r1 = Dbg.replay(snap, e => seen.push(e.env.type));
ok(r1.ok === true && seen.length === 1, "replay invoked sink");
ok(seen[0] === "x", "sink got correct event");

// 5. Hub instrumentation captures public broadcasts
// (joinRoom internally calls a closure-local broadcast that bypasses
// instrumentation — we only assert the public-API path here.)
const hub = Net.createHub({ nodeId: "S" });
const rec2 = Dbg.createRecorder();
Dbg.instrumentHub(hub, rec2);

const sink = [];
hub.joinRoom("world1", "alice", env => sink.push(env));
hub.joinRoom("world1", "bob",   env => sink.push(env));
hub.broadcast("world1", Net.encodeEnvelope("chat", { text: "hi" }), null);
hub.broadcast("world1", Net.encodeEnvelope("ping", {}), null);

ok(rec2.events.length === 2, `2 public broadcasts captured (got ${rec2.events.length})`);
const types = rec2.events.map(e => e.env.type);
ok(types.includes("chat"), "captured chat");
ok(types.includes("ping"), "captured ping");

// 6. Client instrumentation captures incoming
const client = MP.createClient();
const rec3 = Dbg.createRecorder();
Dbg.instrumentClient(client, rec3, "alice");
client.handleEnvelope({ cwp: "1.0", type: "snapshot", payload: { positions: { alice: { u: 5, v: 5 } } } });
ok(rec3.events.length === 1, "client incoming captured");
ok(rec3.events[0].direction === "in", "client capture direction = in");
ok(rec3.events[0].channel === "alice", "channel passed through");
ok(client.remotePositions.has("alice"), "underlying handler still ran");

// 7. Stats
const stats = Dbg.stats(rec2.events);
ok(stats.total === rec2.events.length, "stats total matches");
ok(stats.totalBytes > 0, "byte count > 0");
ok(typeof stats.byType.chat === "number", "byType counts chat");

// 8. Filter
const onlyOut = Dbg.filter(rec2.events, e => e.direction === "out");
ok(onlyOut.length === rec2.events.length, "all hub events are out");

// 9. assertContainsType
let threw = false;
try { Dbg.assertContainsType(rec2.events, "chat", 1); } catch (e) { threw = true; }
ok(!threw, "assertContainsType passes for 1 chat");
try { Dbg.assertContainsType(rec2.events, "missing"); } catch (e) { threw = true; }
ok(threw, "assertContainsType throws when missing");

// 10. assertOrdered: chat before ping (we broadcast chat then ping above)
let threw2 = false;
try { Dbg.assertOrdered(rec2.events, "chat", "ping"); } catch (e) { threw2 = true; }
ok(!threw2, "ordered chat → ping passes");
try { Dbg.assertOrdered(rec2.events, "ping", "chat"); } catch (e) { threw2 = true; }
ok(threw2, "wrong order throws");

// 11. End-to-end replay against multiplayer hub:
// record alice + bob exchanging, then replay into a fresh client-side
// snapshot map and verify positions reconstruct.
const w2 = new WorldState(1);
const server2 = MP.createServer({ world: w2, nodeId: "S2" });
const recE2E = Dbg.createRecorder();
Dbg.instrumentHub(server2.hub, recE2E);
const aSink = [], bSink = [];
const aClient = MP.createClient();
const bClient = MP.createClient();
server2.attachClient("w", "alice", env => { aSink.push(env); aClient.handleEnvelope(env); });
server2.attachClient("w", "bob",   env => { bSink.push(env); bClient.handleEnvelope(env); });
server2.receiveIntent("w", "alice", { action: "move", direction: { u: 1, v: 0 } });
server2.tick(0.1);
ok(recE2E.events.length > 0, "e2e captured events");

// Replay into a fresh client → positions reconstruct
const fresh = MP.createClient();
Dbg.replay(recE2E.snapshot(), e => fresh.handleEnvelope(e.env));
ok(fresh.remotePositions.has("alice"), "replay reconstructed alice's position");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
