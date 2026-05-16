// test_iter_73.js — building destruction + materials + debris.
const D = require("./destruction.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Materials
ok(D.MATERIALS.wood !== undefined, "wood material");
ok(D.MATERIALS.steel.hpPerM3 === 500, "steel hp/m3");
ok(D.MATERIALS.glass.hpPerM3 === 10, "glass weakest");

// 2. makeDestructible
const d1 = D.makeDestructible({ material: "brick", w: 4, d: 4, h: 6 });
ok(d1.material === "brick", "material set");
ok(d1.volume === 96, "volume = 4*4*6 = 96");
ok(d1.maxHp === 96 * 150, "maxHp = volume * brick hp/m3");
ok(d1.currentHp === d1.maxHp, "starts at full");
ok(d1.collapsed === false, "not collapsed");

// Explicit maxHp override
const d2 = D.makeDestructible({ material: "wood", maxHp: 50 });
ok(d2.maxHp === 50, "custom maxHp honored");

// 3. System: register + damage
const sys = D.createSystem();
const shed = Entity.createEntity("building", {
  position: { u: 10, v: 10, y: 0 },
  hitbox: { w: 4, d: 4, h: 3 },
  destructible: D.makeDestructible({ material: "wood", w: 4, d: 4, h: 3 }),
});
ok(sys.register("shed", shed).ok === true, "registered");
ok(sys.register("invalid", {}).ok === false, "non-destructible rejected");

const initHp = shed.destructible.currentHp;
const r1 = sys.applyDamage("shed", 100, "bullet");
ok(r1.ok === true, "damage applied");
ok(shed.destructible.currentHp === initHp - 100, "hp drops by 100");
ok(r1.collapsed === false, "not collapsed");

// Damage missing building
ok(sys.applyDamage("ghost", 100, "bullet").ok === false, "missing building");

// 4. Explosion resistance
const concreteShed = Entity.createEntity("building", {
  position: { u: 20, v: 20, y: 0 },
  hitbox: { w: 2, d: 2, h: 2 },
  destructible: D.makeDestructible({ material: "concrete", w: 2, d: 2, h: 2, maxHp: 100 }),
});
sys.register("concrete", concreteShed);

const r2 = sys.applyDamage("concrete", 100, "explosion");
// concrete explosionResist 0.85 → effective = 100 * 0.15 = 15
ok(Math.abs(r2.damageDealt - 15) < 0.001, `concrete blast = 15 (got ${r2.damageDealt})`);
ok(Math.abs(concreteShed.destructible.currentHp - 85) < 0.001, "hp = 85");

// 5. Glass takes double bullet damage
const window = Entity.createEntity("building", {
  position: { u: 0, v: 0, y: 0 },
  hitbox: { w: 1, d: 0.1, h: 2 },
  destructible: D.makeDestructible({ material: "glass", maxHp: 20 }),
});
sys.register("window", window);
const r3 = sys.applyDamage("window", 5, "bullet");
ok(r3.damageDealt === 10, `glass takes 2x bullets (got ${r3.damageDealt})`);

// 6. Collapse
const r4 = sys.applyDamage("window", 100, "bullet");
ok(r4.collapsed === true, "window collapsed");
ok(window.destructible.collapsed === true, "facet flag set");
ok(window.destructible.currentHp === 0, "hp at 0");
ok(r4.debrisIds && r4.debrisIds.length > 0, "debris spawned");

const r5 = sys.applyDamage("window", 50, "bullet");
ok(r5.ok === false && r5.reason === "already_collapsed", "collapsed buildings don't take more damage");

// 7. Debris
const allDebris = sys.getDebris();
ok(allDebris.length > 0, "debris in system");
ok(allDebris[0].pos !== undefined, "debris has pos");
ok(allDebris[0].radius > 0, "debris has radius");

// Tick debris ages
sys.tickDebris(60);
sys.tickDebris(80);  // total 140s > 120s expiry
const remaining = sys.getDebris();
ok(remaining.length === 0, "old debris removed after 120s");

// 8. Explosion damages multiple buildings
const sys2 = D.createSystem();
const b1 = Entity.createEntity("b", {
  position: { u: 0, v: 0, y: 0 }, hitbox: { w: 1, d: 1, h: 1 },
  destructible: D.makeDestructible({ material: "wood", maxHp: 50 }),
});
const b2 = Entity.createEntity("b", {
  position: { u: 5, v: 0, y: 0 }, hitbox: { w: 1, d: 1, h: 1 },
  destructible: D.makeDestructible({ material: "wood", maxHp: 50 }),
});
const b3 = Entity.createEntity("b", {
  position: { u: 100, v: 0, y: 0 }, hitbox: { w: 1, d: 1, h: 1 },
  destructible: D.makeDestructible({ material: "wood", maxHp: 50 }),
});
sys2.register("b1", b1); sys2.register("b2", b2); sys2.register("b3", b3);

const hits = sys2.applyExplosion({ u: 0, v: 0 }, 100, 10);
ok(hits.length === 2, `2 hits (b1 + b2 within blast 10) (got ${hits.length})`);
ok(hits.find(h => h.buildingId === "b1").damageDealt > hits.find(h => h.buildingId === "b2").damageDealt,
   "closer building takes more damage");

// b3 is 100 away, outside blast → no hit
ok(b3.destructible.currentHp === 50, "b3 unscathed");

// 9. Repair
const r6 = sys.applyDamage("shed", 50, "bullet");
const repBefore = shed.destructible.currentHp;
const rep = sys.repair("shed", 30);
ok(rep.ok === true, "repair ok");
ok(rep.healed === 30, "healed 30");
ok(shed.destructible.currentHp === repBefore + 30, "hp incremented");

// Can't repair collapsed
ok(sys.repair("window", 100).ok === false, "can't repair collapsed");

// Heal caps at max
const rep2 = sys.repair("shed", 999999);
ok(shed.destructible.currentHp === shed.destructible.maxHp, "repair caps at max");

// 10. listBuildings / listCollapsed
ok(sys.listBuildings().length === 3, "3 registered (shed + concrete + window)");
ok(sys.listCollapsed().includes("window"), "window in collapsed list");
ok(!sys.listCollapsed().includes("shed"), "shed not collapsed");

// 11. registerMaterial
D.registerSystem; // no-op check
D.registerMaterial && D.registerMaterial("titanium", { hpPerM3: 1500, explosionResist: 0.99 });
ok(D.getMaterial("titanium").hpPerM3 === 1500, "custom material registered");

let threw = false;
try { D.registerMaterial("wood", {}); } catch (e) { threw = true; }
ok(threw, "duplicate material throws");

// 12. Damage history tracked
ok(shed.destructible.damageHistory.length > 0, "damage history recorded");
ok(shed.destructible.damageHistory[0].kind === "bullet", "kind tracked");

// 13. Events
const ev = sys.recentEvents();
ok(ev.length >= 1, "events logged");
ok(ev.some(e => e.kind === "collapse"), "collapse event logged");

// 14. Different materials have different durability
const wood = D.makeDestructible({ material: "wood", volume: 1 });
const steel = D.makeDestructible({ material: "steel", volume: 1 });
ok(steel.maxHp > wood.maxHp * 5, `steel ~10x wood (wood ${wood.maxHp}, steel ${steel.maxHp})`);

// 15. Steel withstands explosion well
const sys3 = D.createSystem();
const steelBldg = Entity.createEntity("b", {
  position: { u: 0, v: 0, y: 0 }, hitbox: { w: 1, d: 1, h: 1 },
  destructible: D.makeDestructible({ material: "steel", maxHp: 100 }),
});
sys3.register("steel", steelBldg);
const steelHits = sys3.applyExplosion({ u: 0, v: 0 }, 1000, 5);
// At center: damageDealt = 1000 * (1 - 0.95) = 50 (full falloff = 1)
ok(Math.abs(steelHits[0].damageDealt - 50) < 0.001, `steel takes 50 from 1000 dmg blast (got ${steelHits[0].damageDealt})`);
ok(!steelHits[0].collapsed, "steel survives");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
