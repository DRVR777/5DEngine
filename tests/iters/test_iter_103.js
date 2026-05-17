// test_iter_103.js — spectator director: registration, auto-switch, transitions.
const S = require("./spectator_director.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. registerCamera
const dir = S.createDirector();
const r1 = dir.registerCamera({ id: "cam_a", pos: { u: 0, v: 0 }, target: { u: 10, v: 0 } });
ok(r1.ok, "register a");
ok(dir.activeCamera().id === "cam_a", "first cam is active");

dir.registerCamera({ id: "cam_b", pos: { u: 20, v: 0 }, target: { u: 10, v: 0 } });
ok(dir.listCameras().length === 2, "2 cameras");

// Bad registers
ok(dir.registerCamera({}).ok === false, "missing id");
ok(dir.registerCamera({ id: "cam_a" }).ok === false, "duplicate");

// 2. focusOn manual
ok(dir.focusOn("cam_b").ok, "focus on b");
ok(dir.activeCamera().id === "cam_b", "b is active");
ok(dir.focusOn("ghost").ok === false, "ghost focus fails");

// 3. updateCamera
ok(dir.updateCamera("cam_a", { pos: { u: 100, v: 0 } }).ok, "update");
ok(dir.listCameras().find(c => c.id === "cam_a").pos.u === 100, "pos updated");
ok(dir.updateCamera("ghost", {}).ok === false, "ghost update");

// 4. unregisterCamera
ok(dir.unregisterCamera("cam_b").ok, "unreg b");
ok(dir.listCameras().length === 1, "1 cam left");
ok(dir.activeCamera().id === "cam_a", "active falls back to a");

// 5. Auto-switch by score (with hysteresis)
const dir2 = S.createDirector({ config: { minHoldMs: 0, transitionMs: 100, hysteresis: 0.1 } });
let scoreA = 10, scoreB = 5;
dir2.registerCamera({
  id: "a", pos: { u: 0, v: 0 }, target: { u: 0, v: 0 },
  scoreFn: () => scoreA,
});
dir2.registerCamera({
  id: "b", pos: { u: 100, v: 0 }, target: { u: 0, v: 0 },
  scoreFn: () => scoreB,
});

let now = 1000;
let s1 = dir2.tick({ now });
ok(s1.camId === "a", "a active (higher score)");
ok(!s1.transitioning, "not transitioning");

// b doesn't beat a + 10% hysteresis
scoreB = 11;
let s2 = dir2.tick({ now: now + 100 });
ok(s2.camId === "a", `a stays (b=11 not >a=10*1.1=11) (got ${s2.camId})`);

// b passes hysteresis
scoreB = 12;
let s3 = dir2.tick({ now: now + 200 });
ok(s3.camId === "b", `switched to b (got ${s3.camId})`);
ok(s3.transitioning, "transitioning");
// Mid-transition tick (50ms into 100ms transition)
let s3b = dir2.tick({ now: now + 250 });
ok(s3b.t > 0 && s3b.t < 1, `transition t in (0,1) at mid (got ${s3b.t})`);

// 6. Transition completes
let s4 = dir2.tick({ now: now + 200 + 200 });   // past transitionMs=100
ok(!s4.transitioning, "transition complete");
ok(s4.t === 1, "t=1 after");

// 7. minHold prevents thrashing
const dir3 = S.createDirector({ config: { minHoldMs: 5000, hysteresis: 0, transitionMs: 0 } });
let sX = 10, sY = 5;
dir3.registerCamera({ id: "x", scoreFn: () => sX });
dir3.registerCamera({ id: "y", scoreFn: () => sY });
let n = 10000;
dir3.tick({ now: n });
ok(dir3.activeCamera().id === "x", "x active");

// y beats x immediately
sY = 99;
let switched = dir3.tick({ now: n + 100 });
ok(switched.camId === "x", "x still active (minHold not met)");

// Wait past minHold
let later = dir3.tick({ now: n + 6000 });
ok(later.camId === "y", "switched after minHold");

// 8. Transition styles
const dir4 = S.createDirector({ config: { minHoldMs: 0, transition: "cut", transitionMs: 0 } });
dir4.registerCamera({ id: "a", scoreFn: () => 1 });
dir4.registerCamera({ id: "b", scoreFn: () => 100 });
const sCut = dir4.tick({ now: 1000 });
ok(sCut.camId === "b", "cut to b");

// setTransition validation
ok(dir4.setTransition("fade").ok, "set fade");
ok(dir4.setTransition("weird").ok === false, "bad transition rejected");

// 9. setMinHold
ok(dir4.setMinHold(0).ok, "set minHold 0");
ok(dir4.setMinHold(-1).ok === false, "negative rejected");
ok(dir4.setMinHold("text").ok === false, "non-number");

// 10. ctx passed to scoreFn
const dir5 = S.createDirector({ config: { minHoldMs: 0, hysteresis: 0, transitionMs: 0 } });
let receivedCtx = null;
dir5.registerCamera({
  id: "a",
  scoreFn: (cam, ctx) => { receivedCtx = ctx; return 1; },
});
dir5.tick({ now: 1, customField: "hello" });
ok(receivedCtx.customField === "hello", "ctx passed through");

// 11. Score fn throws → handled
const dir6 = S.createDirector({ config: { minHoldMs: 0 } });
dir6.registerCamera({ id: "throwy", scoreFn: () => { throw new Error("boom"); } });
dir6.registerCamera({ id: "safe", scoreFn: () => 5 });
const res = dir6.tick();
ok(res.camId === "safe", "thrown scoreFn → fallback to safer cam");

// 12. Auto-switch logs history
const dir7 = S.createDirector({ config: { minHoldMs: 0, hysteresis: 0, transitionMs: 0 } });
dir7.registerCamera({ id: "low", scoreFn: () => 1 });
dir7.registerCamera({ id: "high", scoreFn: () => 100 });
dir7.tick({ now: 1000 });
const hist = dir7.getHistory();
ok(hist.length >= 1 && hist[hist.length - 1].id === "high", "high in history");

// 13. recentEvents
const ev = dir.recentEvents();
ok(ev.length > 0, "events");
ok(ev.some(e => e.kind === "register"), "register events");

// 14. activeCamera null on empty
const empty = S.createDirector();
ok(empty.activeCamera() === null, "empty: null active");
ok(empty.tick() === null, "tick on empty = null");

// 15. Transition lerp midpoint
const dir8 = S.createDirector({ config: { minHoldMs: 0, hysteresis: 0, transitionMs: 1000, transition: "ease" } });
dir8.registerCamera({ id: "a", pos: { u: 0, v: 0 }, target: { u: 0, v: 0 }, scoreFn: () => 1 });
dir8.registerCamera({ id: "b", pos: { u: 100, v: 0 }, target: { u: 0, v: 0 }, scoreFn: () => 100 });

let now2 = 50000;
dir8.tick({ now: now2 });    // a→b switch starts
const mid = dir8.tick({ now: now2 + 500 });
ok(mid.transitioning, "mid transitioning");
ok(mid.pos.u > 0 && mid.pos.u < 100, `mid pos.u in (0, 100) (got ${mid.pos.u})`);

// 16. Manual focus updates history
const dir9 = S.createDirector();
dir9.registerCamera({ id: "a" });
dir9.registerCamera({ id: "b" });
dir9.focusOn("b");
const h9 = dir9.getHistory();
ok(h9.length >= 1 && h9[h9.length - 1].id === "b", "manual focus in history");

// 17. Unregister active → fallback
const dir10 = S.createDirector();
dir10.registerCamera({ id: "x" });
dir10.registerCamera({ id: "y" });
ok(dir10.activeCamera().id === "x", "x active first");
dir10.unregisterCamera("x");
ok(dir10.activeCamera().id === "y", "y becomes active");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
