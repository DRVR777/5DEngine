// test_iter_55.js — quests: define, start, ingest events, complete + chain.
const Q = require("./quests.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const sys = Q.createQuestSystem();

// 1. Built-in objective kinds
ok(typeof Q.OBJECTIVE_KINDS.kill === "function", "kill kind");
ok(typeof Q.OBJECTIVE_KINDS.collect === "function", "collect kind");
ok(typeof Q.OBJECTIVE_KINDS.reach === "function", "reach kind");
ok(typeof Q.OBJECTIVE_KINDS.talk === "function", "talk kind");
ok(typeof Q.OBJECTIVE_KINDS.timer === "function", "timer kind");

// 2. defineQuest validates
let threw = false;
try { sys.defineQuest({}); } catch (e) { threw = true; }
ok(threw, "missing id throws");
threw = false;
try { sys.defineQuest({ id: "x" }); } catch (e) { threw = true; }
ok(threw, "missing objectives throws");
threw = false;
try { sys.defineQuest({ id: "x", objectives: [] }); } catch (e) { threw = true; }
ok(threw, "empty objectives throws");

// Define some real quests
sys.defineQuest({
  id: "hunt_goblins",
  name: "Goblin Hunt",
  objectives: [
    { kind: "kill", target: { entityType: "goblin" }, qty: 3 },
  ],
  rewards: [{ type: "coin", qty: 50 }],
});
sys.defineQuest({
  id: "fetch_quest",
  name: "Bring back herbs",
  objectives: [
    { kind: "collect", target: { itemType: "herb" }, qty: 5 },
    { kind: "talk", target: { npcId: "elder" } },
  ],
  rewards: [{ type: "coin", qty: 100 }, { type: "medkit", qty: 1 }],
  next: "hunt_goblins",
});

ok(sys.activeQuests().length === 0, "no active quests initially");

// 3. startQuest
const s1 = sys.startQuest("fetch_quest");
ok(s1.ok === true, "start fetch_quest");
ok(sys.activeQuests().length === 1, "1 active");
const s2 = sys.startQuest("fetch_quest");
ok(s2.ok === false && s2.reason === "already_active", "duplicate start rejected");
ok(sys.startQuest("ghost").ok === false, "missing quest rejected");

// 4. ingestEvent updates progress
let progressEvents = 0, completeEvents = 0;
sys.on("progress", () => progressEvents++);
sys.on("complete", () => completeEvents++);

sys.ingestEvent({ type: "collect", itemType: "herb", qty: 2 });
const p1 = sys.getProgress("fetch_quest");
ok(p1[0].current === 2, "collect 2 herbs → progress 2/5");
ok(p1[0].done === false, "not done at 2/5");
ok(progressEvents === 1, "progress event fired");

// Wrong item type
sys.ingestEvent({ type: "collect", itemType: "wood", qty: 99 });
const p2 = sys.getProgress("fetch_quest");
ok(p2[0].current === 2, "wrong item type ignored");

// More herbs
sys.ingestEvent({ type: "collect", itemType: "herb", qty: 3 });
const p3 = sys.getProgress("fetch_quest");
ok(p3[0].current === 5, "now at 5/5");
ok(p3[0].done === true, "first objective done");
ok(p3[1].done === false, "talk objective still open");
ok(completeEvents === 0, "quest not yet complete (talk pending)");

// Talk to wrong NPC
sys.ingestEvent({ type: "talk", npcId: "stranger" });
ok(sys.getProgress("fetch_quest")[1].done === false, "wrong NPC ignored");

// Talk to elder → complete
let lastComplete = null;
sys.on("complete", e => { lastComplete = e; });
sys.ingestEvent({ type: "talk", npcId: "elder" });
ok(completeEvents === 1, "complete event fired");
ok(lastComplete && lastComplete.rewards.length === 2, "rewards in event");
ok(sys.isComplete("fetch_quest") === true, "fetch_quest complete");

// Chain auto-started hunt_goblins
ok(sys.activeQuests().some(q => q.id === "hunt_goblins"), "next quest auto-started");

// 5. Kill quest progress
sys.ingestEvent({ type: "kill", entityType: "goblin" });
sys.ingestEvent({ type: "kill", entityType: "goblin" });
sys.ingestEvent({ type: "kill", entityType: "boss" });
const p4 = sys.getProgress("hunt_goblins");
ok(p4[0].current === 2, "2 goblin kills counted, boss kill ignored");

sys.ingestEvent({ type: "kill", entityType: "goblin" });
ok(sys.isComplete("hunt_goblins"), "goblin hunt complete after 3rd kill");

// 6. Reach objective
sys.defineQuest({
  id: "reach_lighthouse",
  name: "Visit the lighthouse",
  objectives: [{ kind: "reach", target: { u: 100, v: 100, radius: 5 } }],
  rewards: [],
});
sys.startQuest("reach_lighthouse");

sys.ingestEvent({ type: "position", u: 50, v: 50 });
ok(!sys.isComplete("reach_lighthouse"), "outside radius → not done");
sys.ingestEvent({ type: "position", u: 102, v: 99 });
ok(sys.isComplete("reach_lighthouse"), "inside radius → done");

// 7. Repeatable quests
sys.defineQuest({
  id: "daily_chore",
  name: "Daily Chore",
  objectives: [{ kind: "kill", target: {}, qty: 1 }],
  rewards: [{ type: "coin", qty: 5 }],
  repeatable: true,
});
sys.startQuest("daily_chore");
sys.ingestEvent({ type: "kill", entityType: "anything" });
ok(sys.isComplete("daily_chore"), "daily_chore done first time");
const restart = sys.startQuest("daily_chore");
ok(restart.ok === true, "repeatable quest can restart");
ok(!sys.isComplete("daily_chore"), "completed flag cleared on repeat-start");

// 8. abandonQuest
sys.startQuest("daily_chore");  // wait — already active above? Actually restart did start it.
// Reset by abandoning
const ab1 = sys.abandonQuest("daily_chore");
ok(ab1 === true, "abandon active quest");
ok(sys.activeQuests().filter(q => q.id === "daily_chore").length === 0, "removed from active");
const ab2 = sys.abandonQuest("ghost");
ok(ab2 === false, "abandon nonexistent → false");

// 9. registerObjectiveKind extends
sys.registerObjectiveKind("survive", (obj, evt) => {
  if (evt.type !== "elapsed_time") return 0;
  return evt.seconds || 1;
});
sys.defineQuest({
  id: "survive_5min",
  objectives: [{ kind: "survive", target: {}, qty: 300 }],
  rewards: [],
});
sys.startQuest("survive_5min");
sys.ingestEvent({ type: "elapsed_time", seconds: 200 });
ok(sys.getProgress("survive_5min")[0].current === 200, "custom kind tracks");
sys.ingestEvent({ type: "elapsed_time", seconds: 200 });
ok(sys.isComplete("survive_5min"), "survive complete after 400s");

threw = false;
try { sys.registerObjectiveKind("kill", () => {}); } catch (e) { threw = true; }
ok(threw, "duplicate kind throws");

// 10. Listener exception isolated
sys.on("complete", () => { throw new Error("boom"); });
let safe = false;
sys.on("complete", () => { safe = true; });
sys.defineQuest({ id: "trivial", objectives: [{ kind: "kill", target: {}, qty: 1 }], rewards: [] });
sys.startQuest("trivial");
sys.ingestEvent({ type: "kill" });
ok(safe === true, "listener exception doesn't break later listeners");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
