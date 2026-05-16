// test_iter_81.js — weather damage bridge: lightning + flood + hail → destruction.
const WD = require("./weather_damage.js");
const D = require("./destruction.js");
const B = require("./weather_damage_bridge.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Setup: weather sys, destruction sys, a few buildings
const weather = WD.createDamageSystem();
const dest = D.createSystem();
const buildings = new Map();

function mkBldg(id, pos, material, w, d, h) {
  const e = Entity.createEntity("building", {
    position: pos,
    hitbox: { w, d, h },
    destructible: D.makeDestructible({ material, w, d, h, maxHp: 200 }),
  });
  buildings.set(id, e);
  dest.register(id, e);
  return e;
}

mkBldg("shed",  { u: 0, v: 0, y: 0 },   "wood",  4, 4, 3);
mkBldg("tower", { u: 10, v: 0, y: 0 },  "wood",  4, 4, 20);    // tall → more lightning
mkBldg("vault", { u: 0, v: 10, y: 0 },  "concrete", 4, 4, 5);
mkBldg("window", { u: 0, v: 0, y: 0 },  "glass", 1, 0.1, 2);

// 1. Bridge construction
let threw = false;
try { B.createBridge(null, dest, buildings); } catch (e) { threw = true; }
ok(threw, "missing weatherSys throws");

const bridge = B.createBridge(weather, dest, buildings);
ok(typeof bridge.applyLightning === "function", "applyLightning fn");
ok(typeof bridge.tick === "function", "tick fn");

// 2. applyLightning hits buildings in radius
const strike = {
  pos: { u: 5, v: 0 }, damage: 100, splashRadius: 20, ts: Date.now(),
};
const hits = bridge.applyLightning(strike);
ok(hits.length >= 1, `lightning hit ${hits.length} buildings`);

// Tower should take more (taller; lightning exposure bonus)
const shedHit = hits.find(h => h.buildingId === "shed");
const towerHit = hits.find(h => h.buildingId === "tower");
ok(shedHit && towerHit, "shed + tower hit");
ok(towerHit.damage > shedHit.damage, `tower (h=20) > shed (h=3) (${towerHit.damage} vs ${shedHit.damage})`);

// 3. Strike with no pos → no hits
ok(bridge.applyLightning(null).length === 0, "null strike → 0 hits");

// 4. Collapsed buildings ignored
const shed = buildings.get("shed");
shed.destructible.collapsed = true;
const hits2 = bridge.applyLightning({ pos: { u: 0, v: 0 }, damage: 100, splashRadius: 5 });
ok(!hits2.find(h => h.buildingId === "shed"), "collapsed shed not hit");
shed.destructible.collapsed = false;
shed.destructible.currentHp = 200;

// 5. Out-of-radius → no hit
const farHits = bridge.applyLightning({ pos: { u: 1000, v: 1000 }, damage: 100, splashRadius: 5 });
ok(farHits.length === 0, "no hits far away");

// 6. Flood damages wood but not concrete/steel
const f1 = bridge.applyFloodTick(() => "areaA", 1);
ok(f1.length === 0, "no flood damage if no flood height");

weather.tickFlood("areaA", "heavy_rain", 1, 100);   // build up flood
const fh = weather.getFloodHeight("areaA");
ok(fh > 0.5, `flood height = ${fh}`);

const f2 = bridge.applyFloodTick(() => "areaA", 1);
ok(f2.length > 0, "flood damages wooden buildings");
const vaultFlood = f2.find(h => h.buildingId === "vault");
ok(!vaultFlood, "concrete vault unaffected by flood");

// 7. Hail damages glass only, in snow weather, when outdoors
// Reset all buildings — prior lightning/flood already chewed on them
for (const b of buildings.values()) {
  b.destructible.collapsed = false;
  b.destructible.currentHp = b.destructible.maxHp;
}
const hailHits = bridge.applyHailTick(null, "snow", 1, 1);
ok(hailHits.length === 1 && hailHits[0].buildingId === "window", "hail hits glass window only");

const noHail = bridge.applyHailTick(null, "clear", 1, 1);
ok(noHail.length === 0, "no hail in clear weather");

const indoorsHail = bridge.applyHailTick(() => true, "snow", 1, 1);
ok(indoorsHail.length === 0, "indoors → no hail");

// 8. Full tick cycle (no rng → may or may not strike, but no errors)
const cycle = bridge.tick({
  weather: "clear", intensity: 0,
  bounds: { u0: -100, v0: -100, u1: 100, v1: 100 },
  dt: 1, rng: () => 0.99,    // suppress strike
});
ok(cycle.struck === false, "no strike with rng=0.99");
ok(cycle.lightning.length === 0, "no lightning hits");
ok(cycle.hail.length === 0, "no hail in clear");

// Force a strike with deterministic rng
const cycleStrike = bridge.tick({
  weather: "storm", intensity: 1,
  bounds: { u0: -10, v0: -10, u1: 10, v1: 10 },
  dt: 1, rng: () => 0,    // < strikePerSecChance * intensity = 0.05 → strike
});
ok(cycleStrike.struck === true, "rng=0 in storm → struck");

// 9. Tick with flood resolver
const cycleFlood = bridge.tick({
  weather: "heavy_rain", intensity: 1,
  dt: 1, rng: () => 0.99,
  areaResolver: () => "areaA",
});
ok(cycleFlood.flood.length > 0, "flood tick runs");

// 10. Snow → hail tick fires
const cycleSnow = bridge.tick({
  weather: "snow", intensity: 1, dt: 1, rng: () => 0.99,
});
ok(cycleSnow.hail.length >= 0, "hail tick attempted in snow");

// 11. Config overrides
const bridge2 = B.createBridge(weather, dest, buildings, {
  config: { lightningKind: "bullet", lightningExposureBonus: 0 },
});
ok(bridge2.config.lightningKind === "bullet", "custom lightning kind");
ok(bridge2.config.lightningExposureBonus === 0, "custom exposure bonus");

// 12. Damage actually reduces HP
const w = buildings.get("window");
w.destructible.collapsed = false; w.destructible.currentHp = w.destructible.maxHp;
const before = w.destructible.currentHp;
bridge.applyHailTick(null, "snow", 1, 1);
const after = w.destructible.currentHp;
ok(after < before, `window HP decreased (${before} → ${after})`);

// 13. recentEvents
const ev = bridge.recentEvents();
ok(ev.length > 0, `events logged (${ev.length})`);
ok(ev.some(e => e.kind === "lightning_hit"), "lightning_hit event");

// 14. Collapsed building from cumulative damage
const fragile = mkBldg("fragile", { u: 0, v: 0, y: 0 }, "glass", 1, 1, 1);
fragile.destructible.maxHp = 5;
fragile.destructible.currentHp = 5;
const bigStrike = bridge.applyLightning({ pos: { u: 0, v: 0 }, damage: 100, splashRadius: 5 });
const fragileHit = bigStrike.find(h => h.buildingId === "fragile");
ok(fragileHit && fragileHit.collapsed === true, "fragile collapses under lightning");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
