// test_iter_62.js — NPC daily schedules.
const NS = require("./npc_schedule.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Activities + templates
ok(NS.ACTIVITIES.length === 7, "7 activity types");
ok(NS.listTemplates().length >= 3, ">= 3 built-in templates");
ok(NS.getTemplate("office_worker") !== null, "office_worker template");
ok(NS.getTemplate("shopkeeper") !== null, "shopkeeper template");
ok(NS.getTemplate("night_guard") !== null, "night_guard template");
ok(NS.getTemplate("ghost") === null, "unknown template → null");

// 2. validateSchedule rejects bad inputs
ok(NS.validateSchedule([]).ok === false, "empty schedule rejected");
ok(NS.validateSchedule([{ startHour: 10, endHour: 5, activity: "work" }]).ok === false,
   "start >= end rejected");
ok(NS.validateSchedule([{ startHour: -1, endHour: 5, activity: "work" }]).ok === false,
   "negative hour rejected");
ok(NS.validateSchedule([{ startHour: 0, endHour: 25, activity: "work" }]).ok === false,
   "hour > 24 rejected");
ok(NS.validateSchedule([{ startHour: 0, endHour: 5, activity: "vibe" }]).ok === false,
   "unknown activity rejected");

// Overlap
ok(NS.validateSchedule([
  { startHour: 0, endHour: 10, activity: "work" },
  { startHour: 5, endHour: 15, activity: "eat" },
]).ok === false, "overlapping slots rejected");

// Doesn't reach 24h
ok(NS.validateSchedule([
  { startHour: 0, endHour: 12, activity: "work" },
]).ok === false, "incomplete day rejected");

// Valid
ok(NS.validateSchedule(NS.getTemplate("office_worker")).ok === true,
   "office_worker template valid");

// 3. activityAt — boundary handling
const sched = NS.getTemplate("office_worker");
ok(NS.activityAt(sched, 0).activity === "sleep", "midnight = sleep");
ok(NS.activityAt(sched, 9).activity === "work", "9am = work");
ok(NS.activityAt(sched, 12).activity === "eat", "noon = eat (12 in [12,13))");
ok(NS.activityAt(sched, 12.99).activity === "eat", "12:59 still eat");
ok(NS.activityAt(sched, 13).activity === "work", "1pm = back to work");
ok(NS.activityAt(sched, 22.5).activity === "sleep", "10:30pm = sleep");

// 4. makeNPC clones template
const alice = NS.makeNPC({ id: "alice", template: "office_worker", home: "home_a", locations: {
  home: { u: 0, v: 0 },
  office: { u: 100, v: 0 },
  diner: { u: 50, v: 30 },
}});
ok(alice.id === "alice", "id set");
ok(alice.schedule.length === 9, "schedule cloned");
ok(alice.schedule !== NS.getTemplate("office_worker"), "schedule is a clone");
// Mutate alice's schedule and check template untouched
alice.schedule[0].activity = "eat";
ok(NS.getTemplate("office_worker")[0].activity === "sleep", "template unaffected");

// Bad template
let threw = false;
try { NS.makeNPC({ id: "x", template: "ghost" }); } catch (e) { threw = true; }
ok(threw, "unknown template throws");

// 5. tick updates currentActivity + reports change
const bob = NS.makeNPC({ id: "bob", template: "office_worker", locations: {
  home: { u: 0, v: 0 }, office: { u: 100, v: 0 }, diner: { u: 50, v: 30 },
}});
const r1 = NS.tick(bob, 8.5);  // travel 8-9
ok(r1.changed === true, "first tick is a change");
ok(r1.current.activity === "travel", "8:30am = travel");
ok(r1.locationCoord.u === 100, "travel destination = office at u=100");

const r2 = NS.tick(bob, 8.7);  // still travel
ok(r2.changed === false, "same activity → no change");

const r3 = NS.tick(bob, 9.5);  // now work
ok(r3.changed === true, "activity transition");
ok(r3.current.activity === "work", "9:30am = work");

// 6. registerTemplate validates + extends
NS.registerTemplate("baker", [
  { startHour: 0,  endHour: 4,  activity: "sleep",   location: "home" },
  { startHour: 4,  endHour: 5,  activity: "travel",  location: "bakery" },
  { startHour: 5,  endHour: 12, activity: "work",    location: "bakery" },
  { startHour: 12, endHour: 13, activity: "travel",  location: "home" },
  { startHour: 13, endHour: 24, activity: "leisure", location: "home" },
]);
ok(NS.getTemplate("baker") !== null, "baker registered");
ok(NS.makeNPC({ id: "b", template: "baker" }).schedule.length === 5, "baker schedule built");

threw = false;
try { NS.registerTemplate("baker", []); } catch (e) { threw = true; }
ok(threw, "duplicate template throws");

threw = false;
try { NS.registerTemplate("invalid", [{ startHour: 0, endHour: 12, activity: "work" }]); } catch (e) { threw = true; }
ok(threw, "invalid template throws");

// 7. Custom schedule via makeNPC (no template)
const custom = NS.makeNPC({
  id: "cust",
  schedule: [
    { startHour: 0,  endHour: 8,  activity: "sleep",   location: "home" },
    { startHour: 8,  endHour: 24, activity: "leisure", location: "park" },
  ],
});
const r4 = NS.tick(custom, 14);
ok(r4.current.activity === "leisure", "custom schedule works");

// 8. Schedule with no matching slot → null
const partial = NS.makeNPC({
  id: "p",
  schedule: [{ startHour: 8, endHour: 20, activity: "work", location: "x" }],
});
ok(NS.tick(partial, 22).current === null, "outside-schedule hour returns null");

// 9. hourFromPhase
ok(NS.hourFromPhase(0) === 0, "phase 0 = hour 0");
ok(NS.hourFromPhase(0.5) === 12, "phase 0.5 = noon");
ok(Math.abs(NS.hourFromPhase(0.25) - 6) < 1e-9, "phase 0.25 = 6am");
ok(NS.hourFromPhase(1.5) === 12, "phase wraps");
ok(NS.hourFromPhase(-0.25) === 18, "negative phase wraps");

// 10. Sleep majority for night_guard
const guard = NS.getTemplate("night_guard");
let sleepHours = 0;
for (let h = 0; h < 24; h += 0.5) {
  const s = NS.activityAt(guard, h);
  if (s && s.activity === "sleep") sleepHours += 0.5;
}
ok(sleepHours === 8, `night_guard sleeps 8h during day (got ${sleepHours}h)`);

let patrolHours = 0;
for (let h = 0; h < 24; h += 0.5) {
  const s = NS.activityAt(guard, h);
  if (s && s.activity === "patrol") patrolHours += 0.5;
}
ok(patrolHours === 7, `night_guard patrols 7h at night (got ${patrolHours}h)`);

// 11. tick changed flag tracks both activity + location independently
const c2 = NS.makeNPC({
  id: "c2",
  schedule: [
    { startHour: 0,  endHour: 8,  activity: "leisure", location: "loc_a" },
    { startHour: 8,  endHour: 16, activity: "leisure", location: "loc_b" },
    { startHour: 16, endHour: 24, activity: "leisure", location: "loc_c" },
  ],
});
NS.tick(c2, 4);   // initial
const cr = NS.tick(c2, 9);
ok(cr.changed === true, "same activity, different location → changed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
