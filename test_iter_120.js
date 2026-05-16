// test_iter_120.js — farming: plant/water/harvest + seasons + wilt + skill.
const F = require("./farming.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

function mkInv() {
  const owned = new Map();
  const k = (p, i) => p + "::" + i;
  return {
    give: (p, i, q) => owned.set(k(p,i), (owned.get(k(p,i)) || 0) + q),
    own: (p, i) => owned.get(k(p,i)) || 0,
  };
}

// 1. Seasons + phases
ok(F.SEASONS.length === 4, "4 seasons");
ok(F.PHASES.includes("harvestable"), "harvestable phase");

// 2. createPlot
const sys = F.createSystem();
const p1 = sys.createPlot({ ownerId: "alice", location: "farm_1" });
ok(p1.ok && p1.plotId === "plot_1", "plot created");
ok(sys.createPlot({}).ok === false, "missing owner");

// 3. plant validation
ok(sys.plant(p1.plotId, "alice", "ghost", { now: 0 }).ok === false, "ghost crop");
ok(sys.plant("ghost", "alice", "wheat").ok === false, "ghost plot");
ok(sys.plant(p1.plotId, "intruder", "wheat").ok === false, "not owner");

const pl1 = sys.plant(p1.plotId, "alice", "wheat", { now: 0 });
ok(pl1.ok === true, "planted wheat");
ok(sys.getPlot(p1.plotId).phase === "planted", "phase planted");

// 4. Re-plant on occupied rejected
ok(sys.plant(p1.plotId, "alice", "carrot", { now: 100 }).ok === false, "occupied");

// 5. tickPlot — phases progress
// wheat growMs=60000, summer prefers it (mul 1.5)
sys.setSeasonStart(0);
// At now=0, season=spring → growth normal mul=1
sys.tickPlot(p1.plotId, 5000);   // progress = 5000/60000 = 0.08 → planted
ok(sys.getPlot(p1.plotId).phase === "planted", "still planted at 5s");

sys.tickPlot(p1.plotId, 15000);   // 0.25 → sprout
ok(sys.getPlot(p1.plotId).phase === "sprout", "sprout at 15s");

sys.tickPlot(p1.plotId, 35000);   // 0.58 → growing
ok(sys.getPlot(p1.plotId).phase === "growing", "growing at 35s");

// Without watering, by 35s wheat missed >1 waterings (waterEveryMs=20000)
ok(sys.getPlot(p1.plotId).missedWaterings >= 1, "missed water");

// Water it
sys.water(p1.plotId, "alice", { now: 35000 });
ok(sys.getPlot(p1.plotId).missedWaterings === 0, `water reset (got ${sys.getPlot(p1.plotId).missedWaterings})`);

// 6. Progress to harvestable
sys.tickPlot(p1.plotId, 55000);   // 0.92 → mature
ok(sys.getPlot(p1.plotId).phase === "mature", "mature at 55s");

sys.tickPlot(p1.plotId, 70000);   // > 1 → harvestable
ok(sys.getPlot(p1.plotId).phase === "harvestable", "harvestable at 70s");

// 7. Harvest
const inv = mkInv();
sys.water(p1.plotId, "alice", { now: 70000 });   // reset water to prevent wilt
const h1 = sys.harvest(p1.plotId, "alice", { now: 70000, inventory: inv, rng: () => 0.5 });
ok(h1.ok === true, "harvested");
ok(h1.yieldItem === "wheat_grain", "wheat_grain");
ok(h1.qty >= 1, "got some yield");
ok(inv.own("alice", "wheat_grain") === h1.qty, "in inventory");
ok(sys.getPlot(p1.plotId).phase === "empty", "plot empty");

// Can't harvest empty
ok(sys.harvest(p1.plotId, "alice").ok === false, "empty harvest");

// 8. Wilt from missed waterings
const sys2 = F.createSystem({ config: { missedWaterToWilt: 2 } });
const p2 = sys2.createPlot({ ownerId: "p" });
sys2.plant(p2.plotId, "p", "wheat", { now: 0 });
sys2.tickPlot(p2.plotId, 100000);   // way past water+grow windows
ok(sys2.getPlot(p2.plotId).phase === "wilted", "wilted from neglect");

// Wilted plot can't be watered
ok(sys2.water(p2.plotId, "p").ok === false, "no water for wilted");

// 9. Clear wilted, replant
ok(sys2.clearPlot(p2.plotId, "p").ok === true, "cleared");
ok(sys2.getPlot(p2.plotId).phase === "empty", "back to empty");
ok(sys2.plant(p2.plotId, "p", "carrot", { now: 200000 }).ok === true, "replant ok");

// 10. Wilt from forbidden season (winter for wheat)
const sys3 = F.createSystem();
sys3.setSeasonStart(0);
// Season duration default 1 week. winter is index 3 (after spring, summer, autumn)
// Tick at 3 weeks
const winterTs = 3 * 7 * 24 * 60 * 60 * 1000 + 1;
sys3.createPlot({ id: "w", ownerId: "p" });
sys3.plant("w", "p", "wheat", { now: winterTs });
sys3.tickPlot("w", winterTs + 1000);
ok(sys3.getPlot("w").phase === "wilted", "wheat wilted in winter");

// 11. Skill XP per harvest
const sys4 = F.createSystem({ config: { xpPerLevel: 50, xpPerHarvest: 30, missedWaterToWilt: 99 } });
sys4.createPlot({ id: "s", ownerId: "p" });
sys4.plant("s", "p", "carrot", { now: 0 });
// carrot growMs 45000
sys4.tickPlot("s", 50000);
ok(sys4.getPlot("s").phase === "harvestable", "carrot harvestable");
sys4.harvest("s", "p", { now: 50000, rng: () => 0.5 });
ok(sys4.getXP("p") === 30, "xp 30");
sys4.createPlot({ id: "s2", ownerId: "p" });
sys4.plant("s2", "p", "carrot", { now: 100000 });
sys4.tickPlot("s2", 150000);
sys4.harvest("s2", "p", { now: 150000, rng: () => 0.5 });
ok(sys4.getLevel("p") === 2, "level 2 after 60xp");

// 12. registerCrop
ok(sys.registerCrop({ id: "tomato", growMs: 30000, yieldItem: "tomato_fruit" }).ok, "register tomato");
ok(sys.registerCrop({ id: "tomato", growMs: 1 }).ok === false, "duplicate");
ok(sys.registerCrop({}).ok === false, "missing id");

// 13. listPlots + listCrops
sys.createPlot({ ownerId: "alice" });
sys.createPlot({ ownerId: "bob" });
ok(sys.listPlots("alice").length >= 1, "alice plots");
ok(sys.listPlots("bob").length === 1, "bob 1 plot");
ok(sys.listCrops().length >= 4, "crops listed");

// 14. destroyPlot
const tmp = sys.createPlot({ ownerId: "x" });
ok(sys.destroyPlot(tmp.plotId, "x").ok === true, "destroy");
ok(sys.getPlot(tmp.plotId) === null, "removed");
ok(sys.destroyPlot(tmp.plotId, "x").ok === false, "double destroy");

// 15. Season cycle
const sys5 = F.createSystem();
sys5.setSeasonStart(0);
ok(sys5.currentSeason(0) === "spring", "spring at 0");
const weekMs = 7 * 24 * 60 * 60 * 1000;
ok(sys5.currentSeason(weekMs) === "summer", "summer +1wk");
ok(sys5.currentSeason(2 * weekMs) === "autumn", "autumn +2wk");
ok(sys5.currentSeason(3 * weekMs) === "winter", "winter +3wk");
ok(sys5.currentSeason(4 * weekMs) === "spring", "wraps to spring");

// 16. tickAll
const sys6 = F.createSystem({ config: { missedWaterToWilt: 99 } });
for (let i = 0; i < 3; i++) {
  sys6.createPlot({ id: "p" + i, ownerId: "u" });
  sys6.plant("p" + i, "u", "carrot", { now: 0 });
}
const all = sys6.tickAll(50000);
ok(all.length === 3, "3 ticked");

// 17. Preferred season boost on yield
const sys7 = F.createSystem({ config: { missedWaterToWilt: 99, yieldVariance: 0 } });
sys7.setSeasonStart(0);
// Plant wheat in summer (1 week in)
const summerTs = 7 * 24 * 60 * 60 * 1000;
sys7.createPlot({ id: "summer", ownerId: "p" });
sys7.plant("summer", "p", "wheat", { now: summerTs });
sys7.tickPlot("summer", summerTs + 100000);
const hSum = sys7.harvest("summer", "p", { now: summerTs + 100000, rng: () => 0.5 });
ok(hSum.qty > 5, `summer wheat yield boosted (got ${hSum.qty})`);

// 18. recentEvents
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "planted"), "planted event");

// 19. getConfig
ok(sys.getConfig().seasonDurationMs > 0, "config");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
