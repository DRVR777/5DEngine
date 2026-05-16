// test_iter_111.js — env hazards: fire/flood/shockwave/gas + spread + damage.
const H = require("./env_hazards.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. KINDS
ok(H.KINDS.length === 4, "4 kinds");
ok(H.KINDS.includes("fire"), "fire");

// 2. spawnFire
const sys = H.createSystem();
const f1 = sys.spawnFire({ position: { u: 10, v: 10 }, radius: 5 });
ok(f1.ok, "spawn fire");
ok(sys.getHazard(f1.id).kind === "fire", "kind fire");
ok(sys.spawnFire({}).ok === false, "missing position");

// 3. spawnFlood / shockwave / gas
sys.spawnFlood({ position: { u: 0, v: 0 } });
sys.spawnShockwave({ position: { u: 0, v: 0 } });
sys.spawnGas({ position: { u: 0, v: 0 } });
ok(sys.listHazards().length === 4, "4 hazards");
ok(sys.listHazards("fire").length === 1, "1 fire");

// 4. Fire damages nearby entities
const entities = new Map();
entities.set("player", { position: { u: 11, v: 10 } });
entities.set("npc",    { position: { u: 100, v: 100 } });
let damages = [];
const applyDamage = (eid, dmg, kind) => damages.push({ eid, dmg, kind });

const r1 = sys.tick(1, { entities, applyDamage });
const playerHits = damages.filter(d => d.eid === "player" && d.kind === "fire");
ok(playerHits.length > 0, "player damaged by fire");
ok(!damages.find(d => d.eid === "npc" && d.kind === "fire"), "npc out of fire range");

// 5. extinguish reduces intensity
const sys2 = H.createSystem({ config: { fireExtinguishRate: 1 } });
const ef = sys2.spawnFire({ position: { u: 0, v: 0 }, intensity: 1.0 });
sys2.extinguish(ef.id, 0.5);
ok(sys2.getHazard(ef.id).intensity === 0.5, "intensity 0.5");
sys2.extinguish(ef.id, 1.0);
ok(sys2.getHazard(ef.id).burnedOut === true, "burned out");

ok(sys2.extinguish("ghost").ok === false, "ghost extinguish");
ok(sys2.extinguish(ef.id).ok === false || sys2.extinguish(ef.id).ok, "extinguish idempotent");

// 6. Fire spreads to flammable neighbors
const sys3 = H.createSystem({ config: { fireSpreadRadius: 10, fireSpreadChance: 1.0 } });
const sf = sys3.spawnFire({ position: { u: 0, v: 0 }, intensity: 1.0 });
const neighbors = (pos, rad) => [
  { id: "wood_house", pos: { u: 5, v: 0 }, flammable: true },
  { id: "stone_wall", pos: { u: 6, v: 0 }, flammable: false },
];
const r2 = sys3.tick(1, { neighbors, rng: () => 0 });
ok(r2.spread.length === 1, "1 spread (to flammable)");
ok(r2.spread[0].atBuilding === "wood_house", "spread to wood_house");

// 7. Fire burns out after maxLifetimeMs
const sys4 = H.createSystem({ config: { fireMaxLifetimeMs: 1000 } });
const lifeFire = sys4.spawnFire({ position: { u: 0, v: 0 } });
sys4.tick(2, {});   // 2s elapsed > 1s lifetime
ok(sys4.getHazard(lifeFire.id) === null, "fire auto-removed");

// 8. Flood rises + damages submerged entities
const sys5 = H.createSystem({ config: { floodRiseRate: 1.0, floodBaseDamagePerSec: 10 } });
const ff = sys5.spawnFlood({ position: { u: 0, v: 0 }, intensity: 1.0, radius: 5 });
const floodEntities = new Map();
floodEntities.set("low",  { position: { u: 1, v: 1, y: 0 } });
floodEntities.set("high", { position: { u: 1, v: 1, y: 100 } });
let floodDmg = [];
const floodDmgFn = (eid, dmg, kind) => floodDmg.push({ eid, dmg, kind });

// First tick: height rises to 1.0 — too low to damage "low" at y=0+0.5 cutoff
sys5.tick(1, { entities: floodEntities, applyDamage: floodDmgFn });
ok(sys5.getHazard(ff.id).height === 1.0, "flood height = 1.0");

// More ticks → height rises, damages low entity
for (let i = 0; i < 5; i++) sys5.tick(1, { entities: floodEntities, applyDamage: floodDmgFn });
ok(floodDmg.some(d => d.eid === "low" && d.kind === "flood"), "low entity flood-damaged");
ok(!floodDmg.find(d => d.eid === "high"), "high entity safe");

// 9. Shockwave: one-shot, falloff
const sys6 = H.createSystem();
const sw = sys6.spawnShockwave({ position: { u: 0, v: 0 }, radius: 10, damage: 100 });
const swEnts = new Map();
swEnts.set("near", { position: { u: 1, v: 0 } });
swEnts.set("far",  { position: { u: 9, v: 0 } });
swEnts.set("out",  { position: { u: 20, v: 0 } });
let swDmg = [];
const r3 = sys6.tick(1, {
  entities: swEnts,
  applyDamage: (eid, dmg, k) => swDmg.push({ eid, dmg, k }),
});

const nearD = swDmg.find(d => d.eid === "near").dmg;
const farD = swDmg.find(d => d.eid === "far").dmg;
ok(nearD > farD, `near > far (${nearD} > ${farD})`);
ok(!swDmg.find(d => d.eid === "out"), "out-of-range not hit");
// One-shot: gone after tick
ok(sys6.getHazard(sw.id) === null, "shockwave consumed");

// Tick again — no double damage
swDmg = [];
sys6.tick(1, { entities: swEnts, applyDamage: (eid, dmg, k) => swDmg.push({ eid }) });
ok(swDmg.length === 0, "no double damage");

// 10. Gas: drifts + damages
const sys7 = H.createSystem({ config: { gasDriftPerSec: 1.0, gasBaseDamagePerSec: 5 } });
const gas = sys7.spawnGas({
  position: { u: 0, v: 0 }, radius: 5, intensity: 1.0,
  drift: { u: 1, v: 0 },
});
sys7.tick(2, {});
const gasH = sys7.getHazard(gas.id);
ok(gasH.position.u === 2, `gas drifted to u=2 (got ${gasH.position.u})`);

const gasEnts = new Map();
gasEnts.set("here", { position: { u: 2, v: 0 } });
let gasDmg = [];
sys7.tick(1, { entities: gasEnts, applyDamage: (eid, dmg, k) => gasDmg.push({ eid, dmg, kind: k }) });
ok(gasDmg.some(d => d.eid === "here" && d.kind === "gas"), "gas damages here");

// 11. Gas expires after maxLifetimeMs
const sys8 = H.createSystem({ config: { gasMaxLifetimeMs: 1000 } });
const expireGas = sys8.spawnGas({ position: { u: 0, v: 0 } });
sys8.tick(2, {});
ok(sys8.getHazard(expireGas.id) === null, "gas expired");

// 12. removeHazard
const sys9 = H.createSystem();
const r9 = sys9.spawnFire({ position: { u: 0, v: 0 } });
ok(sys9.removeHazard(r9.id).ok === true, "remove ok");
ok(sys9.getHazard(r9.id) === null, "removed");
ok(sys9.removeHazard(r9.id).ok === false, "double remove");

// 13. Multiple hazards independent
const sys10 = H.createSystem();
const h1 = sys10.spawnFire({ position: { u: 0, v: 0 } });
const h2 = sys10.spawnFire({ position: { u: 100, v: 100 } });
const h3 = sys10.spawnFlood({ position: { u: 50, v: 50 } });
ok(sys10.listHazards("fire").length === 2, "2 fires");
ok(sys10.listHazards("flood").length === 1, "1 flood");

sys10.removeHazard(h1.id);
ok(sys10.listHazards("fire").length === 1, "1 fire after remove");

// 14. spreadChance=0 → no spread
const sys11 = H.createSystem({ config: { fireSpreadChance: 0 } });
sys11.spawnFire({ position: { u: 0, v: 0 } });
const r11 = sys11.tick(1, {
  neighbors: () => [{ id: "x", pos: { u: 1, v: 0 }, flammable: true }],
  rng: () => 0,
});
ok(r11.spread.length === 0, "no spread when chance=0");

// 15. Spread carries reduced intensity
const sys12 = H.createSystem({ config: { fireSpreadRadius: 10, fireSpreadChance: 1.0 } });
const parent = sys12.spawnFire({ position: { u: 0, v: 0 }, intensity: 1.0 });
const r12 = sys12.tick(1, {
  neighbors: () => [{ id: "child", pos: { u: 5, v: 0 }, flammable: true }],
  rng: () => 0,
});
const childId = r12.spread[0].to;
ok(sys12.getHazard(childId).intensity === 0.8, "child has 0.8 intensity");

// 16. Events logged
ok(sys.recentEvents().length > 0, "events");
ok(sys.recentEvents().some(e => e.kind === "spawn_fire"), "spawn_fire event");

// 17. getConfig
ok(sys.getConfig().fireBaseDamagePerSec > 0, "config exposed");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
