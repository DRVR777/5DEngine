// test_iter_122.js — race/track: laps, checkpoints, finish, ghosts.
const R = require("./race_track.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. defineTrack
const sys = R.createSystem();
const t1 = sys.defineTrack({
  id: "loop", name: "Loop",
  // 4 checkpoints in order; player starts at (0,0); each lap crosses all 4.
  checkpoints: [
    { u: 100, v: 0 }, { u: 100, v: 100 }, { u: 0, v: 100 }, { u: 0, v: 0 },
  ],
});
ok(t1.ok, "track defined");
ok(sys.defineTrack({}).ok === false, "missing id");
ok(sys.defineTrack({ id: "x" }).ok === false, "no checkpoints");
ok(sys.defineTrack({ id: "y", checkpoints: [{}] }).ok === false, "1 cp");
ok(sys.defineTrack({ id: "loop", checkpoints: [{},{}] }).ok === false, "duplicate");

ok(sys.listTracks().length === 1, "1 track");
ok(sys.getTrack("loop") !== null, "getTrack");
ok(sys.getTrack("ghost") === null, "ghost track");

// 2. startRace
const r1 = sys.startRace({ trackId: "loop", racers: ["alice", "bob"], laps: 2, now: 0 });
ok(r1.ok, "race started");
ok(sys.startRace({ trackId: "ghost", racers: ["x"] }).ok === false, "no track");
ok(sys.startRace({ trackId: "loop", racers: [] }).ok === false, "no racers");

// 3. updatePosition + checkpoint crossings
// Cross checkpoint 1 (already at 0,0 → currentCheckpoint=0)
const u1 = sys.updatePosition(r1.raceId, "alice", { u: 100, v: 0 }, { now: 1000 });
ok(u1.ok, "update ok");
const prog = sys.getRacerProgress(r1.raceId, "alice");
ok(prog.currentCheckpoint === 1, "cp 1 crossed");

// Cross more
sys.updatePosition(r1.raceId, "alice", { u: 100, v: 100 }, { now: 2000 });
sys.updatePosition(r1.raceId, "alice", { u: 0, v: 100 }, { now: 3000 });
sys.updatePosition(r1.raceId, "alice", { u: 0, v: 0 }, { now: 4000 });
const progLap2 = sys.getRacerProgress(r1.raceId, "alice");
ok(progLap2.currentLap === 2, "now on lap 2");
ok(progLap2.lapTimes.length === 1, "1 lap time");
ok(progLap2.lapTimes[0] === 4000, "first lap 4s");
ok(progLap2.bestLapMs === 4000, "best 4s");

// 4. Race continues
sys.updatePosition(r1.raceId, "alice", { u: 100, v: 0 }, { now: 5000 });
sys.updatePosition(r1.raceId, "alice", { u: 100, v: 100 }, { now: 6000 });
sys.updatePosition(r1.raceId, "alice", { u: 0, v: 100 }, { now: 7000 });
sys.updatePosition(r1.raceId, "alice", { u: 0, v: 0 }, { now: 7500 });
// Lap 2: 3500ms (faster) → new best
const progAfter = sys.getRacerProgress(r1.raceId, "alice");
ok(progAfter.bestLapMs === 3500, "new best 3.5s");
ok(progAfter.finished === true, "alice finished");

// Race still active because bob hasn't
ok(sys.getRace(r1.raceId).status === "active", "race active");

// 5. Bob races
sys.updatePosition(r1.raceId, "bob", { u: 100, v: 0 }, { now: 2000 });
sys.updatePosition(r1.raceId, "bob", { u: 100, v: 100 }, { now: 4000 });
sys.updatePosition(r1.raceId, "bob", { u: 0, v: 100 }, { now: 6000 });
sys.updatePosition(r1.raceId, "bob", { u: 0, v: 0 }, { now: 8000 });
sys.updatePosition(r1.raceId, "bob", { u: 100, v: 0 }, { now: 10000 });
sys.updatePosition(r1.raceId, "bob", { u: 100, v: 100 }, { now: 12000 });
sys.updatePosition(r1.raceId, "bob", { u: 0, v: 100 }, { now: 14000 });
sys.updatePosition(r1.raceId, "bob", { u: 0, v: 0 }, { now: 16000 });

ok(sys.getRace(r1.raceId).status === "completed", "race complete");

// 6. Leaderboard
const lb = sys.leaderboard(r1.raceId);
ok(lb.length === 2, "2 entries");
ok(lb[0].racerId === "alice", "alice 1st");
ok(lb[0].totalTimeMs < lb[1].totalTimeMs, "alice faster");

// 7. Bad updates
ok(sys.updatePosition("ghost", "alice", { u: 0, v: 0 }).ok === false, "no race");
// Race is completed after both finished — updates rejected as not_active
const uOver = sys.updatePosition(r1.raceId, "carol", { u: 0, v: 0 });
ok(uOver.ok === false && uOver.reason === "not_active", "race over → not_active");

// 8. abortRace
const r2 = sys.startRace({ trackId: "loop", racers: ["x"], now: 0 });
ok(sys.abortRace(r2.raceId).ok === true, "abort ok");
ok(sys.getRace(r2.raceId).status === "aborted", "aborted");
ok(sys.abortRace(r2.raceId).ok === false, "double abort");
ok(sys.abortRace("ghost").ok === false, "ghost abort");

// 9. getGhost — fastest lap saved
const ghost = sys.getGhost("loop", "alice");
ok(ghost !== null, "ghost exists");
ok(Array.isArray(ghost), "ghost is array");
ok(sys.getGhost("loop", "ghost") === null, "no ghost for missing");
ok(sys.getGhost("missing", "alice") === null, "no ghost for missing track");

// 10. ghostPositionAt
const pos = sys.ghostPositionAt("loop", "alice", 0);
ok(pos !== null, "ghost pos at 0");

const posMid = sys.ghostPositionAt("loop", "alice", 1000);
ok(posMid !== null, "ghost pos at mid");

// 11. clearGhost
ok(sys.clearGhost("loop", "alice") === true, "cleared");
ok(sys.getGhost("loop", "alice") === null, "gone");
ok(sys.clearGhost("loop", "alice") === false, "double clear");

// 12. Multiple racers same track, ghost per racer
const sys2 = R.createSystem({ config: { checkpointRadius: 5 } });
sys2.defineTrack({ id: "t", checkpoints: [{ u: 10, v: 0 }, { u: 0, v: 0 }] });
const sr2 = sys2.startRace({ trackId: "t", racers: ["a", "b"], laps: 1, now: 0 });
sys2.updatePosition(sr2.raceId, "a", { u: 10, v: 0 }, { now: 1000 });   // cp 0
sys2.updatePosition(sr2.raceId, "a", { u: 0, v: 0 }, { now: 2000 });    // cp 1 → lap done
sys2.updatePosition(sr2.raceId, "b", { u: 10, v: 0 }, { now: 3000 });
sys2.updatePosition(sr2.raceId, "b", { u: 0, v: 0 }, { now: 5000 });

ok(sys2.getGhost("t", "a") !== null, "a has ghost");
ok(sys2.getGhost("t", "b") !== null, "b has ghost");

// 13. Per-racer best lap tracked separately
const aProg = sys2.getRacerProgress(sr2.raceId, "a");
const bProg = sys2.getRacerProgress(sr2.raceId, "b");
ok(aProg.bestLapMs < bProg.bestLapMs, "a best < b best");

// 14. Checkpoint radius affects detection
const sys3 = R.createSystem({ config: { checkpointRadius: 1 } });
sys3.defineTrack({ id: "tight", checkpoints: [{ u: 10, v: 0 }, { u: 0, v: 0 }] });
const r3 = sys3.startRace({ trackId: "tight", racers: ["p"], laps: 1, now: 0 });
// Far from cp 0 (at u=10) → no cross
sys3.updatePosition(r3.raceId, "p", { u: 5, v: 0 }, { now: 100 });
ok(sys3.getRacerProgress(r3.raceId, "p").currentCheckpoint === 0, "didn't cross");
// Close enough (radius 1, pos 10.5, cp at 10 → dist 0.5) → crosses cp 0
sys3.updatePosition(r3.raceId, "p", { u: 10.5, v: 0 }, { now: 200 });
const progRadius = sys3.getRacerProgress(r3.raceId, "p");
ok(progRadius.currentCheckpoint === 1, "crossed cp 0 within radius");

// 15. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "lap"), "lap events");
ok(sys.recentEvents().some(e => e.kind === "race_completed"), "completion event");

// 16. getConfig
ok(sys.getConfig().checkpointRadius > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
