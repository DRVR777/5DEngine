// test_iter_102.js — PvP queue: matchmaking, regions, vote, snake-draft.
const Q = require("./pvp_queue.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const t0 = 1000;

// 1. Modes registered
ok(Q.MODES["1v1"] !== undefined, "1v1 mode");
ok(Q.MODES["2v2"] !== undefined, "2v2 mode");
ok(Q.MODES["5v5"] !== undefined, "5v5 mode");
ok(Q.MODES["ffa_8"] !== undefined, "ffa_8 mode");

// 2. Enqueue + cancel
const sys = Q.createQueue();
const e1 = sys.enqueue({ playerId: "alice", mode: "1v1", region: "us", skill: 1500, ts: t0 });
ok(e1.ok && e1.ticketId === "ticket_1", "enqueue ok");

// Bad enqueue
ok(sys.enqueue({}).ok === false, "empty rejected");
ok(sys.enqueue({ playerId: "x", mode: "weird", skill: 1000 }).ok === false, "bad mode");
ok(sys.enqueue({ playerId: "x", mode: "1v1" }).ok === false, "missing skill");

// Duplicate enqueue
ok(sys.enqueue({ playerId: "alice", mode: "1v1", skill: 1500 }).ok === false,
   "duplicate rejected");

// 3. Cancel
ok(sys.cancel(e1.ticketId, "alice").ok === true, "cancel ok");
ok(sys.cancel(e1.ticketId, "alice").ok === false, "double cancel fails");
ok(sys.cancel("ghost", "alice").ok === false, "ghost ticket fails");

// Wrong player cancel
const e2 = sys.enqueue({ playerId: "bob", mode: "1v1", region: "us", skill: 1500, ts: t0 });
ok(sys.cancel(e2.ticketId, "intruder").ok === false, "non-owner cancel");

// 4. 1v1 matchmaking
const sys2 = Q.createQueue();
sys2.enqueue({ playerId: "a", mode: "1v1", region: "us", skill: 1500, ts: t0 });
sys2.enqueue({ playerId: "b", mode: "1v1", region: "us", skill: 1520, ts: t0 });
const formed1 = sys2.tick(t0 + 100);
ok(formed1.length === 1, "1 lobby formed");
ok(formed1[0].mode === "1v1", "mode 1v1");
ok(formed1[0].teams.length === 2, "2 teams");
ok(formed1[0].teams[0].length === 1 && formed1[0].teams[1].length === 1, "1 per team");
ok(formed1[0].members.length === 2, "2 members");
ok(formed1[0].state === "voting", "voting state");

// Tickets are matched
ok(sys2.listQueue().length === 0, "queue drained");

// 5. Skill spread blocks distant matches
const sys3 = Q.createQueue({ config: { initialSkillSpread: 50, widenPerSec: 0 } });
sys3.enqueue({ playerId: "low", mode: "1v1", region: "us", skill: 100, ts: t0 });
sys3.enqueue({ playerId: "high", mode: "1v1", region: "us", skill: 9999, ts: t0 });
ok(sys3.tick(t0 + 100).length === 0, "skill too far apart");

// Spread widens over time
const sys4 = Q.createQueue({ config: { initialSkillSpread: 50, widenPerSec: 100 } });
sys4.enqueue({ playerId: "a", mode: "1v1", region: "us", skill: 1000, ts: t0 });
sys4.enqueue({ playerId: "b", mode: "1v1", region: "us", skill: 1200, ts: t0 });
// At t0 + 100ms: spread = 50 + 0.1*100 = 60; diff 200; no match
ok(sys4.tick(t0 + 100).length === 0, "too tight still");
// At t0 + 2s: spread = 50 + 2*100 = 250; diff 200; match
ok(sys4.tick(t0 + 2000).length === 1, "spread widened → match");

// 6. Region matching: cross-region after timeout
const sys5 = Q.createQueue({ config: { crossRegionAfterMs: 5000, widenPerSec: 0, initialSkillSpread: 1000 } });
sys5.enqueue({ playerId: "us1", mode: "1v1", region: "us", skill: 1500, ts: t0 });
sys5.enqueue({ playerId: "eu1", mode: "1v1", region: "eu", skill: 1500, ts: t0 });
ok(sys5.tick(t0 + 100).length === 0, "different regions blocked");
ok(sys5.tick(t0 + 6000).length === 1, "after timeout → cross-region match");

// 7. 2v2: 4 players, 2 teams of 2
const sys6 = Q.createQueue();
for (let i = 0; i < 4; i++) {
  sys6.enqueue({ playerId: "p" + i, mode: "2v2", region: "us", skill: 1500 + i * 10, ts: t0 });
}
const f2v2 = sys6.tick(t0 + 100);
ok(f2v2.length === 1, "2v2 lobby formed");
ok(f2v2[0].teams[0].length === 2 && f2v2[0].teams[1].length === 2, "2v2 teams balanced");

// 8. Snake-draft balancing (highest+lowest on team A, middle on team B)
const sys7 = Q.createQueue({ config: { initialSkillSpread: 500 } });
sys7.enqueue({ playerId: "top",  mode: "2v2", region: "us", skill: 2000, ts: t0 });
sys7.enqueue({ playerId: "high", mode: "2v2", region: "us", skill: 1900, ts: t0 });
sys7.enqueue({ playerId: "mid",  mode: "2v2", region: "us", skill: 1800, ts: t0 });
sys7.enqueue({ playerId: "low",  mode: "2v2", region: "us", skill: 1700, ts: t0 });
const fSnake = sys7.tick(t0 + 100);
// Snake: top→T1, high→T2, mid→T1, low→T2 => T1=[top,mid], T2=[high,low]
const team1 = fSnake[0].teams[0];
const team2 = fSnake[0].teams[1];
ok(team1.includes("top") && team1.includes("mid"), "T1 has top + mid");
ok(team2.includes("high") && team2.includes("low"), "T2 has high + low");

// 9. ffa_8: 8 teams of 1
const sys8 = Q.createQueue();
for (let i = 0; i < 8; i++) {
  sys8.enqueue({ playerId: "ff" + i, mode: "ffa_8", region: "us", skill: 1500, ts: t0 });
}
const fFfa = sys8.tick(t0 + 100);
ok(fFfa.length === 1, "ffa lobby formed");
ok(fFfa[0].teams.length === 8, "8 teams");
ok(fFfa[0].teams.every(t => t.length === 1), "1 per team");

// 10. Vote map
const lobby = fSnake[0];
const candMap = lobby.candidateMaps[0];
ok(sys7.voteMap(lobby.id, "top", candMap).ok, "vote ok");
ok(sys7.voteMap(lobby.id, "intruder", candMap).ok === false, "non-member rejected");
ok(sys7.voteMap(lobby.id, "high", "fake_map").ok === false, "bad map rejected");

// Everyone votes for same map → finalize
sys7.voteMap(lobby.id, "high", candMap);
sys7.voteMap(lobby.id, "mid", candMap);
sys7.voteMap(lobby.id, "low", candMap);
ok(lobby.state === "ready", "all voted → ready");
ok(lobby.chosenMap === candMap, "map chosen");

// 11. Vote rejected when not voting
ok(sys7.voteMap(lobby.id, "top", candMap).ok === false, "vote on non-voting rejected");

// 12. Vote window expiration
const sys9 = Q.createQueue({ config: { voteWindowMs: 1000 } });
sys9.enqueue({ playerId: "a", mode: "1v1", region: "us", skill: 1500, ts: t0 });
sys9.enqueue({ playerId: "b", mode: "1v1", region: "us", skill: 1500, ts: t0 });
const l9 = sys9.tick(t0)[0];
ok(l9.state === "voting", "voting initially");
sys9.tick(t0 + 5000);  // past vote window
ok(sys9.getLobby(l9.id).state === "ready", "auto-finalized after window");
ok(sys9.getLobby(l9.id).chosenMap !== null, "map chosen even with no votes");

// 13. Custom preferred maps
const sys10 = Q.createQueue();
sys10.enqueue({ playerId: "a", mode: "1v1", region: "us", skill: 1500, ts: t0,
                preferredMaps: ["volcano", "ice", "city"] });
sys10.enqueue({ playerId: "b", mode: "1v1", region: "us", skill: 1500, ts: t0,
                preferredMaps: ["volcano", "desert"] });
const l10 = sys10.tick(t0)[0];
ok(l10.candidateMaps.includes("volcano"), "volcano in candidates");
ok(l10.candidateMaps[0] === "volcano", "volcano top (most votes)");

// 14. startMatch
const sys11 = Q.createQueue({ config: { voteWindowMs: 100 } });
sys11.enqueue({ playerId: "a", mode: "1v1", region: "us", skill: 1500, ts: t0 });
sys11.enqueue({ playerId: "b", mode: "1v1", region: "us", skill: 1500, ts: t0 });
const l11 = sys11.tick(t0)[0];
sys11.tick(t0 + 500);  // expire vote
ok(sys11.startMatch(l11.id).ok === true, "start match");
ok(sys11.getLobby(l11.id).state === "in_match", "in_match");
ok(sys11.startMatch(l11.id).ok === false, "double start fails");

// 15. Multiple lobbies
const sys12 = Q.createQueue();
for (let i = 0; i < 6; i++) {
  sys12.enqueue({ playerId: "x" + i, mode: "1v1", region: "us", skill: 1500, ts: t0 });
}
const fMany = sys12.tick(t0 + 100);
ok(fMany.length === 3, `3 lobbies from 6 players (got ${fMany.length})`);

// 16. Recent events
const ev = sys2.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "enqueue"), "enqueue events");
ok(ev.some(e => e.kind === "form"), "form events");

// 17. listQueue + listTickets
const sys13 = Q.createQueue();
sys13.enqueue({ playerId: "a", mode: "1v1", skill: 1000 });
sys13.enqueue({ playerId: "b", mode: "2v2", skill: 1000 });
ok(sys13.listQueue().length === 2, "2 queued");
ok(sys13.listQueue("1v1").length === 1, "1 in 1v1 queue");
ok(sys13.listTickets().length === 2, "2 tickets");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
