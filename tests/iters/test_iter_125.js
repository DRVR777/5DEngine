// test_iter_125.js — emote wheel: palettes, open, select, cooldown.
const W = require("./emote_wheel.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. SLOTS
ok(W.SLOTS === 8, "8 slots");

// 2. registerPalette
const sys = W.createWheel();
const fp = [
  "wave", "salute", "dance", "point",
  "thumbs_up", "shrug", "facepalm", "clap",
];
ok(sys.registerPalette("foot", fp).ok, "foot palette");

// Bad palettes
ok(sys.registerPalette("", fp).ok === false, "empty name");
ok(sys.registerPalette("x", "not_array").ok === false, "not array");
ok(sys.registerPalette("x", [1, 2]).ok === false, "wrong length");

// 3. getPalette + listPalettes
ok(sys.getPalette("foot").length === 8, "palette length");
ok(sys.getPalette("ghost") === null, "ghost null");

const vp = ["honk","thumbs_up","wave","wave",null,null,null,null];
sys.registerPalette("vehicle", vp);
ok(sys.listPalettes().length === 2, "2 palettes");

// 4. openWheel
ok(sys.openWheel("alice", "foot", { now: 0 }).ok, "open foot");
ok(sys.isOpen("alice") === true, "is open");
ok(sys.openWheel("alice", "ghost").ok === false, "no palette");

// 5. closeWheel
ok(sys.closeWheel("alice").ok === true, "close");
ok(sys.isOpen("alice") === false, "closed");
ok(sys.closeWheel("alice").ok === false, "double close");

// 6. selectByAngle (0 = N = slot 0 = "wave")
sys.openWheel("alice", "foot", { now: 1000 });
const s1 = sys.selectByAngle("alice", 0, { now: 1000 });
ok(s1.ok === true, "select N ok");
ok(s1.emoteId === "wave", `emote=wave (got ${s1.emoteId})`);
ok(s1.slot === 0, "slot 0");
ok(sys.isOpen("alice") === false, "auto-closes after select");

// 7. selectByVector — up = N (dx=0, dy=-1)
sys.openWheel("alice", "foot", { now: 5000 });
const sv = sys.selectByVector("alice", 0, -1, { now: 5000, cooldownMs: 0 });
ok(sv.ok === true && sv.slot === 0, "vector N → slot 0");

// Right = E = slot 2
sys.openWheel("alice", "foot", { now: 6000 });
const sE = sys.selectByVector("alice", 1, 0, { now: 6000, cooldownMs: 0 });
ok(sE.slot === 2, `vector E → slot 2 (got ${sE.slot})`);

// Down = S = slot 4
sys.openWheel("alice", "foot", { now: 7000 });
const sS = sys.selectByVector("alice", 0, 1, { now: 7000, cooldownMs: 0 });
ok(sS.slot === 4, `vector S → slot 4 (got ${sS.slot})`);

// Left = W = slot 6
sys.openWheel("alice", "foot", { now: 8000 });
const sW = sys.selectByVector("alice", -1, 0, { now: 8000, cooldownMs: 0 });
ok(sW.slot === 6, `vector W → slot 6 (got ${sW.slot})`);

// Zero vector
sys.openWheel("alice", "foot", { now: 9000 });
ok(sys.selectByVector("alice", 0, 0).ok === false, "zero vector");

// 8. selectByIndex
sys.openWheel("alice", "foot", { now: 10000 });
const si = sys.selectByIndex("alice", 3, { now: 10000, cooldownMs: 0 });
ok(si.ok && si.emoteId === "point", "index 3 = point");

ok(sys.selectByIndex("alice", 99).ok === false, "bad index");

// Select while closed
ok(sys.selectByAngle("alice", 0).ok === false, "select while closed");

// 9. Empty slot rejected
sys.openWheel("alice", "vehicle", { now: 20000 });
const empt = sys.selectByIndex("alice", 4, { now: 20000, cooldownMs: 0 });
ok(empt.ok === false && empt.reason === "empty_slot", "empty slot");

// 10. Cooldown
const sys2 = W.createWheel({ config: { defaultCooldownMs: 5000 } });
sys2.registerPalette("foot", fp);
sys2.openWheel("p", "foot", { now: 1000 });
const c1 = sys2.selectByIndex("p", 0, { now: 1000 });
ok(c1.ok === true, "first selection ok");

sys2.openWheel("p", "foot", { now: 2000 });
const c2 = sys2.selectByIndex("p", 0, { now: 2000 });
ok(c2.ok === false && c2.reason === "on_cooldown", "on cooldown");
ok(c2.remainingMs > 0, "remaining > 0");

// After cooldown
sys2.openWheel("p", "foot", { now: 7000 });
const c3 = sys2.selectByIndex("p", 0, { now: 7000 });
ok(c3.ok === true, "off cooldown");

// 11. cooldownRemaining
const cr1 = sys2.cooldownRemaining("p", "wave", { now: 7500 });
ok(cr1 > 0 && cr1 < 5000, `cd remaining (got ${cr1})`);

const cr2 = sys2.cooldownRemaining("p", "wave", { now: 99999 });
ok(cr2 === 0, "long after");

// 12. Per-player cooldowns independent
const sys3 = W.createWheel();
sys3.registerPalette("x", fp);
sys3.openWheel("a", "x", { now: 1000 });
sys3.selectByIndex("a", 0, { now: 1000 });
sys3.openWheel("b", "x", { now: 1000 });
const bSelect = sys3.selectByIndex("b", 0, { now: 1000 });
ok(bSelect.ok === true, "b not affected by a's cooldown");

// 13. Per-emote cooldowns independent (different emote = no cooldown)
const sys4 = W.createWheel();
sys4.registerPalette("x", fp);
sys4.openWheel("p", "x", { now: 0 });
sys4.selectByIndex("p", 0, { now: 0 });   // wave
sys4.openWheel("p", "x", { now: 100 });
const s5 = sys4.selectByIndex("p", 1, { now: 100 });   // salute - different emote
ok(s5.ok === true, "different emote not on cooldown");

// 14. unregisterPalette
ok(sys.unregisterPalette("vehicle") === true, "unreg");
ok(sys.getPalette("vehicle") === null, "gone");

// 15. _slotFromAngle - exhaustive
const ang = 2 * Math.PI / 8;   // each slot = π/4
ok(sys._slotFromAngle(0) === 0, "0 rad = slot 0 (N)");
ok(sys._slotFromAngle(ang * 2) === 2, "E");
ok(sys._slotFromAngle(ang * 4) === 4, "S");
ok(sys._slotFromAngle(ang * 6) === 6, "W");

// Negative angles
ok(sys._slotFromAngle(-ang * 2) === 6, "negative → W");

// 16. Custom cooldown per-call
const sys5 = W.createWheel({ config: { defaultCooldownMs: 99999 } });
sys5.registerPalette("x", fp);
sys5.openWheel("p", "x", { now: 0 });
sys5.selectByIndex("p", 0, { now: 0, cooldownMs: 0 });
sys5.openWheel("p", "x", { now: 100 });
const im = sys5.selectByIndex("p", 0, { now: 100, cooldownMs: 0 });
ok(im.ok === true, "custom cooldown 0 → immediate ok");

// 17. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "select"), "select events");

// 18. getConfig
ok(sys.getConfig().slots === 8, "config slots");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
