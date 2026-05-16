// test_iter_77.js — input remapping: bind, conflict detect, contexts, persist.
const R = require("./input_remap.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createMap + defineAction
const m = R.createMap();
ok(m.defineAction("jump").ok === true, "define jump");
ok(m.defineAction("jump").ok === false, "duplicate define rejected");
ok(m.listActions().length === 1, "1 action listed");

// 2. bind
ok(m.bind("jump", { device: "keyboard", key: "space" }).ok === true, "bind space");
ok(m.bind("ghost", { device: "keyboard", key: "x" }).ok === false, "bind to unknown action fails");
ok(m.bind("jump", {}).ok === false, "bad binding rejected");
ok(m.bind("jump", { device: "wii", key: "a" }).ok === false, "bad device rejected");

// Already bound
ok(m.bind("jump", { device: "keyboard", key: "space" }).ok === false, "duplicate bind rejected");

// 3. Multiple bindings per action
m.bind("jump", { device: "gamepad", key: "a" });
ok(m.bindingsFor("jump").length === 2, "2 bindings for jump");

// 4. resolve
const acts = m.resolve({ device: "keyboard", key: "space" });
ok(acts.includes("jump"), "space → jump");

const noActs = m.resolve({ device: "keyboard", key: "z" });
ok(noActs.length === 0, "z → nothing");

// Bad input
ok(m.resolve(null).length === 0, "null input → empty");
ok(m.resolve({ device: "keyboard" }).length === 0, "missing key → empty");

// 5. unbind
ok(m.unbind("jump", { device: "gamepad", key: "a" }).ok === true, "unbind ok");
ok(m.bindingsFor("jump").length === 1, "1 binding left");
ok(m.unbind("jump", { device: "gamepad", key: "a" }).ok === false, "unbind missing fails");
ok(m.unbind("ghost", { device: "keyboard", key: "x" }).ok === false, "unbind unknown action fails");

// 6. clearBindings
m.defineAction("test");
m.bind("test", { device: "keyboard", key: "t" });
ok(m.clearBindings("test").ok === true, "clear ok");
ok(m.bindingsFor("test").length === 0, "no bindings after clear");

// 7. Contexts: foot vs vehicle
const m2 = R.createMap();
m2.defineAction("fire", { contexts: ["foot"] });
m2.defineAction("honk", { contexts: ["vehicle"] });
m2.bind("fire", { device: "mouse", key: "left" });
m2.bind("honk", { device: "mouse", key: "left" });

ok(m2.getContext() === "default", "default context");
m2.setContext("foot");
ok(m2.resolve({ device: "mouse", key: "left" }).includes("fire"), "foot ctx → fire");
ok(!m2.resolve({ device: "mouse", key: "left" }).includes("honk"), "foot ctx not honk");
m2.setContext("vehicle");
ok(m2.resolve({ device: "mouse", key: "left" }).includes("honk"), "vehicle ctx → honk");
ok(!m2.resolve({ device: "mouse", key: "left" }).includes("fire"), "vehicle ctx not fire");

// 8. global context overrides
m2.defineAction("photo", { contexts: ["global"] });
m2.bind("photo", { device: "keyboard", key: "p" });
m2.setContext("foot");
ok(m2.resolve({ device: "keyboard", key: "p" }).includes("photo"), "global action fires in foot ctx");

// 9. Conflict detection
const m3 = R.createMap();
m3.defineAction("a", { contexts: ["foot"] });
m3.defineAction("b", { contexts: ["foot"] });
m3.defineAction("c", { contexts: ["vehicle"] });
m3.bind("a", { device: "mouse", key: "left" });
m3.bind("b", { device: "mouse", key: "left" });  // CONFLICT
m3.bind("c", { device: "mouse", key: "left" });  // separate context — NOT a conflict

const cs = m3.detectConflicts();
ok(cs.length === 1, `1 conflict (got ${cs.length})`);
ok(cs[0].context === "foot", "conflict in foot ctx");
ok(cs[0].actions.length === 2, "2 conflicting actions");
ok(cs[0].actions.includes("a") && cs[0].actions.includes("b"), "a + b conflict");

// 10. Modifiers as part of key identity
const m4 = R.createMap();
m4.defineAction("save");
m4.defineAction("save_as");
m4.bind("save",    { device: "keyboard", key: "s", modifiers: ["ctrl"] });
m4.bind("save_as", { device: "keyboard", key: "s", modifiers: ["ctrl", "shift"] });

ok(m4.detectConflicts().length === 0, "different modifiers → no conflict");

// modifiers normalized (sort)
const norm = m4.resolve({ device: "keyboard", key: "s", modifiers: ["shift", "ctrl"] });
ok(norm.includes("save_as"), "modifiers normalized regardless of order");

const ctrlS = m4.resolve({ device: "keyboard", key: "s", modifiers: ["ctrl"] });
ok(ctrlS.includes("save") && !ctrlS.includes("save_as"), "ctrl+s vs ctrl+shift+s disambiguates");

// 11. Persist + load
const j = m4.toJSON();
ok(j.actions.save, "serialized save action");
ok(j.actions.save.bindings.length === 1, "serialized bindings");

const m5 = R.createMap();
ok(m5.fromJSON(j).ok === true, "fromJSON ok");
ok(m5.listActions().length === 2, "loaded 2 actions");
ok(m5.bindingsFor("save").length === 1, "loaded binding");

// Round-trip preservation
ok(JSON.stringify(m5.toJSON()) === JSON.stringify(j), "round-trip preserves structure");

// 12. GTA preset works
const gta = R.gtaPreset();
ok(gta.listActions().length === 14, `gta preset: 14 actions (got ${gta.listActions().length})`);

// Has conflicts because W = walk_forward (foot) AND accelerate (vehicle)
// but in *different* contexts — so NOT a conflict
const gtaConflicts = gta.detectConflicts();
ok(gtaConflicts.length === 0, `gta preset clean (${gtaConflicts.length} conflicts)`);

gta.setContext("foot");
ok(gta.resolve({ device: "keyboard", key: "w" }).includes("walk_forward"), "foot W → walk_forward");
gta.setContext("vehicle");
ok(gta.resolve({ device: "keyboard", key: "w" }).includes("accelerate"), "vehicle W → accelerate");

// 13. Bad setContext
ok(gta.setContext("").ok === false, "empty context rejected");
ok(gta.setContext(null).ok === false, "null context rejected");

// 14. Events logged
const ev = m4.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "bind"), "bind event");

// 15. Stress: bind 100 actions, resolve fast
const big = R.createMap();
for (let i = 0; i < 100; i++) {
  big.defineAction("a" + i);
  big.bind("a" + i, { device: "keyboard", key: "k" + i });
}
ok(big.listActions().length === 100, "100 actions");
ok(big.resolve({ device: "keyboard", key: "k50" }).includes("a50"), "k50 → a50");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
