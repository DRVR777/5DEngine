// test_iter_68.js — weather damage: lightning, flood, hail.
const WD = require("./weather_damage.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const sys = WD.createDamageSystem();

// 1. Lightning only fires in storm
ok(sys.rollLightning("clear", 1, { u0: -50, u1: 50, v0: -50, v1: 50 }, () => 0.001).struck === false,
   "clear → no lightning");
ok(sys.rollLightning("snow", 1, { u0: -50, u1: 50, v0: -50, v1: 50 }, () => 0.001).struck === false,
   "snow → no lightning");

// 2. Storm with very low rng → strike fires
const s1 = sys.rollLightning("storm", 1, { u0: -50, u1: 50, v0: -50, v1: 50 }, () => 0.001);
ok(s1.struck === true, "storm + low rng → strike");
ok(typeof s1.pos.u === "number", "pos.u set");
ok(s1.damage === 80, "damage = 80");

// rng above threshold → no strike
const s2 = sys.rollLightning("storm", 1, { u0: -50, u1: 50, v0: -50, v1: 50 }, () => 0.99);
ok(s2.struck === false, "high rng → no strike");

// 3. Intensity scales chance: rolling with rng = exactly base chance × 0.5
// At intensity 0.5, threshold = 0.05 * 0.5 = 0.025. rng=0.020 → struck. rng=0.030 → no.
const s3 = sys.rollLightning("storm", 0.5, { u0: 0, u1: 1, v0: 0, v1: 1 }, () => 0.020);
ok(s3.struck === true, "intensity 0.5 + rng 0.02 → strike");
const s4 = sys.rollLightning("storm", 0.5, { u0: 0, u1: 1, v0: 0, v1: 1 }, () => 0.030);
ok(s4.struck === false, "intensity 0.5 + rng 0.03 → no");

// 4. Apply lightning to entities
const entities = new Map();
function makeEntity(id, pos, health, hitboxH) {
  const e = {
    position: pos,
    health: { current: health, max: health, dead: false },
    hitbox: hitboxH != null ? { w: 1, d: 1, h: hitboxH } : null,
  };
  entities.set(id, e);
  return e;
}
const ent1 = makeEntity("a", { u: 0, v: 0, y: 0 }, 100);
const ent2 = makeEntity("b", { u: 4, v: 0, y: 0 }, 100);
const ent3 = makeEntity("c", { u: 20, v: 0, y: 0 }, 100);    // outside splash
const ent4 = makeEntity("tall", { u: 0, v: 0, y: 0 }, 200, 10); // tall building

const strike = { pos: { u: 0, v: 0 }, damage: 80, splashRadius: 8 };
function applyDamage(e, dmg, kind) {
  e.health.current = Math.max(0, e.health.current - dmg);
  e.health._lastKind = kind;
}
const hits = sys.applyLightningStrike(strike, entities, applyDamage);
ok(hits.length >= 3, `≥3 hits (a, b, tall all in radius) (got ${hits.length})`);

const aHit = hits.find(h => h.entityId === "a");
ok(aHit && aHit.damage === 80, "a at center takes full 80");

const bHit = hits.find(h => h.entityId === "b");
ok(bHit && bHit.damage > 0 && bHit.damage < 80, `b takes partial (got ${bHit.damage})`);

const tallHit = hits.find(h => h.entityId === "tall");
ok(tallHit && tallHit.damage > 80, `tall building takes height bonus (got ${tallHit.damage})`);

ok(!hits.find(h => h.entityId === "c"), "c outside radius → no hit");

// 5. Dead entities not re-hit
const corpse = makeEntity("corpse", { u: 0, v: 0, y: 0 }, 0);
corpse.health.dead = true;
const hits2 = sys.applyLightningStrike(strike, entities, applyDamage);
ok(!hits2.find(h => h.entityId === "corpse"), "dead entity skipped");

// Entity without health (e.g. building) is skipped
const building = { position: { u: 0, v: 0, y: 0 }, hitbox: { w: 1, d: 1, h: 5 } };
entities.set("bldg", building);
const hits3 = sys.applyLightningStrike(strike, entities, applyDamage);
ok(!hits3.find(h => h.entityId === "bldg"), "entity without health skipped");

// 6. Flood: accumulates during heavy_rain, drains otherwise
sys.clearFloods();
ok(sys.getFloodHeight("area_a") === 0, "starts at 0");

sys.tickFlood("area_a", "heavy_rain", 1.0, 10);   // 10s at rate 0.05 → 0.5
ok(Math.abs(sys.getFloodHeight("area_a") - 0.5) < 0.001,
   `flood = 0.5 after 10s (got ${sys.getFloodHeight("area_a").toFixed(3)})`);

sys.tickFlood("area_a", "heavy_rain", 1.0, 10);
ok(sys.getFloodHeight("area_a") > 0.9, "more flood after another 10s");

// Drain when not raining (rate halved, negative)
sys.tickFlood("area_a", "clear", 1.0, 40);
ok(sys.getFloodHeight("area_a") === 0, "drained to 0 (clamped)");

// Storm also fills
sys.tickFlood("area_b", "storm", 1.0, 5);
ok(sys.getFloodHeight("area_b") > 0, "storm fills flood");

// 7. Flood damage
sys.clearFloods();
sys.tickFlood("area_x", "heavy_rain", 1.0, 100);   // very flooded ~ 5.0
const floodEntities = new Map();
const f1 = { position: { u: 0, v: 0, y: 0 }, health: { current: 100, max: 100, dead: false } };
const f2 = { position: { u: 0, v: 0, y: 10 }, health: { current: 100, max: 100, dead: false } };  // high
floodEntities.set("low", f1);
floodEntities.set("high", f2);

const floodHits = sys.applyFloodDamage(
  floodEntities,
  () => "area_x",
  (e, dmg) => { e.health.current -= dmg; },
  1.0,
);
ok(floodHits.length === 1, "1 entity in flood");
ok(floodHits[0].entityId === "low", "low entity flooded");
ok(f1.health.current < 100, "low entity damaged");
ok(f2.health.current === 100, "high entity unaffected");

// 8. Hail damage during snow only
const hailEnt = new Map();
const h1 = { position: { u: 0, v: 0, y: 0 }, health: { current: 100, max: 100, dead: false } };
hailEnt.set("h", h1);
const hailHits = sys.applyHailDamage(hailEnt, null, (e, dmg) => { e.health.current -= dmg; },
  "snow", 1.0, 5);
ok(hailHits.length === 1, "hail hits in snow");
ok(h1.health.current < 100, "hail damage applied");

// Indoor entities skipped
const h2 = { position: { u: 0, v: 0, y: 0 }, health: { current: 100, max: 100, dead: false } };
hailEnt.set("indoor", h2);
sys.applyHailDamage(hailEnt, (pos) => pos.u === 0 && pos.v === 0, (e, dmg) => { e.health.current -= dmg; },
  "snow", 1.0, 5);
ok(h2.health.current === 100, "indoor entity not hailed");

// Hail doesn't fire in clear
const hailEnt2 = new Map();
const h3 = { position: { u: 0, v: 0, y: 0 }, health: { current: 100, max: 100, dead: false } };
hailEnt2.set("c", h3);
const noHail = sys.applyHailDamage(hailEnt2, null, () => {}, "clear", 1.0, 5);
ok(noHail.length === 0, "clear weather → no hail");

// 9. Strikes log
ok(sys.recentStrikes(50).length >= 1, "strike logged");

// 10. Recent events
ok(sys.recentEvents().filter(e => e.kind === "lightning").length > 0, "lightning event logged");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
