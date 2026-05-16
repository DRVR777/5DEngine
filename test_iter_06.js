// test_iter_06.js — walk-cycle phase math.
// Run: node gta_demo/test_iter_06.js
const Bridge = require("./engine_bridge.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

ok(typeof Bridge.walkCyclePhase === "function", "walkCyclePhase exported");
ok(/iter[6-9]\d*/.test(Bridge.VERSION), `VERSION at iter6+ (got ${Bridge.VERSION})`);

// Idle (speed=0) → minimal swing
let s = { t: 0 };
const idle = Bridge.walkCyclePhase(s, 0.05, 0);
ok(Math.abs(idle.swing) < 0.3 && Math.abs(idle.bob) < 0.05,
   `idle swing/bob small (swing=${idle.swing.toFixed(2)}, bob=${idle.bob.toFixed(2)})`);

// Walking (speed≈5 = WALK constant) → significant swing within 0.5s
s = { t: 0 };
let maxSwing = 0;
for (let i = 0; i < 30; i++) {
  const w = Bridge.walkCyclePhase(s, 1/60, 5);
  if (Math.abs(w.swing) > maxSwing) maxSwing = Math.abs(w.swing);
}
ok(maxSwing > 0.4, `walking peak swing > 0.4 (got ${maxSwing.toFixed(2)})`);

// Sprinting cycles faster than walking — measure by state.t advancement.
function tAfter(speed, ticks) {
  const ss = { t: 0 };
  for (let i = 0; i < ticks; i++) Bridge.walkCyclePhase(ss, 1/60, speed);
  return ss.t;
}
const tWalk   = tAfter(5, 240);
const tSprint = tAfter(9, 240);
ok(tSprint > tWalk * 1.3,
   `sprint advances phase faster (tSprint=${tSprint.toFixed(2)} > 1.3*tWalk=${(tWalk*1.3).toFixed(2)})`);

// Bob is always non-negative
let allBobOk = true;
const ts = { t: 0 };
for (let i = 0; i < 100; i++) {
  const w = Bridge.walkCyclePhase(ts, 1/60, 5);
  if (w.bob < 0) allBobOk = false;
}
ok(allBobOk, "bob is always >= 0");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
