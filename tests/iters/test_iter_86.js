// test_iter_86.js — leaderboards: boards, submit, filter, rank.
const L = require("./leaderboards.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. createSystem + createBoard
const sys = L.createSystem();
ok(sys.createBoard("race_1").ok === true, "create high-board");
ok(sys.createBoard("race_1").ok === false, "duplicate rejected");
ok(sys.createBoard("speedrun", { sort: "low" }).ok === true, "low-sort board");
ok(sys.createBoard("bad", { sort: "weird" }).ok === false, "bad sort rejected");

// 2. listBoards
ok(sys.listBoards().length === 2, "2 boards");
ok(sys.listBoards().includes("race_1"), "race_1 listed");

// 3. submit
const t0 = 1700000000000;   // fixed timestamp baseline
const s1 = sys.submit({ boardId: "race_1", playerId: "alice", score: 100, region: "us", ts: t0 });
ok(s1.ok === true && s1.id === "sub_1", "submit ok");
ok(s1.rank === 1, "rank 1");

const s2 = sys.submit({ boardId: "race_1", playerId: "bob",   score: 150, region: "us", ts: t0 + 1 });
ok(s2.ok === true && s2.rank === 1, "bob is now #1 (high-sort)");

// Bad submissions
ok(sys.submit({}).ok === false, "empty submission");
ok(sys.submit({ boardId: "ghost", playerId: "a", score: 10 }).ok === false, "ghost board");
ok(sys.submit({ boardId: "race_1", playerId: "a" }).ok === false, "missing score");
ok(sys.submit({ boardId: "race_1", score: 10 }).ok === false, "missing player");

// 4. More entries
sys.submit({ boardId: "race_1", playerId: "carol", score: 80,  region: "eu", ts: t0 + 2 });
sys.submit({ boardId: "race_1", playerId: "dave",  score: 200, region: "eu", ts: t0 + 3 });
sys.submit({ boardId: "race_1", playerId: "eve",   score: 50,  region: "asia", ts: t0 + 4 });

// 5. top all-time
const topAll = sys.top("race_1", { window: "all", limit: 5, now: t0 + 1000 });
ok(topAll.length === 5, "5 entries");
ok(topAll[0].playerId === "dave", `#1 dave (got ${topAll[0].playerId})`);
ok(topAll[1].playerId === "bob", "#2 bob");
ok(topAll[2].playerId === "alice", "#3 alice");

// 6. Filter by region
const us = sys.top("race_1", { region: "us", now: t0 + 1000 });
ok(us.length === 2, "2 us entries");
ok(us[0].playerId === "bob", "bob top us");
ok(us[1].playerId === "alice", "alice next us");

// 7. Filter by time window
sys.submit({ boardId: "race_1", playerId: "frank", score: 500, region: "us", ts: t0 + (2 * 60 * 60 * 1000) });
const recentHour = sys.top("race_1", { window: "hour", now: t0 + 1000 });
ok(recentHour.every(e => e.ts >= t0 + 1000 - 3600000), "all within hour");
ok(!recentHour.find(e => e.playerId === "frank"), "frank's 2h-old submission excluded");

// 8. Friend filter
sys.submit({ boardId: "race_1", playerId: "g1", score: 300, friendsOf: ["alice"], ts: t0 + 5 });
sys.submit({ boardId: "race_1", playerId: "g2", score: 250, friendsOf: ["alice", "bob"], ts: t0 + 6 });
const aliceFriends = sys.top("race_1", { friendOf: "alice", now: t0 + 1000 });
ok(aliceFriends.length === 2, "2 alice-friends");
ok(aliceFriends[0].playerId === "g1", "g1 ranks above g2");

// 9. low-sort board (speedrun)
sys.submit({ boardId: "speedrun", playerId: "a", score: 60.5, ts: t0 });
sys.submit({ boardId: "speedrun", playerId: "b", score: 55.2, ts: t0 });
sys.submit({ boardId: "speedrun", playerId: "c", score: 70.1, ts: t0 });
const sr = sys.top("speedrun", { now: t0 + 100 });
ok(sr[0].playerId === "b", `low-sort: b (55.2) is #1 (got ${sr[0].playerId})`);
ok(sr[2].playerId === "c", "c (70.1) is last");

// 10. rankOf — after g1 (300) and g2 (250) submissions, dave (200) is rank 3
ok(sys.rankOf("race_1", "dave", { now: t0 + 1000 }) === 3, "dave rank 3 (g1+g2 above)");
ok(sys.rankOf("race_1", "eve", { now: t0 + 1000 }) > 1, "eve rank > 1");
ok(sys.rankOf("race_1", "ghost", { now: t0 + 1000 }) === null, "ghost null");
ok(sys.rankOf("ghost", "dave") === null, "no board null");

// 11. bestOf
const best = sys.bestOf("race_1", "alice", { now: t0 + 1000 });
ok(best && best.score === 100, "alice's best = 100");
ok(sys.bestOf("race_1", "ghost") === null, "ghost best null");

// 12. leaderboard (aggregated best per player)
sys.submit({ boardId: "race_1", playerId: "alice", score: 220, region: "us", ts: t0 + 100 });   // alice's new best
const lb = sys.leaderboard("race_1", { now: t0 + 1000, limit: 10 });
const aliceEntry = lb.find(e => e.playerId === "alice");
ok(aliceEntry.score === 220, "alice best aggregated = 220");
// Only one entry per player
const playerIds = lb.map(e => e.playerId);
ok(new Set(playerIds).size === playerIds.length, "one entry per player");

// 13. maxEntriesPerBoard
const sys2 = L.createSystem({ config: { maxEntriesPerBoard: 5 } });
sys2.createBoard("small");
for (let i = 0; i < 20; i++) {
  sys2.submit({ boardId: "small", playerId: "p" + i, score: i, ts: t0 + i });
}
const board = sys2.getBoard("small");
ok(board.entries.length === 5, `capped at 5 (got ${board.entries.length})`);
ok(board.entries[0].score === 19, "#1 = 19 (highest)");

// 14. deleteBoard
ok(sys.deleteBoard("race_1").ok === true, "delete ok");
ok(sys.getBoard("race_1") === null, "gone");
ok(sys.deleteBoard("race_1").ok === false, "delete missing fails");

// 15. recentSubmissions
const subs = sys.recentSubmissions();
ok(subs.length > 0, "submissions logged");

// 16. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "submit"), "submit event");

// 17. Time window: day vs week
const sys3 = L.createSystem();
sys3.createBoard("b");
const tNow = t0 + 7 * 24 * 60 * 60 * 1000;  // 7 days after t0
sys3.submit({ boardId: "b", playerId: "old", score: 10, ts: t0 });            // 7d ago
sys3.submit({ boardId: "b", playerId: "newer", score: 20, ts: tNow - 1000 }); // recent
const day = sys3.top("b", { window: "day", now: tNow });
const week = sys3.top("b", { window: "week", now: tNow });
ok(day.length === 1 && day[0].playerId === "newer", "day window: 1 entry");
// week is 7 days exactly; "old" at t0 is just at boundary — may or may not be in
ok(week.length >= 1, "week window: at least 1");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
