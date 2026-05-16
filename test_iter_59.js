// test_iter_59.js — leaderboards: submit, ingest, top, rank, broadcast.
const LB = require("./leaderboard.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Submit higher-is-better
const sent = [];
const lb = LB.createLeaderboard({ sender: env => sent.push(env), nodeId: "node_a" });

ok(lb.submit("kills", "alice", 5).ok === true, "alice submits 5 kills");
ok(lb.submit("kills", "bob", 12).ok === true, "bob submits 12 kills");
ok(lb.submit("kills", "carol", 3).ok === true, "carol submits 3");

// 2. Score didn't improve → rejected
const lower = lb.submit("kills", "bob", 8);
ok(lower.ok === false && lower.reason === "not_an_improvement", "lower score rejected");
ok(lower.current === 12, "current preserved");

// 3. Top N
const top3 = lb.top("kills", 3);
ok(top3.length === 3, "top 3");
ok(top3[0].playerId === "bob", "bob first");
ok(top3[0].score === 12, "bob's score = 12");
ok(top3[1].playerId === "alice", "alice second");
ok(top3[2].playerId === "carol", "carol third");

// 4. Top with limit
const top1 = lb.top("kills", 1);
ok(top1.length === 1, "top 1");
ok(top1[0].playerId === "bob", "top 1 = bob");

// Top of unknown stat
ok(lb.top("ghost").length === 0, "unknown stat → empty");

// 5. rank
ok(lb.rank("kills", "bob") === 1, "bob rank 1");
ok(lb.rank("kills", "alice") === 2, "alice rank 2");
ok(lb.rank("kills", "carol") === 3, "carol rank 3");
ok(lb.rank("kills", "ghost") === null, "ghost has no rank");

// 6. Lower-is-better (e.g. lap time)
ok(lb.submit("lap_time", "alice", 90, { lowerIsBetter: true }).ok === true, "alice 90s");
ok(lb.submit("lap_time", "bob", 75, { lowerIsBetter: true }).ok === true, "bob 75s");
const lapTop = lb.top("lap_time", 5, true);
ok(lapTop[0].playerId === "bob", "bob (faster) first in lap_time");

// Improvement = lower
const lapImprove = lb.submit("lap_time", "bob", 70, { lowerIsBetter: true });
ok(lapImprove.ok === true, "bob improves to 70");

// Slower = rejected
const lapWorse = lb.submit("lap_time", "bob", 80, { lowerIsBetter: true });
ok(lapWorse.ok === false, "slower lap rejected");

// 7. Broadcast — every accepted submit emits an envelope
ok(sent.length >= 5, `at least 5 broadcasts so far (got ${sent.length})`);
ok(sent[0].type === "leaderboard.update", "envelope type");
ok(sent[0].payload.stat === "kills", "stat in payload");
ok(sent[0].payload.playerId === "alice", "playerId in payload");

// Rejected submits do NOT broadcast
const beforeCount = sent.length;
lb.submit("kills", "bob", 1);   // lower than 12
ok(sent.length === beforeCount, "rejected submit does not broadcast");

// 8. ingest — receive remote updates
const lb2 = LB.createLeaderboard({ nodeId: "node_b" });
ok(lb2.ingest(sent[0]) === true, "ingest valid envelope");
ok(lb2.get("kills", "alice").score === 5, "alice score replicated to lb2");

// Ingest all
for (const env of sent) lb2.ingest(env);
const lb2Top = lb2.top("kills", 5);
ok(lb2Top[0].playerId === "bob", "lb2 sees bob first too");
ok(lb2Top[0].score === 12, "lb2 sees bob's score");

// 9. Stale ingest rejected
const stale = {
  type: "leaderboard.update",
  payload: { stat: "kills", playerId: "bob", score: 999, ts: 0, source: "x" },
};
ok(lb2.ingest(stale) === false, "stale ts rejected");
ok(lb2.get("kills", "bob").score === 12, "bob's score unchanged");

// 10. Newer ingest wins
const newer = {
  type: "leaderboard.update",
  payload: { stat: "kills", playerId: "bob", score: 50, ts: Date.now() + 60000, source: "x" },
};
ok(lb2.ingest(newer) === true, "newer ts accepted");
ok(lb2.get("kills", "bob").score === 50, "bob updated to 50");

// 11. Bad envelopes
ok(lb.ingest(null) === false, "null rejected");
ok(lb.ingest({ type: "wrong" }) === false, "wrong type rejected");
ok(lb.ingest({ type: "leaderboard.update", payload: {} }) === false, "empty payload rejected");

// 12. Multiple stats coexist
ok(lb.listStats().sort().join(",") === "kills,lap_time", "2 stats tracked");

// 13. clear
lb.clear("kills");
ok(lb.top("kills").length === 0, "kills cleared");
ok(lb.top("lap_time").length > 0, "lap_time still here");
lb.clear();
ok(lb.listStats().length === 0, "all cleared");

// 14. Custom timestamp on submit
const r1 = lb.submit("score", "alice", 100, { ts: 5000 });
ok(r1.ok === true, "submit with custom ts");
const last = sent[sent.length - 1];
ok(last.payload.ts === 5000, "custom ts forwarded");

// 15. Source attribution
const r2 = lb.submit("kills", "alice", 99, { source: "tournament" });
ok(r2.ok === true, "submit with source");
const e = sent[sent.length - 1];
ok(e.payload.source === "tournament", "source forwarded");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
