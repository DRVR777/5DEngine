// test_iter_128.js — diving: dive, breath, current, wreck loot.
const D = require("./diving.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. startDive
const sys = D.createSystem();
const sd = sys.startDive({ playerId: "alice", position: { u: 0, v: 0 } });
ok(sd.ok && sd.diveId === "dive_1", "dive started");
ok(sys.getDive(sd.diveId).breath === 60, "default 60s breath");
ok(sys.getDive(sd.diveId).surface === true, "at surface");

// Bad start
ok(sys.startDive({}).ok === false, "missing player");

// Already diving
ok(sys.startDive({ playerId: "alice" }).ok === false, "already diving");

// 2. descend + ascend
const d1 = sys.descend(sd.diveId, 10);
ok(d1.ok && d1.depth === 10, "down 10m");
ok(sys.getDive(sd.diveId).surface === false, "not at surface");

ok(sys.descend(sd.diveId, 0).ok === false, "no zero descend");
ok(sys.descend("ghost", 5).ok === false, "no dive");

sys.descend(sd.diveId, 20);   // total 30m
ok(sys.getDive(sd.diveId).depth === 30, "30m deep");

// Ascend partway
const up1 = sys.ascend(sd.diveId, 15);
ok(up1.ok && up1.depth === 15, "ascended to 15m");
ok(up1.surfaced === false, "not surface yet");

// Full ascend
const up2 = sys.ascend(sd.diveId, 100);
ok(up2.surfaced === true, "surfaced");
ok(sys.getDive(sd.diveId).breath === 60, "breath refilled");

// 3. tick — breath consumed underwater
sys.descend(sd.diveId, 10);
const before = sys.getDive(sd.diveId).breath;
sys.tick(sd.diveId, 5);   // 5s × 1 × (1 + 10 × 0.03) = 5 × 1.3 = 6.5
const after = sys.getDive(sd.diveId).breath;
ok(after < before, `breath dropped (${before} → ${after})`);
ok(Math.abs(before - after - 6.5) < 0.01, `dropped 6.5 (got ${before - after})`);

// 4. tick at surface — no breath drain
sys.ascend(sd.diveId, 100);
const surfBreath = sys.getDive(sd.diveId).breath;
sys.tick(sd.diveId, 30);
ok(sys.getDive(sd.diveId).breath === surfBreath, "no drain at surface");

// 5. Drowning when breath = 0
const sys2 = D.createSystem();
const dd = sys2.startDive({ playerId: "p", maxBreath: 5 });
sys2.descend(dd.diveId, 5);
let drownDmg = 0;
const apply = (pid, dmg, kind) => { if (kind === "drown") drownDmg += dmg; };
for (let i = 0; i < 10; i++) sys2.tick(dd.diveId, 1, { applyDamage: apply });
ok(sys2.getDive(dd.diveId).breath === 0, "breath exhausted");
ok(sys2.getDive(dd.diveId).drowning === true, "drowning");
ok(drownDmg > 0, `drown damage applied (got ${drownDmg})`);

// 6. Current pushes diver
const sys3 = D.createSystem();
const cd = sys3.startDive({ playerId: "p" });
sys3.descend(cd.diveId, 10);
sys3.tick(cd.diveId, 2, { current: { u: 1.5, v: 0 } });
const pos = sys3.getDive(cd.diveId).position;
ok(pos.u === 3, `current pushed to u=3 (got ${pos.u})`);

// No current at surface
sys3.ascend(cd.diveId, 100);
sys3.tick(cd.diveId, 5, { current: { u: 99, v: 0 } });
const surfPos = sys3.getDive(cd.diveId).position;
ok(surfPos.u === 3, "no current push at surface");

// 7. move
sys3.descend(cd.diveId, 5);
sys3.move(cd.diveId, { u: 10, v: 5 });
const movedPos = sys3.getDive(cd.diveId).position;
ok(movedPos.u === 13 && movedPos.v === 5, "manual move");

// 8. registerWreck
sys.registerWreck({
  id: "titanic",
  position: { u: 100, v: 100, depth: 20 },
  loot: [
    { itemId: "gold_coin", qty: 50 },
    { itemId: "pearl", qty: 5 },
  ],
});
ok(sys.getWreck("titanic") !== null, "wreck registered");
ok(sys.registerWreck({}).ok === false, "missing pos");
ok(sys.registerWreck({ id: "titanic", position: {} }).ok === false, "duplicate");

ok(sys.listWrecks().length === 1, "1 wreck");

// 9. collect — must be in range + at depth
const sys4 = D.createSystem({ config: { lootReachRadius: 2 } });
sys4.registerWreck({
  id: "w", position: { u: 0, v: 0, depth: 10 },
  loot: [{ itemId: "gem", qty: 3 }],
});
const div = sys4.startDive({ playerId: "p", position: { u: 0, v: 0 } });
sys4.descend(div.diveId, 5);    // wrong depth

const c1 = sys4.collect(div.diveId, "w");
ok(c1.ok === false && c1.reason === "wrong_depth", "wrong depth");

// Descend to correct depth
sys4.descend(div.diveId, 5);   // now at 10m
const c2 = sys4.collect(div.diveId, "w");
ok(c2.ok === true && c2.collected[0].itemId === "gem", "collected gem");

// Re-collect empty
const c3 = sys4.collect(div.diveId, "w");
ok(c3.ok === false && c3.reason === "empty", "empty wreck");

// Bad collect
ok(sys4.collect("ghost", "w").ok === false, "no dive");
ok(sys4.collect(div.diveId, "ghost").ok === false, "no wreck");

// Too far
const farWreck = sys4.registerWreck({ position: { u: 100, v: 100, depth: 10 } });
ok(sys4.collect(div.diveId, farWreck.wreckId).ok === false, "too far");

// 10. endDive returns bag if surfaced
const sys5 = D.createSystem();
sys5.registerWreck({ id: "w", position: { u: 0, v: 0, depth: 5 }, loot: [{ itemId: "gold", qty: 10 }] });
const dv = sys5.startDive({ playerId: "p" });
sys5.descend(dv.diveId, 5);
sys5.collect(dv.diveId, "w");

// Try to end while underwater → no loot
const endUnderwater = sys5.endDive(dv.diveId);
ok(endUnderwater.surfacedLoot.length === 0, "drowned dive → no loot");

// Surfaced
const dv2 = sys5.startDive({ playerId: "p" });
sys5.descend(dv2.diveId, 5);
sys5.collect(dv2.diveId, "w");
ok(sys5.getDive(dv2.diveId).bag.length === 0, "wreck empty (already collected)");

// 11. End dive with surface
const sys6 = D.createSystem();
sys6.registerWreck({ id: "w", position: { u: 0, v: 0, depth: 5 }, loot: [{ itemId: "x", qty: 1 }] });
const fd = sys6.startDive({ playerId: "q" });
sys6.descend(fd.diveId, 5);
sys6.collect(fd.diveId, "w");
sys6.ascend(fd.diveId, 100);
const end = sys6.endDive(fd.diveId);
ok(end.surfacedLoot.length === 1, "got loot back");

// 12. removeWreck
ok(sys.removeWreck("titanic") === true, "remove wreck");
ok(sys.getWreck("titanic") === null, "removed");

// 13. listDives
const sys7 = D.createSystem();
sys7.startDive({ playerId: "a" });
sys7.startDive({ playerId: "b" });
ok(sys7.listDives().length === 2, "2 dives");

// 14. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "dive_start"), "dive_start events");

// 15. getConfig
ok(sys.getConfig().defaultMaxBreath > 0, "config");

// 16. Custom maxBreath
const sys8 = D.createSystem();
const long = sys8.startDive({ playerId: "p", maxBreath: 300 });
ok(sys8.getDive(long.diveId).maxBreath === 300, "custom max breath");

// 17. Drowning resets on surface
const sys9 = D.createSystem();
const dr = sys9.startDive({ playerId: "p", maxBreath: 1 });
sys9.descend(dr.diveId, 5);
sys9.tick(dr.diveId, 10);
ok(sys9.getDive(dr.diveId).drowning === true, "drowning");
sys9.ascend(dr.diveId, 100);
ok(sys9.getDive(dr.diveId).drowning === false, "recovered on surface");
ok(sys9.getDive(dr.diveId).breath === 1, "breath refilled to max");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
