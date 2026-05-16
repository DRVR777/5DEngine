// test_iter_87.js — daily challenges: deterministic seed + grant ledger.
const DC = require("./daily_challenges.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. utcDayKey
const ts1 = Date.UTC(2026, 0, 15, 12, 0, 0);
ok(DC.utcDayKey(ts1) === 20260115, `dayKey = 20260115 (got ${DC.utcDayKey(ts1)})`);

// 2. createSystem + registerChallenge
const sys = DC.createSystem({ config: { challengesPerDay: 3 } });
ok(sys.registerChallenge({ id: "c1", kind: "reach_score", threshold: 100, rewardAmount: 50 }).ok === true,
   "register c1");
ok(sys.registerChallenge({ id: "c1", kind: "x", rewardAmount: 0 }).ok === false, "duplicate rejected");
ok(sys.registerChallenge({}).ok === false, "missing id");
ok(sys.registerChallenge({ id: "x", rewardAmount: 0 }).ok === false, "missing kind");
ok(sys.registerChallenge({ id: "y", kind: "x", rewardAmount: -1 }).ok === false, "bad reward");

// Add more challenges
sys.registerChallenge({ id: "c2", kind: "mission_run", missionId: "m1", rewardAmount: 100 });
sys.registerChallenge({ id: "c3", kind: "collect_n", itemType: "coin", count: 10, rewardAmount: 25 });
sys.registerChallenge({ id: "c4", kind: "win_minigame", minigameId: "race", rewardAmount: 75 });
sys.registerChallenge({ id: "c5", kind: "reach_score", threshold: 500, rewardAmount: 150 });

ok(sys.listPool().length === 5, "5 in pool");

// 3. pickForDay deterministic
const day1 = sys.pickForDay(ts1);
const day1again = sys.pickForDay(ts1);
ok(day1.length === 3, "3 picked");
ok(JSON.stringify(day1.map(c => c.id)) === JSON.stringify(day1again.map(c => c.id)),
   "same day → same picks");

// Different day → different picks (usually)
const ts2 = Date.UTC(2026, 0, 16, 12, 0, 0);
const day2 = sys.pickForDay(ts2);
const diff = JSON.stringify(day1.map(c => c.id)) !== JSON.stringify(day2.map(c => c.id));
ok(diff || day2.length === 3, "different day OR still 3 picked");

// 4. Empty pool
const empty = DC.createSystem();
ok(empty.pickForDay(ts1).length === 0, "empty pool → 0 picks");

// 5. Submit valid reach_score challenge
const todayChallenges = sys.pickForDay(ts1);
const reachChallenge = todayChallenges.find(c => c.kind === "reach_score");
if (reachChallenge) {
  const r = sys.submitCompletion({
    playerId: "alice", challengeId: reachChallenge.id,
    proof: { score: reachChallenge.threshold + 10 },
    ts: ts1,
  });
  ok(r.ok === true, `submit reach_score: ${r.ok ? "ok" : r.reason}`);
  ok(r.grant.amount === reachChallenge.rewardAmount, "grant amount");
  ok(r.grant.playerId === "alice", "grant player");
}

// 6. Duplicate submission rejected
if (reachChallenge) {
  const r2 = sys.submitCompletion({
    playerId: "alice", challengeId: reachChallenge.id,
    proof: { score: reachChallenge.threshold + 10 }, ts: ts1,
  });
  ok(r2.ok === false && r2.reason === "already_claimed", "duplicate claim rejected");
}

// 7. Score below threshold rejected
if (reachChallenge) {
  const r3 = sys.submitCompletion({
    playerId: "bob", challengeId: reachChallenge.id,
    proof: { score: reachChallenge.threshold - 1 }, ts: ts1,
  });
  ok(r3.ok === false && r3.reason === "score_too_low", "low score rejected");
}

// 8. Challenge not in today's set
const notToday = sys.listPool().find(c => !todayChallenges.find(t => t.id === c.id));
if (notToday) {
  const r4 = sys.submitCompletion({
    playerId: "carol", challengeId: notToday.id,
    proof: { score: 9999 }, ts: ts1,
  });
  ok(r4.ok === false && r4.reason === "not_today", "non-today rejected");
}

// 9. Bad submission
ok(sys.submitCompletion({}).ok === false, "empty rejected");
ok(sys.submitCompletion({ playerId: "x" }).ok === false, "no challenge rejected");

// 10. mission_run
const missionChallenge = todayChallenges.find(c => c.kind === "mission_run");
if (missionChallenge) {
  const r5 = sys.submitCompletion({
    playerId: "dave", challengeId: missionChallenge.id,
    proof: { missionId: missionChallenge.missionId, completed: true }, ts: ts1,
  });
  ok(r5.ok === true, "mission_run ok");

  const r6 = sys.submitCompletion({
    playerId: "eve", challengeId: missionChallenge.id,
    proof: { missionId: "wrong_mission", completed: true }, ts: ts1,
  });
  ok(r6.ok === false && r6.reason === "wrong_mission", "wrong mission rejected");

  const r7 = sys.submitCompletion({
    playerId: "frank", challengeId: missionChallenge.id,
    proof: { missionId: missionChallenge.missionId, completed: false }, ts: ts1,
  });
  ok(r7.ok === false && r7.reason === "not_completed", "incomplete rejected");
}

// 11. collect_n
const collectChallenge = todayChallenges.find(c => c.kind === "collect_n");
if (collectChallenge) {
  const r8 = sys.submitCompletion({
    playerId: "g", challengeId: collectChallenge.id,
    proof: { count: collectChallenge.count, itemType: collectChallenge.itemType }, ts: ts1,
  });
  ok(r8.ok === true, "collect_n ok");

  const r9 = sys.submitCompletion({
    playerId: "h", challengeId: collectChallenge.id,
    proof: { count: 1, itemType: collectChallenge.itemType }, ts: ts1,
  });
  ok(r9.ok === false, "not_enough rejected");
}

// 12. Economy hook deposit
let depositCalls = [];
const econ = { deposit: (p, c, a) => { depositCalls.push([p, c, a]); } };
const sys2 = DC.createSystem();
sys2.registerChallenge({ id: "c1", kind: "reach_score", threshold: 10, rewardCcy: "gem", rewardAmount: 5 });
const sys2Today = sys2.pickForDay(ts1);
if (sys2Today.length > 0) {
  sys2.submitCompletion({
    playerId: "alice", challengeId: sys2Today[0].id,
    proof: { score: 100 }, ts: ts1,
  }, { economy: econ });
  ok(depositCalls.length === 1, "economy deposit called");
  ok(depositCalls[0][1] === "gem" && depositCalls[0][2] === 5, "correct ccy + amount");
}

// 13. Custom challenge
const sys3 = DC.createSystem();
let customCheckCalled = false;
sys3.registerChallenge({
  id: "custom", kind: "custom",
  verify: () => { customCheckCalled = true; return true; },
  rewardAmount: 10,
});
const sys3Today = sys3.pickForDay(ts1);
if (sys3Today.length > 0) {
  const r = sys3.submitCompletion({ playerId: "a", challengeId: sys3Today[0].id, proof: {}, ts: ts1 });
  ok(r.ok === true, "custom verify ok");
  ok(customCheckCalled, "verify fn called");
}

// 14. Custom verify throws → handled
const sys4 = DC.createSystem();
sys4.registerChallenge({
  id: "bad", kind: "custom",
  verify: () => { throw new Error("boom"); },
  rewardAmount: 0,
});
const sys4Today = sys4.pickForDay(ts1);
const rThrow = sys4.submitCompletion({ playerId: "x", challengeId: sys4Today[0].id, proof: {}, ts: ts1 });
ok(rThrow.ok === false && rThrow.reason === "verify_threw", "verify throw caught");

// 15. Custom returns false
const sys5 = DC.createSystem();
sys5.registerChallenge({ id: "f", kind: "custom", verify: () => false, rewardAmount: 0 });
const sys5Today = sys5.pickForDay(ts1);
const rFalse = sys5.submitCompletion({ playerId: "y", challengeId: sys5Today[0].id, proof: {}, ts: ts1 });
ok(rFalse.ok === false && rFalse.reason === "verify_failed", "verify false rejected");

// 16. ledgerOf
const aliceLedger = sys.ledgerOf("alice");
ok(aliceLedger.length >= 1, "alice has grants");
ok(aliceLedger.every(g => g.playerId === "alice"), "all alice");

// 17. dayLedger
const dayL = sys.dayLedger(ts1);
ok(dayL.length >= 1, "day ledger has grants");

// 18. hasCompleted
if (reachChallenge) {
  ok(sys.hasCompleted("alice", reachChallenge.id, ts1) === true, "alice completed");
  ok(sys.hasCompleted("ghost", reachChallenge.id, ts1) === false, "ghost did not");
  // Different day
  ok(sys.hasCompleted("alice", reachChallenge.id, ts2) === false, "different day - no");
}

// 19. unregister
ok(sys.unregisterChallenge("c5").ok === true, "unregister ok");
ok(sys.unregisterChallenge("c5").ok === false, "double unregister fails");
ok(sys.listPool().length === 4, "4 left");

// 20. Events + grants
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
const gr = sys.recentGrants();
ok(gr.length > 0, "grants logged");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
