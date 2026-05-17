// test_iter_90.js — mod_sandbox: signature, capability gating, vm exec.
const MS = require("./mod_sandbox.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkMod(manifest, source) {
  const sig = MS.signManifest(manifest, source);
  return { manifest: Object.assign({}, manifest, { signature: sig }), source };
}

// 1. createLoader
const loader = MS.createLoader({
  allowedCapabilities: ["ui.toast", "world.spawn"],
});
let toastCalls = [];
loader.registerCapability("ui.toast", (msg) => { toastCalls.push(msg); });
let spawnCalls = [];
loader.registerCapability("world.spawn", (e) => { spawnCalls.push(e); });

ok(loader.listAllowedCapabilities().length === 2, "2 allowed caps");
ok(loader.listRegisteredCapabilities().includes("ui.toast"), "ui.toast registered");

// 2. Bad package shapes
ok(loader.load(null).ok === false, "null pkg rejected");
ok(loader.load({}).ok === false, "empty pkg rejected");
ok(loader.load({ manifest: {}, source: "x" }).ok === false, "missing id rejected");

// 3. registerCapability validation
let threw = false;
try { loader.registerCapability("", () => {}); } catch (e) { threw = true; }
ok(threw, "empty name throws");
threw = false;
try { loader.registerCapability("x", null); } catch (e) { threw = true; }
ok(threw, "non-function throws");

// 4. Valid mod loads
const goodMod = mkMod(
  { id: "hello", version: "1.0.0", author: "alice", capabilities: ["ui.toast"] },
  "module.exports = { greet: () => 'hi' };"
);
const lr = loader.load(goodMod);
ok(lr.ok === true, `load ok (reason: ${lr.reason || "none"})`);
ok(lr.handle.id === "hello", "handle id");
ok(lr.handle.version === "1.0.0", "version");

// 5. Sandbox: no require leak
const evilMod = mkMod(
  { id: "evil", version: "1.0.0", capabilities: [] },
  "module.exports = { test: () => typeof require };"
);
const er = loader.load(evilMod);
ok(er.ok === true, "loads (no caps requested)");
const result = er.handle.callHook("test");
ok(result.ok && result.value === "undefined", `no require leak (got ${result.value})`);

// 6. Capability gating: requesting unallowed cap fails
const noPermMod = mkMod(
  { id: "noperm", version: "1.0.0", capabilities: ["dangerous.fs"] },
  "module.exports = {};"
);
const r2 = loader.load(noPermMod);
ok(r2.ok === false && r2.reason === "capability_denied", "denied cap rejected");

// 7. Missing capability impl
loader.allowCapability("ghost.api");
const missingMod = mkMod(
  { id: "missing", version: "1.0.0", capabilities: ["ghost.api"] },
  "module.exports = {};"
);
const r3 = loader.load(missingMod);
ok(r3.ok === false && r3.reason === "capability_missing", "missing impl rejected");

// 8. Bad signature
const tampered = mkMod(
  { id: "tamper", version: "1.0.0", capabilities: ["ui.toast"] },
  "module.exports = {};"
);
tampered.manifest.signature = "deadbeef";
const r4 = loader.load(tampered);
ok(r4.ok === false && r4.reason === "bad_signature", "tampered sig rejected");

// 9. Mod can call granted capabilities via namespaced binding (ui.toast → ui.toast(...))
const toastMod = mkMod(
  { id: "toaster", version: "1.0.0", capabilities: ["ui.toast"] },
  `module.exports = {
    onLoad: () => { ui.toast("hello from mod"); },
    sayHi: (name) => { ui.toast("hi " + name); },
  };`
);
const tr = loader.load(toastMod);
ok(tr.ok === true, "toaster loads");
tr.handle.callHook("onLoad");
ok(toastCalls.includes("hello from mod"), "mod invoked ui.toast capability");
tr.handle.callHook("sayHi", "alice");
ok(toastCalls.includes("hi alice"), "mod passed arg through");

// 10. Hook not present
const noHook = tr.handle.callHook("nothere");
ok(noHook.ok === false && noHook.reason === "no_hook", "missing hook reported");

// 11. Hook throws — caught
const throwMod = mkMod(
  { id: "throwy", version: "1.0.0", capabilities: [] },
  "module.exports = { bad: () => { throw new Error('boom'); } };"
);
const ttr = loader.load(throwMod);
const thrown = ttr.handle.callHook("bad");
ok(thrown.ok === false && thrown.reason === "hook_threw", "thrown hook caught");

// 12. Duplicate id rejected
const dup = mkMod(
  { id: "hello", version: "2.0.0", capabilities: [] },
  "module.exports = {};"
);
ok(loader.load(dup).ok === false, "duplicate id rejected");

// 13. Unload + onUnload fires
const cleanupMod = mkMod(
  { id: "cleanup", version: "1.0.0", capabilities: [] },
  `let counter = 0; module.exports = {
    bump: () => ++counter,
    onUnload: () => { module.exports._wasUnloaded = true; },
  };`
);
const cr = loader.load(cleanupMod);
ok(cr.ok === true, "cleanup loaded");
cr.handle.callHook("bump");
loader.unload("cleanup");
ok(cr.handle.exports._wasUnloaded === true, "onUnload fired");
ok(loader.get("cleanup") === null, "removed");
ok(loader.unload("cleanup").ok === false, "double unload fails");

// 14. listInstalled
ok(loader.listInstalled().length >= 2, `at least 2 installed (got ${loader.listInstalled().length})`);

// 15. Source bytes cap
const tooBig = mkMod(
  { id: "big", version: "1.0.0", capabilities: [] },
  "x".repeat(2 << 20),
);
const bigLoader = MS.createLoader({ config: { maxModBytes: 1024 } });
ok(bigLoader.load(tooBig).ok === false, "too-large rejected");

// 16. Multiple capabilities granted at once
const multiMod = mkMod(
  { id: "multi", version: "1.0.0", capabilities: ["ui.toast", "world.spawn"] },
  `module.exports = {
    doStuff: () => { ui.toast("a"); world.spawn({u: 1, v: 2}); },
  };`
);
const mr = loader.load(multiMod);
ok(mr.ok === true, `multi-cap load ok`);
mr.handle.callHook("doStuff");
ok(toastCalls.includes("a"), "ui.toast called");
ok(spawnCalls.length > 0 && spawnCalls[0].u === 1, "world.spawn called");

// 17. Custom verifyFn
let verifyCalled = false;
const customLoader = MS.createLoader({
  allowedCapabilities: ["x"],
  config: { verifyFn: () => { verifyCalled = true; return true; } },
});
customLoader.registerCapability("x", () => "x");
const cm = customLoader.load({
  manifest: { id: "c", version: "1.0.0", capabilities: ["x"], signature: "anything" },
  source: "module.exports = {};",
});
ok(cm.ok && verifyCalled, "custom verifyFn invoked");

// 18. Source eval errors caught
const badSrc = mkMod(
  { id: "syntax", version: "1.0.0", capabilities: [] },
  "this is not valid js !!@#",
);
const ev = loader.load(badSrc);
ok(ev.ok === false && ev.reason === "eval_error", "syntax error caught");

// 19. signManifest is deterministic
const m1 = { id: "x", version: "1.0", capabilities: [] };
const src = "module.exports = {};";
ok(MS.signManifest(m1, src) === MS.signManifest(m1, src), "sign deterministic");

// 20. Recent events
const events = loader.recentEvents();
ok(events.length > 0, "events logged");
ok(events.some(e => e.kind === "load"), "load events");
ok(events.some(e => e.kind === "verify_fail"), "verify_fail event");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
