// test_iter_29.js — app framework lifecycle.
const Apps = require("./app_framework.js");
const Comp = require("./computer.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

Apps._clearAll();

// 1. Register an app
let initCalls = 0;
Apps.registerApp({
  id: "notepad",
  name: "Notepad",
  icon: "📝",
  category: "productivity",
  init: () => { initCalls++; return { lines: [] }; },
  render: (state) => state.lines.join("\n"),
  handleInput: (state, evt) => {
    if (evt.type === "addLine") return { lines: [...state.lines, evt.text] };
    if (evt.type === "clear")    return { lines: [] };
    return null;
  },
  ipc: (msg) => ({ echoed: msg }),
});
ok(Apps.getApp("notepad") !== null, "notepad registered");
ok(Apps.listApps().includes("notepad"), "notepad in listApps");
ok(Apps.appsByCategory("productivity").includes("notepad"), "category index works");

// Duplicate
let threw = false;
try { Apps.registerApp({ id: "notepad" }); } catch (e) { threw = true; }
ok(threw, "duplicate registration throws");

// Missing id
let threw2 = false;
try { Apps.registerApp({}); } catch (e) { threw2 = true; }
ok(threw2, "missing id throws");

// 2. Instantiate on a computer
const pc = Comp.makeComputer();
Comp.installApp(pc, "notepad");
const inst = Apps.instantiate("notepad", pc);
ok(inst.ok === true, "instantiate ok");
ok(inst.instance.state.lines.length === 0, "init state");
ok(initCalls === 1, "init called once");

// 3. render
ok(Apps.render(inst.instance) === "", "render initial empty");

// 4. input → state mutation
Apps.input(inst.instance, { type: "addLine", text: "hello" });
Apps.input(inst.instance, { type: "addLine", text: "world" });
ok(Apps.render(inst.instance) === "hello\nworld", "two lines rendered");

Apps.input(inst.instance, { type: "clear" });
ok(Apps.render(inst.instance) === "", "clear works");

// 5. Unknown event ignored
const before = inst.instance.state;
Apps.input(inst.instance, { type: "unknown" });
ok(inst.instance.state === before, "unknown event leaves state untouched");

// 6. Two computers, same app, independent state
const pcA = Comp.makeComputer();
const pcB = Comp.makeComputer();
Comp.installApp(pcA, "notepad"); Comp.installApp(pcB, "notepad");
const iA = Apps.instantiate("notepad", pcA).instance;
const iB = Apps.instantiate("notepad", pcB).instance;
Apps.input(iA, { type: "addLine", text: "A only" });
ok(Apps.render(iA) === "A only", "iA has line");
ok(Apps.render(iB) === "", "iB is independent (still empty)");

// 7. IPC between apps
Apps.registerApp({
  id: "echo_caller",
  init: () => ({}),
  render: () => "",
  handleInput: () => null,
  ipc: () => null,
});
const callerInst = Apps.instantiate("echo_caller", pc).instance;
const reply = Apps.ipc(callerInst, "notepad", { hello: "world" });
ok(reply.ok === true, "ipc ok");
ok(reply.reply.echoed.hello === "world", "ipc reply has echo");

const noTgt = Apps.ipc(callerInst, "ghost", {});
ok(noTgt.ok === false, "ipc to missing app fails");

// 8. launchOnComputer wrapper — sit + launch + instantiate
const pc2 = Comp.makeComputer();
Comp.installApp(pc2, "notepad");
Comp.sit(pc2, "alice");
const launched = Apps.launchOnComputer(pc2, "notepad", "alice");
ok(launched.ok === true, "launchOnComputer ok");
ok(pc2.activeApp === "notepad", "computer.activeApp set");

// Without sitting
const pc3 = Comp.makeComputer();
Comp.installApp(pc3, "notepad");
const launchedFail = Apps.launchOnComputer(pc3, "notepad", "bob");
ok(launchedFail.ok === false, "launch without sit fails");

// 9. Instantiate unknown app
const bad = Apps.instantiate("missing_app", pc);
ok(bad.ok === false && bad.reason === "no_such_app", "instantiate unknown rejected");

// 10. Render of null instance returns ""
ok(Apps.render(null) === "", "render(null) → empty string");
ok(Apps.input(null, {}) === null, "input(null) → null");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
