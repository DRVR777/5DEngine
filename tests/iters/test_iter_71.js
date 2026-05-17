// test_iter_71.js — minimap_markers app wraps waypoint system.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");
const FW = require("./fog_of_war.js");
const MM = require("./apps/minimap_markers.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();
Apps.registerApp(MM.APP);
ok(MM.KINDS.length === 6, "6 marker kinds");
ok(MM.KINDS.includes("objective"), "objective kind");
ok(MM.KINDS.includes("danger"), "danger kind");

// 1. No waypoint system
const pc = Comp.makeComputer();
const inst = Apps.instantiate("minimap_markers", pc).instance;
ok(Apps.render(inst).includes("no waypoint system"), "graceful empty");

// 2. With system, empty
const ws = FW.createWaypointSystem();
const inst2 = Apps.instantiate("minimap_markers", pc, { waypointSystem: ws }).instance;
ok(Apps.render(inst2).includes("No markers"), "no markers msg");

// 3. add marker via app
Apps.input(inst2, { type: "add", id: "treasure", kind: "objective", u: 10, v: 20, label: "Buried Gold" });
ok(ws.get("treasure") !== null, "marker added");
ok(inst2.state.message.includes("added"), "message reports add");

const render1 = Apps.render(inst2);
ok(render1.includes("treasure"), "rendered (label not id)");
ok(render1.includes("Buried Gold"), "label shown");
ok(render1.includes("[objective]"), "kind shown");

// 4. Duplicate id rejected
Apps.input(inst2, { type: "add", id: "treasure", kind: "objective", u: 0, v: 0 });
ok(inst2.state.message.includes("exists"), "duplicate rejected");

// 5. select
Apps.input(inst2, { type: "select", id: "treasure" });
ok(inst2.state.selected === "treasure", "selected");
ok(Apps.render(inst2).includes("▶ "), "cursor in render");

Apps.input(inst2, { type: "select", id: "ghost" });
ok(inst2.state.selected === null, "ghost select clears");
ok(inst2.state.message.includes("not found"), "msg = not found");

// 6. toggle_kind filter
Apps.input(inst2, { type: "add", id: "shop1", kind: "shop", u: 5, v: 5, label: "Bob's" });
Apps.input(inst2, { type: "add", id: "danger1", kind: "danger", u: 0, v: 0, label: "Bandits" });
ok(Apps.render(inst2).includes("Bob's") && Apps.render(inst2).includes("Bandits"),
   "all kinds visible");

Apps.input(inst2, { type: "toggle_kind", kind: "shop" });
ok(!inst2.state.visibleKinds.has("shop"), "shop toggled off");
const r1 = Apps.render(inst2);
ok(!r1.includes("Bob's"), "shop hidden");
ok(r1.includes("Bandits"), "danger still shown");

Apps.input(inst2, { type: "toggle_kind", kind: "shop" });
ok(inst2.state.visibleKinds.has("shop"), "shop toggled back on");

ok(inst2.state === Apps.input(inst2, { type: "toggle_kind", kind: "ghost" }) ||
   inst2.state.visibleKinds.has("shop"), "bad kind ignored gracefully");

// 7. show_all / hide_all
Apps.input(inst2, { type: "hide_all" });
ok(inst2.state.visibleKinds.size === 0, "hide_all → 0 kinds");
ok(Apps.render(inst2).includes("hidden by filter"), "hide msg");

Apps.input(inst2, { type: "show_all" });
ok(inst2.state.visibleKinds.size === 6, "show_all → 6 kinds");

// 8. remove
Apps.input(inst2, { type: "select", id: "treasure" });
Apps.input(inst2, { type: "remove", id: "treasure" });
ok(ws.get("treasure") === null, "removed");
ok(inst2.state.selected === null, "selection cleared on remove");

Apps.input(inst2, { type: "remove", id: "ghost" });
ok(inst2.state.message === "not found", "remove ghost msg");

// 9. clear_message
Apps.input(inst2, { type: "clear_message" });
ok(inst2.state.message === null, "message cleared");

// 10. TTL display
Apps.input(inst2, { type: "add", id: "timed", kind: "custom", u: 0, v: 0, label: "Temp", ttl: 30 });
ok(Apps.render(inst2).includes("30s"), "ttl shown");

// 11. IPC marker_count
const ipcReply = Apps.ipc(inst2, "minimap_markers", { type: "marker_count", state: inst2.state });
ok(ipcReply.ok === true, "IPC ok");
ok(typeof ipcReply.reply.count === "number", "count returned");
ok(ipcReply.reply.count > 0, "non-zero markers");

// 12. Custom color
Apps.input(inst2, { type: "add", id: "colorful", kind: "custom", u: 0, v: 0, color: 0xff00ff });
ok(ws.get("colorful").color === 0xff00ff, "color preserved");

// 13. Default ttl (-1 = persistent)
Apps.input(inst2, { type: "add", id: "persistent", kind: "custom", u: 0, v: 0 });
ok(ws.get("persistent").ttl === -1, "default ttl = -1");

// 14. Unknown event ignored
const beforeState = JSON.stringify({...inst2.state, visibleKinds: [...inst2.state.visibleKinds]});
Apps.input(inst2, { type: "vibes" });
const afterState = JSON.stringify({...inst2.state, visibleKinds: [...inst2.state.visibleKinds]});
ok(beforeState === afterState, "unknown event leaves state unchanged");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
