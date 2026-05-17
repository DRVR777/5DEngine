// test_iter_50.js — network_monitor app reading a debug Recorder.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");
const Dbg  = require("./debug.js");
const Net  = require("./net.js");
const NM   = require("./apps/network_monitor.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();
Apps.registerApp(NM.APP);

// 1. No recorder → graceful message
const pc = Comp.makeComputer();
const noRec = Apps.instantiate("network_monitor", pc).instance;
ok(Apps.render(noRec).includes("no recorder"), "no recorder message");

// 2. With recorder
const rec = Dbg.createRecorder();
rec.record("out", "room:1", Net.encodeEnvelope("intent", { action: "move" }));
rec.record("in",  "alice",  Net.encodeEnvelope("snapshot", { positions: {} }));
rec.record("out", "room:1", Net.encodeEnvelope("intent", { action: "move" }));

const nm = Apps.instantiate("network_monitor", pc, { recorder: rec }).instance;
const r1 = Apps.render(nm);
ok(r1.includes("intent"), "intent visible in render");
ok(r1.includes("snapshot"), "snapshot visible in render");
ok(r1.includes("total:3"), "total count shown");
ok(r1.includes("→"), "out arrow rendered");
ok(r1.includes("←"), "in arrow rendered");

// 3. Filter by type
Apps.input(nm, { type: "set_filter", value: "intent" });
const r2 = Apps.render(nm);
ok(r2.includes("intent"), "still shows intent");
ok(!r2.includes("snapshot"), "snapshot filtered out");
ok(r2.includes("shown:2"), "shows 2 intent events");

// Clear filter
Apps.input(nm, { type: "set_filter", value: null });
const r3 = Apps.render(nm);
ok(r3.includes("shown:3"), "filter cleared → all 3 shown");

// 4. Filter by direction
Apps.input(nm, { type: "set_dir", value: "out" });
const r4 = Apps.render(nm);
ok(r4.includes("shown:2"), "out direction → 2 events");
Apps.input(nm, { type: "set_dir", value: "in" });
ok(Apps.render(nm).includes("shown:1"), "in direction → 1 event");
Apps.input(nm, { type: "set_dir", value: null });
ok(Apps.render(nm).includes("shown:3"), "no filter → all 3");

// Bad direction ignored
const beforeBad = JSON.stringify(nm.state);
Apps.input(nm, { type: "set_dir", value: "diagonal" });
ok(JSON.stringify(nm.state) === beforeBad, "bad direction value ignored");

// 5. Pause/resume — pauses display? In our app pause is just flag, render
// still shows what's already there. Verify flag toggles.
Apps.input(nm, { type: "pause" });
ok(nm.state.paused === true, "paused");
ok(Apps.render(nm).includes("PAUSED"), "render shows PAUSED");
Apps.input(nm, { type: "resume" });
ok(nm.state.paused === false, "resumed");
ok(Apps.render(nm).includes("live"), "render shows live");

// 6. set_view_lines
Apps.input(nm, { type: "set_view_lines", value: 1 });
ok(nm.state.viewLines === 1, "viewLines 1");
ok(Apps.render(nm).split("\n").length <= 3, "render shows ~1 event line + header");

// Clamp
Apps.input(nm, { type: "set_view_lines", value: 99999 });
ok(nm.state.viewLines === 100, "viewLines clamped to 100");
Apps.input(nm, { type: "set_view_lines", value: -5 });
ok(nm.state.viewLines === 1, "viewLines clamped to 1");

// 7. Clear wipes recorder
Apps.input(nm, { type: "clear" });
ok(rec.events.length === 0, "recorder cleared");
ok(Apps.render(nm).includes("(no events)"), "empty render");

// 8. Live add reflected on next render
rec.record("out", "room:1", Net.encodeEnvelope("chat", { text: "hi" }));
const r5 = Apps.render(nm);
ok(r5.includes("chat"), "live event appears");
ok(r5.includes("total:1"), "total updated");

// 9. IPC stats
const ipcReply = Apps.ipc(nm, "network_monitor", { type: "stats", recorder: rec });
ok(ipcReply.ok === true, "IPC ok");
ok(ipcReply.reply.total === 1, "IPC stats total");
ok(ipcReply.reply.byType.chat === 1, "IPC byType breakdown");

// 10. Padding/formatting handles long channels
rec.record("out", "very-long-channel-name", Net.encodeEnvelope("ping", {}));
const r6 = Apps.render(nm);
ok(r6.includes("very-long-channel-name"), "long channel rendered");
ok(r6.includes("ping"), "ping rendered");

// 11. Multiple types visible
Apps.input(nm, { type: "set_view_lines", value: 20 });
rec.record("out", "x", Net.encodeEnvelope("hello", {}));
rec.record("out", "x", Net.encodeEnvelope("goodbye", {}));
const r7 = Apps.render(nm);
ok(r7.includes("hello") && r7.includes("goodbye") && r7.includes("ping"),
   "all event types visible together");

// 12. Filter applies before view-lines truncation
Apps.input(nm, { type: "set_filter", value: "ping" });
const r8 = Apps.render(nm);
ok(r8.includes("ping") && !r8.includes("hello") && !r8.includes("goodbye"),
   "filter works after multiple new events");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
