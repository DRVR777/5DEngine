// test_iter_40.js — full-session integration test.
// Drives MANY modules end-to-end: world + entities + AI + bullets + loot
// + inventory + crafting + shops + multiplayer + game modes.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const Bridge = require("./engine_bridge.js");
const Phys   = require("./physics.js");
const PP     = require("./physics_profile.js");
const Entity = require("./entity.js");
const Reg    = require("./registry.js");
const Health = require("./health.js");
const Guns   = require("./guns.js");
const Inv    = require("./inventory.js");
const AI     = require("./ai.js");
const Loot   = require("./loot.js");
const Vehicle = require("./vehicle.js");
const Craft  = require("./crafting.js");
const Shop   = require("./shop.js");
const Net    = require("./net.js");
const MP     = require("./multiplayer.js");
const Mode   = require("./game_mode.js");
const Int    = require("./interest.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

Health.clearListeners();

// ===== Setup =====
const world = new WorldState(1, { worldId: "integration", physicsProfile: PP.get("earth") });
const survival = Mode.get("survival");

// Hero entity (envelope) + legacy player record (for bridge funcs)
const hero = Entity.createEntity("player", {
  position: { u: 0, v: 0, y: 0 },
  health: Health.makeHealth(100, { regenRate: 5, regenDelay: 5 }),
  hitbox: { w: 0.8, d: 0.8, h: 1.8 },
  targetable: true,
});
world.addEntity("hero", hero);
world.setPlayer("hero", 0, 0, 0, 0, 0);

const heroInv = Inv.makeInventory(24);
Inv.addItem(heroInv, "gun_pistol", 1);
Inv.addItem(heroInv, "pistol_9mm", 24);

// 3 enemies with loot tables
for (let i = 0; i < 3; i++) {
  const e = Entity.createEntity("enemy", {
    position: { u: 5 + i * 2, v: 0, y: 0 },
    health: Health.makeHealth(50),
    hitbox: { w: 0.7, d: 0.7, h: 1.7 },
    ai: AI.makeAI({ patrolCenter: { u: 5 + i * 2, v: 0 }, patrolRadius: 4 }),
    loot: Loot.makeLoot([
      { type: "coin", qty: 5, chance: 1.0 },
      { type: "pistol_9mm", qty: 8, chance: 0.6 },
    ]),
    targetable: false,  // enemies aren't player targets for AI lookup
  });
  world.addEntity(`enemy_${i}`, e);
  world.setPlayer(`enemy_${i}`, 0, 0, 0, e.position.u, e.position.v);
}

// 1. Initial state sanity
ok(world.entities.size === 4, "world has hero + 3 enemies");
ok(hero.health.current === 100, "hero starts at full hp");
ok(Inv.countItem(heroInv, "pistol_9mm") === 24, "hero has 24 9mm");

// ===== Combat: hero shoots all 3 enemies =====
const pistolInst = Guns.makeInstance("pistol");
pistolInst.ammo = 24;
pistolInst.ownerId = "hero";   // bullets exclude their owner
const bullets = [];
let coinsDropped = 0;
let ammoDropped = 0;
Health.on("death", ({ entity }) => {
  // Run loot drop
  const drops = Loot.dropLoot(world, entity, Entity.createEntity, "loot");
  for (const d of drops) {
    if (d.entity.pickup.kind === "coin") coinsDropped += d.entity.pickup.qty;
    if (d.entity.pickup.kind === "pistol_9mm") ammoDropped += d.entity.pickup.qty;
  }
});

// Aim at each enemy in turn, fire enough rounds to kill it
let shotsFired = 0, hits = 0;
for (let i = 0; i < 3; i++) {
  const enemyId = `enemy_${i}`;
  const e = world.entities.get(enemyId);
  while (!e.health.dead && pistolInst.ammo > 0 && shotsFired < 100) {
    // Fire toward enemy position
    const dx = e.position.u - hero.position.u;
    const dy = e.position.v - hero.position.v;
    const m = Math.hypot(dx, dy) || 1;
    const fired = Guns.fire(pistolInst, hero.position, { u: dx / m, v: dy / m }, shotsFired * 0.3);
    if (fired.fired) {
      shotsFired++;
      // Make enemies targetable for the bullet hit-test
      e.targetable = true;
      bullets.push(...fired.bullets);
      // Tick bullets across the world until they all hit or die.
      // Use small dt to avoid tunneling past enemies (bullet speed * dt
      // must be < enemy hitbox radius for guaranteed hits).
      let safety = 2000;
      while (bullets.length > 0 && safety-- > 0) {
        const tickHits = Bridge.tickBullets(world, bullets, 0.005);
        for (const h of tickHits) {
          hits++;
          Health.applyDamage(h.target.entity, h.bullet.damage, "hero", shotsFired * 0.3);
        }
      }
      e.targetable = false;
    } else if (fired.reason === "cooldown") {
      // skip cooldown
    } else break;
  }
}
ok(shotsFired > 0, `hero fired ${shotsFired} shots`);
ok(hits > 0, `${hits} hits landed`);
const deadCount = ["enemy_0", "enemy_1", "enemy_2"].filter(id => world.entities.get(id).health.dead).length;
ok(deadCount === 3, `all 3 enemies dead (got ${deadCount})`);
ok(coinsDropped === 15, `15 coins dropped from 3 corpses (got ${coinsDropped})`);

// ===== Loot pickup: hero collects nearby drops =====
const lootEntities = Array.from(world.entities.entries()).filter(([id]) => id.startsWith("loot_"));
console.log("  [debug] loot drops:", lootEntities.map(([id, e]) => `${id}={${e.pickup.kind}×${e.pickup.qty}}`).join(", "));
ok(lootEntities.length >= 3, `at least 3 loot entities spawned (got ${lootEntities.length})`);

let collected = 0;
for (const [id, le] of lootEntities) {
  // Hero teleports to each drop and collects
  hero.position.u = le.position.u;
  hero.position.v = le.position.v;
  Inv.addItem(heroInv, le.pickup.kind, le.pickup.qty);
  world.removeEntity(id);
  collected++;
}
ok(collected === lootEntities.length, "all loot collected");
const coinCount = Inv.countItem(heroInv, "coin");
const ammoCount = Inv.countItem(heroInv, "pistol_9mm");
console.log(`  [debug] coins=${coinCount}, ammo=${ammoCount}, lootEntities=${lootEntities.length}`);
ok(coinCount === 15, `15 coins in inventory (got ${coinCount})`);

// ===== Shop: spend coins on more ammo =====
const shop = Shop.makeShop({
  name: "Ammo Cabinet",
  stock: [{ type: "pistol_9mm", qty: 100, price: 1 }],
});
const invOps = { countItem: Inv.countItem, removeItem: Inv.removeItem, addItem: Inv.addItem };
const buyResult = Shop.buy(shop, heroInv, "pistol_9mm", 10, invOps);
ok(buyResult.ok === true, "bought 10 9mm");
ok(Inv.countItem(heroInv, "coin") === 5, "5 coins left after buying");
ok(Inv.countItem(heroInv, "pistol_9mm") >= 10, "ammo replenished");

// ===== Crafting: medkit from coins =====
const craftResult = Craft.craft(heroInv, "medkit_basic", null, invOps);
ok(craftResult.ok === true, "crafted medkit");
ok(Inv.countItem(heroInv, "medkit") === 1, "1 medkit in inventory");
ok(Inv.countItem(heroInv, "coin") === 0, "all coins spent");

// ===== Game mode: hero takes damage, regens after delay =====
hero.health.dead = false;
Health.applyDamage(hero, 30, "monster", 100);
ok(hero.health.current === 70, "took 30 damage");

// 5 seconds of no damage + 1s tick → regen
hero.health.lastDamageT = 100;
let t = 105.5;
for (let i = 0; i < 10; i++) {
  Health.tick(hero, 0.5, t);
  t += 0.5;
}
ok(hero.health.current > 70, `regen worked (hp=${hero.health.current})`);

// ===== Vehicle: build a sedan from parts the hero has =====
Inv.addItem(heroInv, "part_body", 1);
Inv.addItem(heroInv, "part_engine", 1);
Inv.addItem(heroInv, "part_wheel", 4);
const sedan = Vehicle.buildVehicle([
  "part_body_sedan", "part_engine_v6",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(sedan.complete === true, "sedan built");
ok(sedan.stats.topSpeed === 22, "sedan top speed = 22");

// ===== Multiplayer: spin up server, attach client, exchange intent =====
const mpWorld = new WorldState(1, { worldId: "mp_test" });
const server = MP.createServer({ world: mpWorld, nodeId: "S" });
const aSink = [];
const aClient = MP.createClient();
server.attachClient("room1", "alice", env => { aSink.push(env); aClient.handleEnvelope(env); });
server.receiveIntent("room1", "alice", { action: "move", direction: { u: 1, v: 0 } });
server.tick(0.1);
ok(aClient.remotePositions.has("alice"), "MP: alice's position visible after tick");

// ===== Interest mgmt: classify alice's peers =====
const peers = [
  { id: "near", pos: { u: 5, v: 0 } },
  { id: "mid",  pos: { u: 150, v: 0 } },
  { id: "far",  pos: { u: 800, v: 0 } },
];
const classified = Int.classifyPeers({ u: 0, v: 0 }, peers);
ok(classified.foreground.length === 1, "1 in foreground");
ok(classified.midground.length === 1, "1 in midground");
ok(classified.background.length === 1, "1 in background");

// ===== End-of-session report =====
console.log(`\n=== Integration session report ===`);
console.log(`shots fired: ${shotsFired}, hits: ${hits}`);
console.log(`enemies killed: ${deadCount}`);
console.log(`loot pickups: ${collected}`);
console.log(`final inventory weight: ${Inv.totalWeight(heroInv).toFixed(2)} kg`);
console.log(`final hp: ${hero.health.current}`);
console.log(`vehicle built: sedan (topSpeed=${sedan.stats.topSpeed})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
