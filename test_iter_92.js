// test_iter_92.js — stats: kinds, record, lifetime/day rollups, top.
const S = require("./stats.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Default kinds
const sys = S.createSystem();
ok(sys.listKinds().includes("kill"), "kill kind");
ok(sys.listKinds().includes("distance_m"), "distance kind");
ok(sys.listKinds().includes("playtime_ms"), "playtime kind");

// 2. record basics
const ts = Date.UTC(2026, 4, 15, 12, 0, 0);
const r1 = sys.record("alice", "kill", null, { ts });
ok(r1.ok && r1.lifetime === 1, "kill = 1");
ok(r1.today === 1, "today kill = 1");

// Increment again
sys.record("alice", "kill", null, { ts });
sys.record("alice", "kill", null, { ts });
ok(sys.lifetime("alice", "kill") === 3, "3 kills lifetime");

// Custom delta
sys.record("alice", "kill", { delta: 5 }, { ts });
ok(sys.lifetime("alice", "kill") === 8, "custom delta +5");

// 3. Sum-value kinds
sys.record("alice", "distance_m", { value: 100 }, { ts });
sys.record("alice", "distance_m", { value: 250.5 }, { ts });
ok(sys.lifetime("alice", "distance_m") === 350.5, "distance summed");

// 4. Max kinds (best_combo)
sys.record("alice", "best_combo", { value: 5 }, { ts });
sys.record("alice", "best_combo", { value: 3 }, { ts });
sys.record("alice", "best_combo", { value: 8 }, { ts });
ok(sys.lifetime("alice", "best_combo") === 8, "best_combo max = 8");

// 5. Bad inputs
ok(sys.record(null, "kill").ok === false, "missing player");
ok(sys.record("x", "ghost").ok === false, "unknown kind");

// 6. Unknown player returns null
ok(sys.lifetime("ghost", "kill") === null, "ghost lifetime null");
ok(sys.dayStats("ghost", 20260515) === null, "ghost day null");

// 7. dayStats
const dayKey = S.utcDayKey(ts);
const ds = sys.dayStats("alice", dayKey);
ok(ds && ds.kill === 8, "day kill = 8");
ok(ds.distance_m === 350.5, "day distance = 350.5");

// 8. Different day = separate rollup
const tsTomorrow = ts + 24 * 3600 * 1000;
sys.record("alice", "kill", null, { ts: tsTomorrow });
const tomorrowDay = S.utcDayKey(tsTomorrow);
ok(sys.dayStats("alice", tomorrowDay).kill === 1, "tomorrow day kill = 1");
ok(sys.lifetime("alice", "kill") === 9, "lifetime = 9 (8 + 1)");
ok(sys.dayStats("alice", dayKey).kill === 8, "yesterday still 8");

// 9. registerKind
ok(sys.registerKind("custom_stat", { reducer: (cur, p) => cur + 1, default: 0 }).ok === true,
   "register custom_stat");
ok(sys.registerKind("kill", { reducer: () => {}, default: 0 }).ok === false, "duplicate rejected");
ok(sys.registerKind("", { reducer: () => {} }).ok === false, "bad name");
ok(sys.registerKind("x", null).ok === false, "bad def");
ok(sys.registerKind("y", { reducer: "notfn" }).ok === false, "non-fn reducer");

sys.record("alice", "custom_stat", null, { ts });
ok(sys.lifetime("alice", "custom_stat") === 1, "custom stat works");

// 10. reset
sys.reset("alice", "kill");
ok(sys.lifetime("alice", "kill") === 0, "kill reset");
ok(sys.lifetime("alice", "distance_m") === 350.5, "distance preserved");

// Full reset
sys.reset("alice");
ok(sys.lifetime("alice", "distance_m") === 0, "all reset");

// 11. topByKind
const sys2 = S.createSystem();
sys2.record("alice", "kill", { delta: 50 }, { ts });
sys2.record("bob", "kill", { delta: 100 }, { ts });
sys2.record("carol", "kill", { delta: 25 }, { ts });
const top = sys2.topByKind("kill");
ok(top.length === 3, "3 players");
ok(top[0].playerId === "bob" && top[0].value === 100, "bob top");
ok(top[2].playerId === "carol", "carol last");

// Today window — record with ts=now so it lands in today's bucket
sys2.record("alice", "kill", { delta: 5 });   // no ts → now
const todayTop = sys2.topByKind("kill", { window: "today" });
const aliceToday = todayTop.find(e => e.playerId === "alice");
ok(aliceToday && aliceToday.value >= 5, `today: alice >=5 (got ${aliceToday && aliceToday.value})`);
ok(todayTop.length <= 3, "today top capped");

// limit
const limited = sys2.topByKind("kill", { limit: 2 });
ok(limited.length === 2, "limit 2");

// 12. recentDays
const sys3 = S.createSystem();
for (let d = 0; d < 10; d++) {
  const t = ts + d * 24 * 3600 * 1000;
  sys3.record("alice", "kill", { delta: d + 1 }, { ts: t });
}
// recentDays defaults to last 7 — but the records are spread across 10 days from "ts"
// which is May 2026; "today" (from Date.now()) might be far from those.
// So just check the function works:
const rd = sys3.recentDays("alice", 365);
ok(rd.length === 10, `10 days recorded (got ${rd.length})`);

// 13. listPlayers + listKinds
ok(sys2.listPlayers().length === 3, "3 players");
ok(sys.listKinds().includes("custom_stat"), "custom_stat in list");

// 14. toJSON / fromJSON
const sys4 = S.createSystem();
sys4.record("a", "kill", { delta: 7 }, { ts });
sys4.record("b", "distance_m", { value: 500 }, { ts });
const j = sys4.toJSON();
ok(j.players.a.lifetime.kill === 7, "json has alice kill");

const sys5 = S.createSystem();
ok(sys5.fromJSON(j).ok === true, "fromJSON ok");
ok(sys5.lifetime("a", "kill") === 7, "loaded alice");
ok(sys5.lifetime("b", "distance_m") === 500, "loaded bob");
ok(sys5.fromJSON(null).ok === false, "null fromJSON");

// 15. rolloverAfterDays
const sys6 = S.createSystem({ config: { rolloverAfterDays: 7 } });
// Record on a date 30 days ago
const oldTs = Date.now() - 30 * 24 * 3600 * 1000;
sys6.record("alice", "kill", { delta: 100 }, { ts: oldTs });
// Lifetime should still have it; day bucket should be pruned on next record
sys6.record("alice", "kill", { delta: 1 });   // now
const oldDayKey = S.utcDayKey(oldTs);
ok(sys6.dayStats("alice", oldDayKey) === null, "old day pruned");
ok(sys6.lifetime("alice", "kill") === 101, "lifetime preserved (100 + 1)");

// 16. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");

// 17. lifetime() with no kind returns whole map
const all = sys2.lifetime("bob");
ok(all && all.kill === 100, "lifetime() returns map");

// 18. record returns today + lifetime
const r = sys4.record("a", "kill", { delta: 3 }, { ts });
ok(r.lifetime === 10 && r.today === 10, `lifetime + today (got ${r.lifetime},${r.today})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
