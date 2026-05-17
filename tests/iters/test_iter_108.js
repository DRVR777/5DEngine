// test_iter_108.js — difficulty scaler: performance, multipliers, level.
const D = require("./difficulty_scaler.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. New player: defaults
const sys = D.createScaler();
ok(sys.getLevel("alice") === 1, "default level 1");
ok(sys.performance("alice") === 0, "no data → 0 score");

const mDef = sys.multipliers("alice");
ok(Math.abs(mDef.hpMul - 1.25) < 0.001, `default hp mul (got ${mDef.hpMul})`);
ok(mDef.level === 1, "level 1");

// 2. setLevel
ok(sys.setLevel("alice", 10).ok === true, "set level 10");
ok(sys.getLevel("alice") === 10, "got level 10");
ok(sys.setLevel("alice", 0).ok === false, "level 0 rejected");
ok(sys.setLevel("alice", -5).ok === false, "negative rejected");

// 3. recordEncounter
const r1 = sys.recordEncounter({
  playerId: "bob",
  deaths: 0, kills: 10, accuracy: 0.8,
  durationS: 60, won: true,
});
ok(r1.ok === true, "encounter recorded");
ok(sys.recordEncounter({}).ok === false, "no player rejected");

// 4. Stomping player: positive score
for (let i = 0; i < 10; i++) {
  sys.recordEncounter({
    playerId: "stomper",
    deaths: 0, kills: 20, accuracy: 0.9,
    durationS: 30, won: true,
  });
}
const stomp = sys.performance("stomper");
ok(stomp > 0.3, `stomper score positive (got ${stomp.toFixed(2)})`);

const stompM = sys.multipliers("stomper");
ok(stompM.hpMul > 1.2, `stomper hp mul > 1.2 (got ${stompM.hpMul.toFixed(2)})`);
ok(stompM.dmgMul > 1.2, "stomper dmg mul > 1.2");
ok(stompM.countMul > 1.2, "stomper count mul > 1.2");

// 5. Struggling player: negative score
for (let i = 0; i < 10; i++) {
  sys.recordEncounter({
    playerId: "struggler",
    deaths: 5, kills: 2, accuracy: 0.2,
    durationS: 200, won: false,
  });
}
const strug = sys.performance("struggler");
ok(strug < -0.3, `struggler score negative (got ${strug.toFixed(2)})`);

const strugM = sys.multipliers("struggler");
ok(strugM.hpMul < 0.9, `struggler hp mul < 0.9 (got ${strugM.hpMul.toFixed(2)})`);
ok(strugM.dmgMul < 0.9, "struggler dmg < 0.9");

// 6. Multipliers within configured ranges
ok(stompM.hpMul <= 2.0 * 3.0, "hp mul in range (with level cap)");

// Stomp at level 1
const sys2 = D.createScaler();
for (let i = 0; i < 10; i++) {
  sys2.recordEncounter({ playerId: "s", deaths: 0, kills: 20, accuracy: 0.95, durationS: 20, won: true });
}
const sM = sys2.multipliers("s");
ok(sM.hpMul <= 2.0, `lvl 1 stomp hp mul ≤ 2.0 (got ${sM.hpMul})`);
ok(sM.dmgMul <= 2.0, "lvl 1 stomp dmg mul ≤ 2.0");

// 7. Level scaling
sys2.setLevel("s", 10);
const lvl10M = sys2.multipliers("s");
// level 10 → +5% * 9 = 1.45 baseline
ok(lvl10M.hpMul > sM.hpMul, `level 10 → higher mul (${lvl10M.hpMul.toFixed(2)} vs ${sM.hpMul.toFixed(2)})`);

// 8. Window size enforced
const sys3 = D.createScaler({ config: { windowSize: 5 } });
for (let i = 0; i < 20; i++) {
  sys3.recordEncounter({ playerId: "x", deaths: i, kills: 0 });
}
ok(sys3.getEncounters("x").length === 5, "window enforced");

// 9. Reset
sys3.reset("x");
ok(sys3.getEncounters("x").length === 0, "reset cleared");
ok(sys3.reset("ghost").ok === false, "ghost reset");

// 10. Manual override
const sys4 = D.createScaler();
sys4.setManualOverride({ hpMul: 5, dmgMul: 5, countMul: 5 });
const mO = sys4.multipliers("anyone");
ok(mO.hpMul === 5 && mO.dmgMul === 5 && mO.countMul === 5, "manual override applied");

sys4.clearManualOverride();
const mC = sys4.multipliers("anyone");
ok(mC.hpMul !== 5, "manual cleared");

// 11. Custom level curve
const sys5 = D.createScaler({ config: { levelCurve: (lvl) => lvl * 2 } });
sys5.setLevel("y", 5);
const mLevel = sys5.multipliers("y");
// baseline = 5 * 2 = 10; score=0, midpoint = 1.25
ok(Math.abs(mLevel.hpMul - 12.5) < 0.001, `custom curve mul = 12.5 (got ${mLevel.hpMul})`);

// 12. Performance with mix of wins + losses
const sys6 = D.createScaler();
for (let i = 0; i < 5; i++) sys6.recordEncounter({ playerId: "mid", deaths: 1, kills: 5, accuracy: 0.5, durationS: 60, won: true });
for (let i = 0; i < 5; i++) sys6.recordEncounter({ playerId: "mid", deaths: 1, kills: 5, accuracy: 0.5, durationS: 60, won: false });
const midScore = sys6.performance("mid");
ok(Math.abs(midScore) < 0.5, `mid score near 0 (got ${midScore.toFixed(2)})`);

// 13. Score in [-1, +1] range
const allStomp = D.createScaler();
for (let i = 0; i < 30; i++) {
  allStomp.recordEncounter({ playerId: "x", deaths: 0, kills: 100, accuracy: 1.0, durationS: 5, won: true });
}
ok(allStomp.performance("x") <= 1.0, "score capped at 1");
ok(allStomp.performance("x") >= -1.0, "score >= -1");

const allBad = D.createScaler();
for (let i = 0; i < 30; i++) {
  allBad.recordEncounter({ playerId: "x", deaths: 10, kills: 0, accuracy: 0.0, durationS: 600, won: false });
}
ok(allBad.performance("x") >= -1.0, "bad score capped at -1");

// 14. Accuracy bounds
sys6.recordEncounter({ playerId: "z", accuracy: 1.5 });
sys6.recordEncounter({ playerId: "z", accuracy: -0.5 });
const enc = sys6.getEncounters("z");
ok(enc[0].accuracy === 1.0, "accuracy clamped to 1");
ok(enc[1].accuracy === 0.0, "accuracy clamped to 0");

// 15. listPlayers
ok(sys.listPlayers().length > 0, "players listed");

// 16. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "encounter"), "encounter events");

// 17. getConfig
const cfg = sys.getConfig();
ok(cfg.windowSize > 0, "config exposed");

// 18. Multipliers include score + level
const mAll = sys.multipliers("stomper");
ok(typeof mAll.score === "number", "score in result");
ok(typeof mAll.level === "number", "level in result");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
