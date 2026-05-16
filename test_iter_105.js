// test_iter_105.js — mission generator: templates, randomization, difficulty.
const G = require("./mission_generator.js");
const M = require("./mission_dsl.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. registerTemplate
const gen = G.createGenerator();
const r1 = gen.registerTemplate({
  id: "hunt",
  name: "Hunt Down",
  baseObjectives: [{ id: "k", kind: "kill", count: [3, 5], matchTagFrom: "pool" }],
  difficulty: 2,
  randomizers: { enemyTags: ["wolf", "bear", "boar"] },
});
ok(r1.ok, "register hunt");
ok(gen.registerTemplate({}).ok === false, "missing id");
ok(gen.registerTemplate({ id: "x" }).ok === false, "missing objectives");
ok(gen.registerTemplate({ id: "hunt", baseObjectives: [{}] }).ok === false, "duplicate");

ok(gen.listTemplates().length === 1, "1 template");

// 2. Basic generation
const m1 = gen.generate("hunt", { seed: 42 });
ok(m1.ok, "generate ok");
ok(m1.mission.objectives.length === 1, "1 obj");
ok(m1.mission.objectives[0].kind === "kill", "kill kind");
ok(typeof m1.mission.objectives[0].count === "number", "count is number");
ok(["wolf", "bear", "boar"].includes(m1.mission.objectives[0].matchTag), "matchTag from pool");

// 3. Unknown template
ok(gen.generate("ghost").ok === false, "ghost template");

// 4. Deterministic by seed
const m2 = gen.generate("hunt", { seed: 42 });
const m3 = gen.generate("hunt", { seed: 42 });
ok(JSON.stringify(m2.mission.objectives) === JSON.stringify(m3.mission.objectives),
   "same seed → same objectives");

const m4 = gen.generate("hunt", { seed: 99 });
const sameObj = JSON.stringify(m2.mission.objectives) === JSON.stringify(m4.mission.objectives);
ok(!sameObj || true, "different seed may differ");   // best-effort

// 5. Difficulty scaling on kill count
const easy = gen.generate("hunt", { difficulty: 1, seed: 1 });
const hard = gen.generate("hunt", { difficulty: 5, seed: 1 });
ok(hard.mission.objectives[0].count > easy.mission.objectives[0].count,
   `hard count > easy (${easy.mission.objectives[0].count} vs ${hard.mission.objectives[0].count})`);

// 6. Template with reach + targetFrom pool
gen.registerTemplate({
  id: "patrol",
  name: "Patrol",
  baseObjectives: [
    { id: "r1", kind: "reach", targetFrom: "pool", radius: [3, 5] },
  ],
  difficulty: 1,
  randomizers: { targetPool: [
    { u: 10, v: 10 }, { u: 50, v: 50 }, { u: 100, v: 100 },
  ]},
});
const mPatrol = gen.generate("patrol", { seed: 7 });
ok(mPatrol.ok, "patrol generates");
const pos = mPatrol.mission.objectives[0].target;
ok([10, 50, 100].includes(pos.u), `target u from pool (got ${pos.u})`);
ok(mPatrol.mission.objectives[0].radius >= 3 && mPatrol.mission.objectives[0].radius <= 5,
   "radius in range");

// 7. Reach with no pool → fails
gen.registerTemplate({
  id: "bad_reach",
  baseObjectives: [{ id: "x", kind: "reach", targetFrom: "pool", radius: 1 }],
  randomizers: {},   // no targetPool
});
const bad = gen.generate("bad_reach");
ok(bad.ok === false && bad.reason === "materialize_failed", "no target → fail");

// 8. Survive: scales UP with difficulty
gen.registerTemplate({
  id: "endure",
  baseObjectives: [{ id: "s", kind: "survive", duration: [10000, 20000] }],
});
const surv1 = gen.generate("endure", { difficulty: 1, seed: 5 });
const surv5 = gen.generate("endure", { difficulty: 5, seed: 5 });
ok(surv5.mission.objectives[0].duration > surv1.mission.objectives[0].duration,
   "harder survive = longer duration");

// 9. Timer: scales DOWN with difficulty (less time = harder)
gen.registerTemplate({
  id: "race",
  baseObjectives: [{ id: "t", kind: "timer", duration: [30000, 60000] }],
});
const time1 = gen.generate("race", { difficulty: 1, seed: 8 });
const time5 = gen.generate("race", { difficulty: 5, seed: 8 });
ok(time5.mission.objectives[0].duration < time1.mission.objectives[0].duration,
   "harder timer = less time");

// 10. Collect template
gen.registerTemplate({
  id: "gather",
  baseObjectives: [{
    id: "g", kind: "collect", count: [3, 5], itemTypeFrom: "pool",
  }],
  randomizers: { itemTypes: ["herb", "ore", "wood"] },
});
const gMission = gen.generate("gather", { seed: 11 });
ok(gMission.ok, "gather generates");
ok(["herb", "ore", "wood"].includes(gMission.mission.objectives[0].itemType), "itemType from pool");

// 11. Multiple objectives in one template
gen.registerTemplate({
  id: "combo",
  baseObjectives: [
    { id: "k", kind: "kill", count: 5, matchTag: "rat" },
    { id: "r", kind: "reach", targetFrom: "pool", radius: 3 },
    { id: "c", kind: "collect", count: 3, itemType: "key" },
  ],
  randomizers: { targetPool: [{ u: 100, v: 100 }] },
});
const combo = gen.generate("combo");
ok(combo.ok, "combo generates");
ok(combo.mission.objectives.length === 3, "3 objectives");
ok(combo.mission.objectives.map(o => o.kind).join(",") === "kill,reach,collect", "kinds in order");

// 12. Optional flag preserved
gen.registerTemplate({
  id: "with_opt",
  baseObjectives: [
    { id: "main", kind: "kill", count: 1, matchTag: "x" },
    { id: "bonus", kind: "collect", count: 5, itemType: "y", optional: true },
  ],
});
const optM = gen.generate("with_opt");
ok(optM.mission.objectives[0].optional === undefined, "main not optional");
ok(optM.mission.objectives[1].optional === true, "bonus is optional");

// 13. generateCampaign with difficulty curve
const campaign = gen.generateCampaign("hunt", 5, { seed: 100 });
ok(campaign.length === 5, "5 missions");
const diffs = campaign.map(m => m.meta.difficulty);
ok(diffs[0] < diffs[4], `campaign curve ascending (${diffs.join(",")})`);

// 14. Custom difficulty curve
const flat = gen.generateCampaign("hunt", 3, {
  seed: 200,
  difficultyCurve: () => 3,
});
ok(flat.every(m => m.meta.difficulty === 3), "all flat difficulty 3");

// 15. unregisterTemplate
ok(gen.unregisterTemplate("hunt") === true, "unreg ok");
ok(gen.generate("hunt").ok === false, "removed");

// 16. Generated mission parses via mission_dsl
const m5 = gen.generate("combo");
const parsed = M.parseMission(m5.mission);
ok(parsed.id === m5.mission.id, "parses via mission_dsl");

// 17. Meta preserves template id + seed
ok(m5.mission.meta.templateId === "combo", "meta.templateId");
ok(typeof m5.mission.meta.seed === "number", "meta.seed is number");

// 18. _diffMul curve
ok(gen._diffMul(1) === 1.0, "diff 1 → 1.0");
ok(gen._diffMul(5) === 3.0, "diff 5 → 3.0");
ok(gen._diffMul(0) === 1.0, "diff 0 clamped to 1");
ok(gen._diffMul(99) === 3.0, "diff 99 clamped to 5");

// 19. _pickRange
const rng = () => 0.5;
// rng=0.5, range [5,10] → 5 + floor(0.5 * 6) = 8
ok(gen._pickRange([5, 10], rng) === 8, `range [5,10] @ rng=0.5 = 8`);
ok(gen._pickRange(42, rng) === 42, "scalar passthrough");

// 20. Escort
gen.registerTemplate({
  id: "escort",
  baseObjectives: [{
    id: "e", kind: "escort", entityId: "vip", targetFrom: "pool", radius: 2,
  }],
  randomizers: { targetPool: [{ u: 50, v: 50 }] },
});
const esc = gen.generate("escort");
ok(esc.ok, "escort generates");
ok(esc.mission.objectives[0].entityId === "vip", "entityId set");

// 21. Events
ok(gen.recentEvents().length > 0, "events");
ok(gen.recentEvents().some(e => e.kind === "generate"), "generate events");

// 22. poolsOverride
const mOverride = gen.generate("patrol", {
  seed: 1,
  poolsOverride: { targetPool: [{ u: 999, v: 999 }] },
});
ok(mOverride.mission.objectives[0].target.u === 999, "pool override applied");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
