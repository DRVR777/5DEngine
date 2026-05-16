// test_iter_84.js — mission DSL: parse, run, objectives, branches.
const M = require("./mission_dsl.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. parseMission validation
let threw = false;
try { M.parseMission(null); } catch (e) { threw = true; }
ok(threw, "null spec throws");

threw = false;
try { M.parseMission({ id: "x" }); } catch (e) { threw = true; }
ok(threw, "missing objectives throws");

threw = false;
try { M.parseMission({ id: "x", objectives: [{ kind: "reach" }] }); } catch (e) { threw = true; }
ok(threw, "objective missing id throws");

threw = false;
try { M.parseMission({ id: "x", objectives: [{ id: "o1", kind: "ghost" }] }); } catch (e) { threw = true; }
ok(threw, "unknown kind throws");

threw = false;
try { M.parseMission({ id: "x", objectives: [{ id: "o1", kind: "reach" }] }); } catch (e) { threw = true; }
ok(threw, "reach missing target throws");

// Valid spec parses
const valid = M.parseMission({
  id: "intro",
  name: "Intro",
  objectives: [
    { id: "go_there", kind: "reach", target: { u: 10, v: 10 }, radius: 2 },
  ],
});
ok(valid.id === "intro", "parsed intro");
ok(valid.objectives.length === 1, "1 obj");

// 2. Runner basics
const runner = M.createRunner();
const start1 = runner.start({
  id: "m1",
  objectives: [
    { id: "go", kind: "reach", target: { u: 5, v: 0 }, radius: 1 },
  ],
});
ok(start1.ok === true, "start ok");
ok(runner.listActive().length === 1, "1 active");

// Duplicate start
const dup = runner.start({
  id: "m1",
  objectives: [{ id: "x", kind: "reach", target: { u: 0, v: 0 }, radius: 1 }],
});
ok(dup.ok === false && dup.reason === "already_started", "dup rejected");

// 3. Reach objective via world.getPosition
let playerPos = { u: 0, v: 0 };
const world = {
  getPosition: (id) => id === "player" ? playerPos : null,
};
runner.tick(0.1, world);
ok(runner.getMission("m1").status === "active", "still active");

playerPos = { u: 5, v: 0 };
const r = runner.tick(0.1, world);
ok(r.completed.includes("m1"), "m1 completed");
ok(runner.getMission("m1").status === "completed", "status completed");

// 4. Kill objective
const killRunner = M.createRunner();
killRunner.start({
  id: "kills",
  objectives: [{ id: "k", kind: "kill", count: 3, matchTag: "enemy" }],
});
let kills = 0;
const killWorld = { getKillCount: () => kills };
killRunner.tick(0.1, killWorld);
ok(killRunner.getMission("kills").status === "active", "0/3 active");
kills = 2;
killRunner.tick(0.1, killWorld);
ok(killRunner.getMission("kills").status === "active", "2/3 active");
kills = 3;
killRunner.tick(0.1, killWorld);
ok(killRunner.getMission("kills").status === "completed", "3/3 done");

// 5. Collect objective
const collectRunner = M.createRunner();
collectRunner.start({
  id: "c", objectives: [{ id: "c1", kind: "collect", count: 5, itemType: "coin" }],
});
let coins = 0;
const collectWorld = { getCollectCount: () => coins };
collectRunner.tick(0.1, collectWorld);
ok(collectRunner.getMission("c").status === "active", "0/5");
coins = 5;
collectRunner.tick(0.1, collectWorld);
ok(collectRunner.getMission("c").status === "completed", "5/5 done");

// 6. Survive objective
const survive = M.createRunner();
survive.start({
  id: "s", objectives: [{ id: "stay", kind: "survive", duration: 1000 }],
});
let dead = false;
const survWorld = { isDead: () => dead };
survive.tick(0.5, survWorld);
ok(survive.getMission("s").status === "active", "0.5s in");
survive.tick(0.6, survWorld);   // total 1.1s
ok(survive.getMission("s").status === "completed", "survived 1s");

// Survive fail on death
const survFail = M.createRunner();
survFail.start({ id: "sf", objectives: [{ id: "x", kind: "survive", duration: 5000 }] });
dead = true;
survFail.tick(0.1, { isDead: () => true });
ok(survFail.getMission("sf").status === "failed", "death = fail");

// 7. Timer = must complete before deadline
const timerRunner = M.createRunner();
timerRunner.start({
  id: "t", objectives: [
    { id: "tm", kind: "timer", duration: 1000 },
    { id: "goal", kind: "reach", target: { u: 100, v: 0 }, radius: 1 },
  ],
});
// Don't move; tick past timer
timerRunner.tick(2, { getPosition: () => ({ u: 0, v: 0 }) });
ok(timerRunner.getMission("t").status === "failed", "timer expired → fail");

// 8. Escort
const escortR = M.createRunner();
escortR.start({
  id: "e", objectives: [
    { id: "esc", kind: "escort", entityId: "vip", target: { u: 50, v: 0 }, radius: 2 },
  ],
});
let vipPos = { u: 0, v: 0 };
const escWorld = {
  getPosition: (id) => id === "vip" ? vipPos : null,
  isDead: () => false,
};
escortR.tick(0.1, escWorld);
ok(escortR.getMission("e").status === "active", "vip not there");
vipPos = { u: 50, v: 0 };
escortR.tick(0.1, escWorld);
ok(escortR.getMission("e").status === "completed", "vip arrived");

// VIP dies = fail
const escFail = M.createRunner();
escFail.start({ id: "ef", objectives: [{ id: "x", kind: "escort", entityId: "vip", target: { u: 0, v: 0 }, radius: 1 }] });
escFail.tick(0.1, { getPosition: () => ({ u: 100, v: 100 }), isDead: (id) => id === "vip" });
ok(escFail.getMission("ef").status === "failed", "VIP death = fail");

// 9. any_of
const anyR = M.createRunner();
anyR.start({
  id: "a", objectives: [{
    id: "branch", kind: "any_of", sub: [
      { id: "a1", kind: "reach", target: { u: 10, v: 0 }, radius: 1 },
      { id: "a2", kind: "reach", target: { u: 0, v: 10 }, radius: 1 },
    ],
  }],
});
anyR.tick(0.1, { getPosition: () => ({ u: 0, v: 10 }) });
ok(anyR.getMission("a").status === "completed", "any_of: second branch done");

// 10. all_of
const allR = M.createRunner();
allR.start({
  id: "all", objectives: [{
    id: "compound", kind: "all_of", sub: [
      { id: "k", kind: "kill", count: 1, matchTag: "x" },
      { id: "c", kind: "collect", count: 2, itemType: "y" },
    ],
  }],
});
let st = { kills: 0, coll: 0 };
const allWorld = { getKillCount: () => st.kills, getCollectCount: () => st.coll };
allR.tick(0.1, allWorld);
ok(allR.getMission("all").status === "active", "0/0");
st.kills = 1;
allR.tick(0.1, allWorld);
ok(allR.getMission("all").status === "active", "1 kill, 0 collect");
st.coll = 2;
allR.tick(0.1, allWorld);
ok(allR.getMission("all").status === "completed", "all done");

// 11. Custom objective
const customR = M.createRunner();
let condMet = false;
customR.start({
  id: "cm", objectives: [{
    id: "x", kind: "custom",
    predicate: () => condMet,
  }],
});
customR.tick(0.1, {});
ok(customR.getMission("cm").status === "active", "active");
condMet = true;
customR.tick(0.1, {});
ok(customR.getMission("cm").status === "completed", "custom met");

// 12. Optional objectives don't fail mission
const optR = M.createRunner();
optR.start({
  id: "opt", objectives: [
    { id: "req", kind: "reach", target: { u: 5, v: 0 }, radius: 1 },
    { id: "bonus", kind: "reach", target: { u: 100, v: 100 }, radius: 1, optional: true },
  ],
});
optR.tick(0.1, { getPosition: () => ({ u: 5, v: 0 }) });
ok(optR.getMission("opt").status === "completed", "required done → mission complete (optional skipped)");

// 13. abort
const abortR = M.createRunner();
abortR.start({ id: "ab", objectives: [{ id: "x", kind: "reach", target: { u: 99, v: 0 }, radius: 1 }] });
ok(abortR.abort("ab").ok === true, "abort ok");
ok(abortR.getMission("ab").status === "aborted", "status aborted");
ok(abortR.abort("ab").ok === false, "double abort fails");
ok(abortR.abort("ghost").ok === false, "ghost abort fails");

// 14. progressOf
const pr = M.createRunner();
pr.start({
  id: "p", objectives: [
    { id: "k", kind: "kill", count: 5, matchTag: "x" },
    { id: "t", kind: "timer", duration: 10000 },
  ],
});
let kn = 0;
pr.tick(2, { getKillCount: () => kn });
const prog = pr.progressOf("p");
ok(prog.objectives.length === 2, "2 obj in progress");
ok(prog.objectives[0].kind === "kill" && prog.objectives[0].progress === 0, "kill progress 0");
ok(prog.objectives[1].kind === "timer" && prog.objectives[1].remainingMs <= 10000, "timer remaining");

// 15. onStart / onComplete callbacks fire
let startedFlag = false, completedFlag = false;
const cbR = M.createRunner();
cbR.start({
  id: "cb",
  objectives: [{ id: "x", kind: "reach", target: { u: 0, v: 0 }, radius: 1 }],
  onStart: () => { startedFlag = true; },
  onComplete: () => { completedFlag = true; },
});
ok(startedFlag, "onStart fired");
cbR.tick(0.1, { getPosition: () => ({ u: 0, v: 0 }) });
ok(completedFlag, "onComplete fired");

// 16. recentEvents
const ev = pr.recentEvents();
ok(ev.length > 0, "events logged");
ok(ev.some(e => e.kind === "start"), "start event");

// 17. Director hooks (mock)
let directorPlayCalls = 0;
const mockDirector = { play: () => { directorPlayCalls++; return { ok: true }; } };
const dirR = M.createRunner({ director: mockDirector });
dirR.start({
  id: "d",
  objectives: [{ id: "x", kind: "reach", target: { u: 0, v: 0 }, radius: 1 }],
  cinematics: { start: "intro_cutscene", end: "outro_cutscene" },
});
ok(directorPlayCalls === 1, "intro cutscene played");
dirR.tick(0.1, { getPosition: () => ({ u: 0, v: 0 }) });
ok(directorPlayCalls === 2, "outro cutscene played");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
