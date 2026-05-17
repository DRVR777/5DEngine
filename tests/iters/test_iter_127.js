// test_iter_127.js — weather-gated missions: register, match, available, tick.
const W = require("./weather_missions.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. registerMission validation
const sys = W.createSystem();
ok(sys.registerMission({
  id: "thunderhunt",
  name: "Thunder Hunt",
  requirement: { kind: "storm", minIntensity: 0.5 },
  rewardCcy: "coin", rewardAmount: 500,
}).ok, "register thunderhunt");

ok(sys.registerMission({}).ok === false, "no id");
ok(sys.registerMission({ id: "x" }).ok === false, "no requirement");
ok(sys.registerMission({ id: "x", requirement: {} }).ok === false, "no kind/kindAny");
ok(sys.registerMission({ id: "thunderhunt", requirement: { kind: "x" } }).ok === false, "duplicate");

sys.registerMission({
  id: "snowtrek", requirement: { kind: "snow" },
});
sys.registerMission({
  id: "any_wet", requirement: { kindAny: ["rain","heavy_rain","storm"] },
});
sys.registerMission({
  id: "calm_only", requirement: { kindAny: ["clear","cloudy"], maxIntensity: 0.4 },
});
sys.registerMission({
  id: "night_storm", requirement: { kind: "storm", timeOfDay: "night" },
});

ok(sys.listMissions().length === 5, "5 missions");
ok(sys.getMission("thunderhunt") !== null, "get");
ok(sys.getMission("ghost") === null, "ghost null");

// 2. isAvailable
ok(sys.isAvailable("snowtrek", { kind: "snow" }) === true, "snow match");
ok(sys.isAvailable("snowtrek", { kind: "rain" }) === false, "rain no match");
ok(sys.isAvailable("snowtrek", null) === false, "no weather");

// minIntensity
ok(sys.isAvailable("thunderhunt", { kind: "storm", intensity: 0.3 }) === false, "low intensity");
ok(sys.isAvailable("thunderhunt", { kind: "storm", intensity: 0.8 }) === true, "high intensity");

// maxIntensity
ok(sys.isAvailable("calm_only", { kind: "clear", intensity: 0.2 }) === true, "calm clear");
ok(sys.isAvailable("calm_only", { kind: "clear", intensity: 0.9 }) === false, "too intense");

// kindAny
ok(sys.isAvailable("any_wet", { kind: "rain" }) === true, "rain matches any_wet");
ok(sys.isAvailable("any_wet", { kind: "heavy_rain" }) === true, "heavy_rain matches");
ok(sys.isAvailable("any_wet", { kind: "snow" }) === false, "snow doesn't match wet");

// timeOfDay
ok(sys.isAvailable("night_storm", { kind: "storm", intensity: 1, timeOfDay: "day" }) === false, "wrong tod");
ok(sys.isAvailable("night_storm", { kind: "storm", intensity: 1, timeOfDay: "night" }) === true, "night ok");

// 3. availableMissions
const av1 = sys.availableMissions({ kind: "storm", intensity: 0.9 });
ok(av1.length === 2, `storm 0.9 → 2 (got ${av1.length})`);   // thunderhunt + any_wet
ok(av1.find(m => m.id === "thunderhunt"), "thunderhunt available");
ok(av1.find(m => m.id === "any_wet"), "any_wet available");

const av2 = sys.availableMissions({ kind: "clear", intensity: 0.2 });
ok(av2.length === 1 && av2[0].id === "calm_only", "calm only");

const av3 = sys.availableMissions({ kind: "fog" });
ok(av3.length === 0, "fog → nothing");

// 4. season requirement
sys.registerMission({
  id: "winterheat",
  requirement: { kind: "snow", season: "winter" },
});
ok(sys.isAvailable("winterheat", { kind: "snow", season: "winter" }) === true, "winter+snow");
ok(sys.isAvailable("winterheat", { kind: "snow", season: "spring" }) === false, "wrong season");
ok(sys.isAvailable("winterheat", { kind: "snow" }) === false, "no season");

// 5. tick → newly-available callbacks
const sys2 = W.createSystem();
sys2.registerMission({ id: "m_storm", requirement: { kind: "storm" } });
sys2.registerMission({ id: "m_calm", requirement: { kindAny: ["clear"] } });

let cbCalls = [];
const cb = (id, w) => cbCalls.push({ id, kind: w.kind });

// First tick on clear → m_calm newly available
const t1 = sys2.tick({ kind: "clear" }, cb);
ok(t1.length === 1 && t1[0] === "m_calm", `m_calm newly avail (got ${t1.join(",")})`);
ok(cbCalls.length === 1 && cbCalls[0].id === "m_calm", "callback fired");

// Same weather → no new
const t2 = sys2.tick({ kind: "clear" }, cb);
ok(t2.length === 0, "no new on same");

// Switch to storm → m_storm newly available
const t3 = sys2.tick({ kind: "storm" }, cb);
ok(t3.length === 1 && t3[0] === "m_storm", "m_storm new");
// m_calm goes away — not a "newly available" event
ok(cbCalls.length === 2, "2 callbacks total");

// Back to clear → m_calm newly available again
const t4 = sys2.tick({ kind: "clear" }, cb);
ok(t4.length === 1, "m_calm new again");

// Null callback
const t5 = sys2.tick({ kind: "storm" });
ok(Array.isArray(t5), "tick works without callback");

// Tick with no weather
const t6 = sys2.tick(null);
ok(t6.length === 0, "null weather → no available");

// 6. unregisterMission
ok(sys.unregisterMission("snowtrek") === true, "unreg");
ok(sys.getMission("snowtrek") === null, "removed");
ok(sys.unregisterMission("ghost") === false, "ghost unreg");

// 7. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "register"), "register events");

// 8. Reward fields preserved
const m = sys.getMission("thunderhunt");
ok(m.rewardCcy === "coin" && m.rewardAmount === 500, "reward preserved");

// 9. Callback throws → caught
const sys3 = W.createSystem();
sys3.registerMission({ id: "x", requirement: { kind: "rain" } });
let bad = false;
try {
  sys3.tick({ kind: "rain" }, () => { throw new Error("boom"); });
} catch (e) {
  bad = true;
}
ok(!bad, "thrown callback caught");

// 10. Both kind + kindAny in requirement → both checked
sys3.registerMission({
  id: "strict",
  requirement: { kind: "storm", kindAny: ["storm", "rain"] },
});
ok(sys3.isAvailable("strict", { kind: "storm" }) === true, "matches both");
ok(sys3.isAvailable("strict", { kind: "rain" }) === false, "kind=storm wins (rain rejected)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
