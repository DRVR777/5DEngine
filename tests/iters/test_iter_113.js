// test_iter_113.js — NPC routine: schedule windows, transitions, queries.
const S = require("./npc_routine.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Default activities
ok(S.DEFAULT_ACTIVITIES.includes("sleep"), "sleep");
ok(S.DEFAULT_ACTIVITIES.includes("work"), "work");
ok(S.DEFAULT_ACTIVITIES.includes("eat"), "eat");

// 2. registerNPC + schedule
const sys = S.createSystem();
ok(sys.registerNPC({
  id: "baker",
  schedule: [
    { startHour: 5,  endHour: 13, activity: "work",  location: "bakery" },
    { startHour: 13, endHour: 14, activity: "eat",   location: "tavern" },
    { startHour: 14, endHour: 20, activity: "work",  location: "bakery" },
    { startHour: 20, endHour: 22, activity: "socialize", location: "tavern" },
    { startHour: 22, endHour: 5,  activity: "sleep", location: "home" },
  ],
}).ok, "register baker");

ok(sys.registerNPC({}).ok === false, "missing id");
ok(sys.registerNPC({ id: "baker" }).ok === false, "duplicate");

// 3. currentActivity at various hours
ok(sys.currentActivity("baker", 6).activity === "work", "6am working");
ok(sys.currentActivity("baker", 6).location === "bakery", "at bakery");
ok(sys.currentActivity("baker", 13).activity === "eat", "1pm eating");
ok(sys.currentActivity("baker", 13.5).activity === "eat", "1:30pm still eating");
ok(sys.currentActivity("baker", 14).activity === "work", "2pm working again");

// Wrap-around: sleep 22→5
ok(sys.currentActivity("baker", 23).activity === "sleep", "11pm sleeping");
ok(sys.currentActivity("baker", 0).activity === "sleep", "midnight sleeping");
ok(sys.currentActivity("baker", 3).activity === "sleep", "3am sleeping");
ok(sys.currentActivity("baker", 4.99).activity === "sleep", "4:59am sleeping");

// 4. Hour normalization
ok(sys.currentActivity("baker", 28).activity === "sleep", "hour 28 → 4 → sleep");
ok(sys.currentActivity("baker", -1).activity === "sleep", "hour -1 → 23 → sleep");

// Bad inputs
ok(sys.currentActivity("ghost", 5) === null, "ghost npc");
ok(sys.currentActivity("baker", "noon") === null, "bad hour");

// 5. tick → transitions
const t1 = sys.tick(6);
ok(t1.length === 1 && t1[0].to === "work" && t1[0].from === null, "first tick: transition to work");
const t2 = sys.tick(7);
ok(t2.length === 0, "no transition same activity");
const t3 = sys.tick(13);
ok(t3.length === 1 && t3[0].to === "eat", "transition to eat");
const t4 = sys.tick(14);
ok(t4.length === 1 && t4[0].to === "work", "transition to work");
const t5 = sys.tick(21);   // 21 is inside [20, 22) socialize
ok(t5.length === 1 && t5[0].to === "socialize", "transition to socialize");

// 6. Multiple NPCs
sys.registerNPC({
  id: "guard",
  schedule: [
    { startHour: 6,  endHour: 18, activity: "patrol", location: "gates" },
    { startHour: 18, endHour: 6,  activity: "sleep",  location: "barracks" },
  ],
});

const transAll = sys.tick(7);
ok(transAll.find(t => t.npcId === "guard"), "guard transitioned");

// 7. activityCensus
sys.registerNPC({
  id: "shopper",
  schedule: [{ startHour: 0, endHour: 24, activity: "shop", location: "market" }],
});
const census = sys.activityCensus(10);
ok(census.work === 1, `work=1 (got ${census.work})`);
ok(census.patrol === 1, "patrol=1");
ok(census.shop === 1, "shop=1");

// 8. npcsAtLocation
sys.registerNPC({
  id: "smith",
  schedule: [{ startHour: 6, endHour: 18, activity: "work", location: "bakery" }],
});
const atBakery = sys.npcsAtLocation(10, "bakery");
ok(atBakery.length === 2, "2 NPCs at bakery (baker + smith)");
ok(atBakery.includes("baker"), "baker there");
ok(atBakery.includes("smith"), "smith there");

// 9. setSchedule replaces
sys.setSchedule("smith", [
  { startHour: 0, endHour: 24, activity: "idle", location: "home" },
]);
ok(sys.currentActivity("smith", 10).activity === "idle", "smith now idle");
ok(sys.npcsAtLocation(10, "bakery").length === 1, "smith no longer at bakery");

// 10. Bad activity in schedule filtered
sys.registerNPC({
  id: "filtered",
  schedule: [
    { startHour: 0, endHour: 12, activity: "ghost_activity" },
    { startHour: 12, endHour: 24, activity: "work", location: "x" },
  ],
});
const f = sys.getNPC("filtered");
ok(f.schedule.length === 1, "invalid activity dropped");
ok(sys.currentActivity("filtered", 5) === null, "no coverage");
ok(sys.currentActivity("filtered", 13).activity === "work", "work at 13");

// 11. registerActivity
ok(sys.registerActivity("study").ok, "register study");
sys.registerNPC({
  id: "scholar",
  schedule: [{ startHour: 9, endHour: 17, activity: "study", location: "library" }],
});
ok(sys.currentActivity("scholar", 10).activity === "study", "study works");
ok(sys.registerActivity("").ok === false, "empty rejected");

// 12. unregisterNPC
ok(sys.unregisterNPC("filtered") === true, "unreg ok");
ok(sys.getNPC("filtered") === null, "removed");
ok(sys.unregisterNPC("filtered") === false, "ghost unreg");

// 13. listNPCs
ok(sys.listNPCs().length >= 3, `≥3 NPCs (got ${sys.listNPCs().length})`);

// 14. Empty schedule
sys.registerNPC({ id: "empty" });
ok(sys.currentActivity("empty", 12) === null, "no schedule → null");

// 15. No-coverage windows
sys.registerNPC({
  id: "halfday",
  schedule: [{ startHour: 9, endHour: 17, activity: "work", location: "office" }],
});
ok(sys.currentActivity("halfday", 12).activity === "work", "covered");
ok(sys.currentActivity("halfday", 20) === null, "uncovered → null");

// 16. Same activity, different location → transition
const sys2 = S.createSystem();
sys2.registerNPC({
  id: "wanderer",
  schedule: [
    { startHour: 6,  endHour: 12, activity: "work", location: "A" },
    { startHour: 12, endHour: 18, activity: "work", location: "B" },
  ],
});
sys2.tick(7);
const tw2 = sys2.tick(13);
ok(tw2.length === 1 && tw2[0].to === "work", "location change = transition");

// 17. recentEvents
const ev = sys.recentEvents();
ok(ev.length > 0, "events");
ok(ev.some(e => e.kind === "register_npc"), "register events");
ok(ev.some(e => e.kind === "transition"), "transition events");

// 18. getConfig
ok(sys.getConfig().ticksPerHour > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
