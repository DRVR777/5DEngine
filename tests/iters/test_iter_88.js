// test_iter_88.js — minigame harness: start, score, win/lose/timeout, retry.
const MG = require("./minigame.js");
const LB = require("./leaderboards.js");
const DC = require("./daily_challenges.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Basic start
const h = MG.createHarness();
const s1 = h.start({ playerId: "alice", gameId: "race" });
ok(s1.ok === true && s1.id === "mg_1", "first start");
ok(s1.session.status === "running", "running");
ok(s1.session.mode === "single", "default mode = single");

ok(h.start({}).ok === false, "empty start rejected");
ok(h.start({ playerId: "x" }).ok === false, "missing game rejected");
ok(h.start({ playerId: "x", gameId: "y", mode: "bad" }).ok === false, "bad mode");

// 2. listActive + listForPlayer
const s2 = h.start({ playerId: "bob", gameId: "race" });
ok(h.listActive().length === 2, "2 active");
ok(h.listForPlayer("alice").length === 1, "1 alice");

// 3. addScore
const sc = h.addScore(s1.id, 10);
ok(sc.ok && sc.currentScore === 10, "score 10");
h.addScore(s1.id, 5);
ok(h.get(s1.id).currentScore === 15, "score 15");

ok(h.addScore("ghost", 5).ok === false, "ghost score fails");
ok(h.addScore(s1.id, "bad").ok === false, "bad delta rejected");

// setScore
h.setScore(s1.id, 100);
ok(h.get(s1.id).currentScore === 100, "setScore");

// 4. tick + timeout
const h2 = MG.createHarness();
const s3 = h2.start({ playerId: "x", gameId: "y", timeLimitMs: 1000 });
h2.tick(s3.id, 0.5);
ok(h2.get(s3.id).status === "running", "0.5s in");
const out = h2.tick(s3.id, 0.6);
ok(out && out.status === "timeout", `1.1s → timeout (status=${out && out.status})`);
ok(h2.get(s3.id).status === "timeout", "session marked timeout");

// 5. win
const h3 = MG.createHarness();
const s4 = h3.start({ playerId: "p", gameId: "g" });
h3.addScore(s4.id, 50);
const wr = h3.win(s4.id);
ok(wr.status === "won", "won");
ok(wr.bestScore === 50, "best = 50");
ok(h3.get(s4.id).status === "won", "persisted");

// 6. lose
const h4 = MG.createHarness();
const s5 = h4.start({ playerId: "p", gameId: "g" });
h4.addScore(s5.id, 20);
const lr = h4.lose(s5.id);
ok(lr.status === "lost", "lost");

// 7. abort
const h5 = MG.createHarness();
const s6 = h5.start({ playerId: "p", gameId: "g" });
ok(h5.abort(s6.id).ok === true, "abort ok");
ok(h5.get(s6.id).status === "aborted", "aborted");

// 8. arcade retries — lose → retry → win
const h6 = MG.createHarness();
const s7 = h6.start({ playerId: "p", gameId: "g", mode: "arcade", retryBudget: 2 });
h6.addScore(s7.id, 30);
const r1 = h6.lose(s7.id);
ok(r1.retried === true, "1st lose → retry");
ok(h6.get(s7.id).status === "running", "running again");
ok(h6.get(s7.id).currentScore === 0, "score reset");
ok(h6.get(s7.id).bestScore === 30, "best = 30");

h6.addScore(s7.id, 50);
const r2 = h6.lose(s7.id);
ok(r2.retried === true, "2nd lose → retry");
ok(h6.get(s7.id).bestScore === 50, "best = 50");

h6.addScore(s7.id, 20);
const r3 = h6.lose(s7.id);
ok(r3.retried !== true, "3rd lose → no retry (budget exhausted)");
ok(h6.get(s7.id).status === "lost", "final = lost");
ok(h6.get(s7.id).bestScore === 50, "best stays 50");

// 9. arcade win on first try ends immediately
const h7 = MG.createHarness();
const s8 = h7.start({ playerId: "p", gameId: "g", mode: "arcade", retryBudget: 3 });
h7.addScore(s8.id, 100);
const wr2 = h7.win(s8.id);
ok(wr2.status === "won", "win ends arcade immediately");
ok(h7.get(s8.id).retriesUsed === 0, "0 retries used");

// 10. endless mode never times out
const h8 = MG.createHarness();
const s9 = h8.start({ playerId: "p", gameId: "g", mode: "endless" });
for (let i = 0; i < 100; i++) h8.tick(s9.id, 1);
ok(h8.get(s9.id).status === "running", "endless still running");
h8.lose(s9.id);
ok(h8.get(s9.id).status === "lost", "endless ends on explicit lose");

// 11. Tick on done session no-op
const h9 = MG.createHarness();
const sd = h9.start({ playerId: "p", gameId: "g" });
h9.win(sd.id);
ok(h9.tick(sd.id, 1) === null, "tick on done returns null");

// 12. Score on done session rejected
ok(h9.addScore(sd.id, 5).ok === false, "addScore on done fails");

// 13. Win submits leaderboard
const lb = LB.createSystem();
lb.createBoard("race");
const h10 = MG.createHarness();
const s10 = h10.start({ playerId: "alice", gameId: "race" });
h10.addScore(s10.id, 250);
h10.win(s10.id, { leaderboard: lb });
const lbTop = lb.top("race");
ok(lbTop.length === 1 && lbTop[0].score === 250, "leaderboard submission");

// 14. Win submits daily challenge
const dc = DC.createSystem();
dc.registerChallenge({
  id: "win_race", kind: "win_minigame", minigameId: "race",
  rewardCcy: "coin", rewardAmount: 100,
});
// Force "win_race" into today's pick (only one challenge in pool → always picked)
const h11 = MG.createHarness();
const s11 = h11.start({ playerId: "bob", gameId: "race" });
h11.addScore(s11.id, 1000);
h11.win(s11.id, { dailyChallenges: dc });
ok(dc.ledgerOf("bob").length === 1, "daily challenge granted");

// 15. History track
const sess = h.get(s1.id);
ok(sess.history.length > 0, "history populated");
ok(sess.history.some(h => h.event === "score"), "score event in history");

// 16. recentEvents
const ev = h.recentEvents();
ok(ev.length > 0, "harness events logged");
ok(ev.some(e => e.kind === "start"), "start event");

// 17. Multiple parallel sessions
const h12 = MG.createHarness();
const sa = h12.start({ playerId: "alice", gameId: "race" });
const sb = h12.start({ playerId: "alice", gameId: "puzzle" });
h12.addScore(sa.id, 10);
h12.addScore(sb.id, 99);
ok(h12.get(sa.id).currentScore === 10 && h12.get(sb.id).currentScore === 99,
   "independent scores");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
