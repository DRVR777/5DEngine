// test_iter_31.js — survival/creative/peaceful modes as data rules.
const Mode = require("./game_mode.js");
const Inv  = require("./inventory.js");
const Health = require("./health.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Built-in modes
const survival = Mode.get("survival");
const creative = Mode.get("creative");
const peaceful = Mode.get("peaceful");
ok(survival && creative && peaceful, "all 3 default modes registered");
ok(Mode.names().length === 3, "3 modes by default");

ok(survival.damageEnabled === true && survival.hungerEnabled === true,
   "survival = damage + hunger on");
ok(creative.damageEnabled === false && creative.infiniteInventory === true,
   "creative = no damage, infinite inv");
ok(peaceful.damageEnabled === false && peaceful.hungerEnabled === true,
   "peaceful = no damage, hunger on");

// 2. shouldApplyDamage in survival vs creative
ok(Mode.shouldApplyDamage(survival, "enemy1", "player_alice") === true,
   "survival: enemy → player damages");
ok(Mode.shouldApplyDamage(creative, "enemy1", "player_alice") === false,
   "creative: no damage at all");
ok(Mode.shouldApplyDamage(survival, "player_alice", "player_bob") === true,
   "survival: player → player damages (friendlyFire on)");
ok(Mode.shouldApplyDamage(peaceful, "player_alice", "player_bob") === false,
   "peaceful: no friendly fire");
ok(Mode.shouldApplyDamage(survival, "player_a", "player_a") === true,
   "self-damage always allowed if mode permits");

// 3. Hunger lifecycle
const h = Mode.makeHunger(survival);
ok(h.current === 100 && h.max === 100, "hunger starts full");

// Drain hunger over 60s (rate 0.5/s → 30 lost)
const r1 = Mode.tickHunger(survival, h, 60, 0);
ok(h.current === 70, `60s of drain → 70 (got ${h.current})`);
ok(r1.starveDamage === 0, "no starve damage above 0");

// Drain to 0
Mode.tickHunger(survival, h, 200, 60);
ok(h.current === 0, `drained to 0 (got ${h.current})`);
const r2 = Mode.tickHunger(survival, h, 1, 260);
ok(r2.starveDamage === 1.0, `starve damage = 1.0 hp/s × 1s = 1.0 (got ${r2.starveDamage})`);

// Creative mode: no hunger drain
const hC = Mode.makeHunger(creative);
const rC = Mode.tickHunger(creative, hC, 100, 0);
ok(hC.current === 100, "creative: hunger never drains");
ok(rC.starveDamage === 0, "creative: no starve damage");

// 4. Eat restores hunger
const hLow = { current: 30, max: 100, lastTickT: 0 };
const restored = Mode.eat(hLow, 25);
ok(restored === 25 && hLow.current === 55, `eat +25 → 55 (got ${hLow.current})`);

const restored2 = Mode.eat(hLow, 999);
ok(hLow.current === 100, "eat clamps at max");

// 5. modeAddItem — creative is "infinite" so addItem returns 0 leftover always
const inv = Inv.makeInventory(2);
Inv.addItem(inv, "gun_pistol", 1);
Inv.addItem(inv, "gun_smg", 1);  // inv now full

// In survival, adding another gun fails (returns leftover)
const sLeft = Mode.modeAddItem(survival, inv, "gun_rifle", 1, Inv.addItem);
ok(sLeft === 1, `survival: full inv → leftover 1 (got ${sLeft})`);

// In creative, even a full inv returns 0 leftover (no-op success)
const cLeft = Mode.modeAddItem(creative, inv, "gun_rifle", 1, Inv.addItem);
ok(cLeft === 0, `creative: full inv but always 'fits' → leftover 0 (got ${cLeft})`);

// 6. Loot drop rule
ok(Mode.shouldDropLoot(survival) === true, "survival drops loot");
ok(Mode.shouldDropLoot(creative) === false, "creative does NOT drop loot");
ok(Mode.shouldDropLoot(peaceful) === true, "peaceful drops loot");

// 7. Free-build rule
ok(Mode.canFreeBuild(creative) === true, "creative free build");
ok(Mode.canFreeBuild(peaceful) === true, "peaceful free build");
ok(Mode.canFreeBuild(survival) === false, "survival requires resources");

// 8. Custom mode registration
Mode.register("hardcore", {
  damageEnabled: true, hungerEnabled: true, hungerRate: 5,
  starveAt: 0, hungerDrainPerSec: 1.5, maxHunger: 100,
  lootDropsEnabled: true, respawnDelaySec: 60,
  infiniteInventory: false, freeBuild: false, friendlyFire: true,
});
ok(Mode.get("hardcore") !== null, "custom mode registered");
ok(Mode.get("hardcore").hungerRate === 5, "custom mode params honored");
let threw = false;
try { Mode.register("survival", {}); } catch (e) { threw = true; }
ok(threw, "duplicate mode throws");

// 9. End-to-end: starvation kills the player in survival
Health.clearListeners();
const player = Entity.createEntity("player", {
  health: Health.makeHealth(20),
  hunger: Mode.makeHunger(survival),
});
let deathFired = 0;
Health.on("death", () => deathFired++);

let t = 0;
// Drain hunger fully + then enough seconds of starve damage to kill 20hp
for (let i = 0; i < 1000; i++) {
  const r = Mode.tickHunger(survival, player.hunger, 0.5, t);
  if (r.starveDamage > 0) {
    Health.applyDamage(player, r.starveDamage, "starvation", t);
  }
  t += 0.5;
  if (player.health.dead) break;
}
ok(player.health.dead === true, `player starved to death (hp=${player.health.current})`);
ok(deathFired === 1, "death event fired exactly once");

// Same setup in creative — never dies
Health.respawn(player);
player.hunger = Mode.makeHunger(creative);
deathFired = 0;
for (let i = 0; i < 1000; i++) {
  const r = Mode.tickHunger(creative, player.hunger, 0.5, t);
  if (r.starveDamage > 0) Health.applyDamage(player, r.starveDamage, "starvation", t);
  t += 0.5;
  if (player.health.dead) break;
}
ok(player.health.dead === false, "creative: never starves to death");
ok(deathFired === 0, "creative: no death events");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
