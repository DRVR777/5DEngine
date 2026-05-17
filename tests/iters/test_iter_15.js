// test_iter_15.js — bullet→enemy damage flow + loot drop on death.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Bridge = require("./engine_bridge.js");
const Loot   = require("./loot.js");
const Entity = require("./entity.js");
const Health = require("./health.js");
const Guns   = require("./guns.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

Health.clearListeners();

// 1. tickBullets advances + retires at range
const w = new WorldState(1);
const bullets = [{
  ownerId: "hero",
  damage: 20,
  range: 5,
  speed: 50,
  position: { u: 0, v: 0, y: 1 },
  velocity: { u: 1, v: 0, y: 0 },
  traveled: 0,
}];
let hits = Bridge.tickBullets(w, bullets, 0.05);
ok(hits.length === 0, "no targets → no hits");
ok(bullets[0].position.u > 0, `bullet advanced (u=${bullets[0].position.u.toFixed(2)})`);

// Tick until range exceeded
for (let i = 0; i < 50; i++) Bridge.tickBullets(w, bullets, 0.05);
ok(bullets.length === 0, "bullet retires past range");

// 2. Bullet hits a targetable entity → pair returned
const target = Entity.createEntity("enemy", {
  position: { u: 3, v: 0, y: 1 },
  targetable: true,
  hitbox: { w: 0.8, d: 0.8, h: 1.8 },
  health: Health.makeHealth(100),
});
w.addEntity("e1", target);
const b2 = [{
  ownerId: "hero", damage: 25, range: 50, speed: 100,
  position: { u: 0, v: 0, y: 1 }, velocity: { u: 1, v: 0, y: 0 }, traveled: 0,
}];
let totalHits = [];
for (let i = 0; i < 30; i++) {
  totalHits = totalHits.concat(Bridge.tickBullets(w, b2, 1/60));
  if (b2.length === 0) break;
}
ok(totalHits.length === 1, `bullet eventually hit target (got ${totalHits.length})`);
ok(totalHits[0].target.id === "e1", "hit is target e1");

// Apply the damage from the hit
Health.applyDamage(totalHits[0].target.entity, totalHits[0].bullet.damage, "hero", 1);
ok(target.health.current === 75, `damage applied (hp=${target.health.current})`);

// 3. Bullet doesn't hit owner
const b3 = [{
  ownerId: "e1", damage: 999, range: 50, speed: 100,
  position: { u: 3, v: 0, y: 1 }, velocity: { u: 0.01, v: 0, y: 0 }, traveled: 0,
}];
const sh = Bridge.tickBullets(w, b3, 0.05);
ok(sh.length === 0, "bullet does not hit its own owner");

// 4. Bullet skips dead targets
w.removeEntity("e1");  // remove the alive target from test 2 so this isolates corpse
const corpse = Entity.createEntity("enemy", {
  position: { u: 0.1, v: 0, y: 1 },
  targetable: true, hitbox: { w: 1, d: 1, h: 2 },
  health: Health.makeHealth(100, { current: 0 }),
});
corpse.health.dead = true;
w.addEntity("corpse", corpse);
const b4 = [{
  ownerId: "hero", damage: 10, range: 5, speed: 50,
  position: { u: 0, v: 0, y: 1 }, velocity: { u: 1, v: 0, y: 0 }, traveled: 0,
}];
let cHits = 0;
for (let i = 0; i < 10; i++) cHits += Bridge.tickBullets(w, b4, 0.01).length;
ok(cHits === 0, "dead targets are not hit");

// 5. Loot drop on death — roll table, spawn pickup entities at corpse
const lootTable = Loot.makeLoot([
  { type: "coin",      qty: 5, chance: 1.0 },
  { type: "pistol_9mm", qty: 12, chance: 1.0 },
  { type: "medkit",    qty: 1,  chance: 0.0 }, // never
], { radius: 1 });
const enemy2 = Entity.createEntity("enemy", {
  position: { u: 10, v: 10, y: 0 },
  loot: lootTable,
  health: Health.makeHealth(50),
});
w.addEntity("enemy2", enemy2);
let counter = 0;
const rng = () => (counter++ % 100) / 100;  // deterministic 0..0.99
const drops = Loot.dropLoot(w, enemy2, Entity.createEntity, "test_loot", rng);
ok(drops.length === 2, `2 of 3 dropped (chance=1.0 entries) — got ${drops.length}`);
ok(drops[0].entity.pickup.kind === "coin", "first drop is coin");
ok(drops[1].entity.pickup.kind === "pistol_9mm", "second drop is pistol_9mm");
// Drops landed near corpse
for (const d of drops) {
  const dist = Math.hypot(d.entity.position.u - 10, d.entity.position.v - 10);
  ok(dist <= 1.001, `drop within radius (d=${dist.toFixed(2)})`);
}

// 6. Loot.roll respects probabilities deterministically
let coinCount = 0, medCount = 0;
const seed = { v: 0 };
const detRng = () => { seed.v = (seed.v * 1664525 + 1013904223) >>> 0; return seed.v / 0xffffffff; };
const halfTable = Loot.makeLoot([
  { type: "coin", chance: 1.0 },
  { type: "medkit", chance: 0.5 },
]);
for (let i = 0; i < 1000; i++) {
  const r = Loot.roll(halfTable, detRng);
  if (r.find(x => x.type === "coin")) coinCount++;
  if (r.find(x => x.type === "medkit")) medCount++;
}
ok(coinCount === 1000, `coin always rolls (1000 of 1000)`);
ok(medCount > 400 && medCount < 600, `medkit ~50% (${medCount}/1000 in [400, 600])`);

// 7. End-to-end: enemy with loot dies → drop fires via Health.on("death")
const w2 = new WorldState(1);
const e3 = Entity.createEntity("enemy", {
  position: { u: 0, v: 0, y: 0 },
  loot: Loot.makeLoot([{ type: "coin", qty: 3, chance: 1.0 }]),
  health: Health.makeHealth(10),
});
w2.addEntity("e3", e3);
let lootedCount = 0;
Health.on("death", ({ entity }) => {
  const d = Loot.dropLoot(w2, entity, Entity.createEntity, "death_loot");
  lootedCount += d.length;
});
Health.applyDamage(e3, 999, "hero", 1);
ok(lootedCount === 1, `enemy death triggered loot drop (${lootedCount} drops)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
