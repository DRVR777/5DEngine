// test_iter_89.js — coop missions: vector clocks + per-objective merge + catchup.
const C = require("./coop_missions.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Vector clock helpers
ok(C._clockDominates({ a: 1, b: 2 }, { a: 1, b: 2 }) === true, "equal clocks dominate");
ok(C._clockDominates({ a: 2, b: 2 }, { a: 1, b: 2 }) === true, "higher dominates");
ok(C._clockDominates({ a: 1, b: 2 }, { a: 2, b: 1 }) === false, "concurrent: not dominated");

const m = C._mergeClock({ a: 1, b: 2 }, { a: 3, c: 4 });
ok(m.a === 3 && m.b === 2 && m.c === 4, "merge clock entry-wise max");

// 2. createSession validation
let threw = false;
try { C.createSession({}); } catch (e) { threw = true; }
ok(threw, "missing missionId throws");

threw = false;
try { C.createSession({ missionId: "m" }); } catch (e) { threw = true; }
ok(threw, "missing mission throws");

// 3. Basic single-player session
const mission = {
  objectives: [
    { id: "kill", kind: "kill", count: 10, matchTag: "enemy" },
    { id: "go", kind: "reach", target: { u: 50, v: 0 }, radius: 1 },
  ],
};
const sess = C.createSession({ missionId: "heist", mission });
ok(sess.joinPlayer("alice").ok === true, "alice joined");
ok(sess.joinPlayer("alice").ok === false, "dup join rejected");
ok(sess.listPlayers().length === 1, "1 player");

// 4. applyUpdate: alice kills 5
const u1 = sess.applyUpdate({
  playerId: "alice",
  patches: [{ idx: 0, progress: 5 }],
});
ok(u1.ok === true, "alice update ok");
ok(sess.getClock().alice === 1, "alice clock = 1");
const merged1 = sess.getMerged();
ok(merged1[0].progress === 5 && !merged1[0].completed, "5/10 not done");

// 5. bob joins → 2 players, kills combine
ok(sess.joinPlayer("bob").ok === true, "bob joined");
sess.applyUpdate({
  playerId: "bob",
  patches: [{ idx: 0, progress: 6 }],
});
const merged2 = sess.getMerged();
ok(merged2[0].progress === 11 && merged2[0].completed === true,
   `kills 5+6=11 → done (got ${merged2[0].progress})`);

// 6. reach: any player completing → completed
sess.applyUpdate({
  playerId: "bob",
  patches: [{ idx: 1, completed: true }],
});
const merged3 = sess.getMerged();
ok(merged3[1].completed === true, "bob reached → merged completed");

// 7. Mission completed (both required done)
ok(sess.getStatus() === "completed", "mission complete");

// 8. Snapshot for late-joiner catchup
const snap = sess.getSnapshot();
ok(snap.missionId === "heist", "snap missionId");
ok(snap.clock.alice === 1 && snap.clock.bob === 2, "snap clock");
ok(snap.merged[0].progress === 11, "snap merged kills");
ok(snap.status === "completed", "snap status");

// 9. Apply update from non-joined player rejected
const sess2 = C.createSession({ missionId: "x", mission });
const r = sess2.applyUpdate({ playerId: "ghost", patches: [] });
ok(r.ok === false && r.reason === "not_joined", "non-joined rejected");

// 10. mergeSnapshot — clean takeover
const sessA = C.createSession({ missionId: "y", mission });
sessA.joinPlayer("alice");
sessA.applyUpdate({ playerId: "alice", patches: [{ idx: 0, progress: 3 }] });

const sessB = C.createSession({ missionId: "y", mission });
const mr = sessB.mergeSnapshot(sessA.getSnapshot());
ok(mr.ok === true && mr.took === "remote", "remote-dominant merge");
ok(sessB.getMerged()[0].progress === 3, "merged progress");

// 11. mergeSnapshot — local-dominant no-op
const sessC = C.createSession({ missionId: "z", mission });
sessC.joinPlayer("alice");
sessC.applyUpdate({ playerId: "alice", patches: [{ idx: 0, progress: 5 }] });
sessC.applyUpdate({ playerId: "alice", patches: [{ idx: 0, progress: 8 }] });

const oldSnap = { clock: { alice: 1 }, merged: [{ progress: 5 }, {}], status: "active" };
const mr2 = sessC.mergeSnapshot(oldSnap);
ok(mr2.took === "local", "local-dominant: no change");
ok(sessC.getMerged()[0].progress === 8, "local stays 8");

// 12. mergeSnapshot — concurrent
const sessD = C.createSession({ missionId: "d", mission });
sessD.joinPlayer("alice");
sessD.applyUpdate({ playerId: "alice", patches: [{ idx: 0, progress: 3 }] });

const concurrentSnap = {
  clock: { bob: 5 },
  merged: [{ progress: 7, target: 10, completed: false }, {}],
  status: "active",
};
const mr3 = sessD.mergeSnapshot(concurrentSnap);
ok(mr3.took === "concurrent", "concurrent merge");
ok(sessD.getClock().alice === 1 && sessD.getClock().bob === 5, "clock entry-wise max");
// Merged progress = max(3, 7) = 7
ok(sessD.getMerged()[0].progress === 7, `concurrent progress max (got ${sessD.getMerged()[0].progress})`);

// 13. Bad inputs
ok(sess.mergeSnapshot(null).ok === false, "null snap rejected");
ok(sess.mergeSnapshot({}).ok === false, "no clock rejected");
ok(sess.applyUpdate(null).ok === false, "null update rejected");

// 14. leavePlayer
const sess3 = C.createSession({ missionId: "lv", mission });
sess3.joinPlayer("alice");
ok(sess3.leavePlayer("alice").ok === true, "alice left");
ok(sess3.leavePlayer("alice").ok === false, "double leave fails");

// 15. abort
const sess4 = C.createSession({ missionId: "ab", mission });
sess4.joinPlayer("alice");
ok(sess4.abort().ok === true, "abort ok");
ok(sess4.getStatus() === "aborted", "aborted");
ok(sess4.abort().ok === false, "double abort fails");

// 16. Per-objective: kill cumulative, reach any-one
const sess5 = C.createSession({ missionId: "tx", mission });
sess5.joinPlayer("a");
sess5.joinPlayer("b");
sess5.joinPlayer("c");
sess5.applyUpdate({ playerId: "a", patches: [{ idx: 0, progress: 3 }] });
sess5.applyUpdate({ playerId: "b", patches: [{ idx: 0, progress: 3 }] });
sess5.applyUpdate({ playerId: "c", patches: [{ idx: 0, progress: 4 }] });
ok(sess5.getMerged()[0].progress === 10 && sess5.getMerged()[0].completed,
   "3 players combined kills");

// reach: only c completes → still counts
const sess6 = C.createSession({ missionId: "r6", mission });
["a", "b", "c"].forEach(p => sess6.joinPlayer(p));
sess6.applyUpdate({ playerId: "c", patches: [{ idx: 1, completed: true }] });
ok(sess6.getMerged()[1].completed === true, "any-one reach → completed");
ok(!sess6.getMerged()[0].completed, "kills still incomplete");

// 17. Failure: escort failure propagates
const escMission = {
  objectives: [{ id: "escort", kind: "escort", entityId: "vip", target: { u: 10, v: 0 }, radius: 1 }],
};
const sess7 = C.createSession({ missionId: "e7", mission: escMission });
sess7.joinPlayer("a");
sess7.applyUpdate({ playerId: "a", patches: [{ idx: 0, failed: true }] });
ok(sess7.getMerged()[0].failed === true, "any-one fail → merged failed");
ok(sess7.getStatus() === "failed", "mission failed");

// 18. Optional objective doesn't fail-block
const optMission = {
  objectives: [
    { id: "req", kind: "reach", target: { u: 5, v: 0 }, radius: 1 },
    { id: "bonus", kind: "kill", count: 5, optional: true },
  ],
};
const sess8 = C.createSession({ missionId: "o8", mission: optMission });
sess8.joinPlayer("a");
sess8.applyUpdate({ playerId: "a", patches: [{ idx: 0, completed: true }] });
ok(sess8.getStatus() === "completed", "required done → mission complete");

// 19. recentEvents
const ev = sess.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "complete"), "complete event");

// 20. Snapshot includes player list
const snap2 = sess.getSnapshot();
ok(snap2.players.includes("alice") && snap2.players.includes("bob"), "players in snap");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
