// test_iter_10.js — health facet + damage/regen/death events.
const Health = require("./health.js");
const Entity = require("./entity.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Reset listeners between sections so prior tests don't leak
Health.clearListeners();

// 1. makeHealth defaults
const h0 = Health.makeHealth(100);
ok(h0.current === 100, "makeHealth: current = max by default");
ok(h0.max === 100, "makeHealth: max stored");
ok(h0.regenRate === 0, "makeHealth: regen 0 by default");
ok(h0.dead === false, "makeHealth: not dead");

// 2. Damage flows + emits
const hero = Entity.createEntity("player", { health: Health.makeHealth(100) });
let damageEvents = 0, deathEvents = 0;
Health.on("damage", () => damageEvents++);
Health.on("death", () => deathEvents++);

Health.applyDamage(hero, 30, "enemy1", 1);
ok(hero.health.current === 70, `damage 30 → hp 70 (got ${hero.health.current})`);
ok(damageEvents === 1, "damage event fired");
ok(deathEvents === 0, "no death yet");
ok(hero.health.lastDamageT === 1, "lastDamageT recorded");

Health.applyDamage(hero, 100, "enemy2", 2);  // overkill
ok(hero.health.current === 0, "damage clamped at 0");
ok(hero.health.dead === true, "dead flag set");
ok(deathEvents === 1, "death event fired");

// Damage to a dead entity is a no-op
Health.applyDamage(hero, 10, "enemy3", 3);
ok(damageEvents === 2, "extra damage on dead entity does NOT fire damage event");
ok(deathEvents === 1, "extra damage on dead entity does NOT re-fire death");

// 3. Healing
Health.clearListeners();
let healEvents = 0;
Health.on("heal", () => healEvents++);
const hero2 = Entity.createEntity("player", { health: Health.makeHealth(100, { current: 30 }) });
Health.applyHeal(hero2, 25);
ok(hero2.health.current === 55, `heal +25 → 55 (got ${hero2.health.current})`);
ok(healEvents === 1, "heal event fired");
Health.applyHeal(hero2, 999);
ok(hero2.health.current === 100, "heal clamped at max");

// 4. Regen tick — only after regenDelay
Health.clearListeners();
const hero3 = Entity.createEntity("player", {
  health: Health.makeHealth(100, { current: 50, regenRate: 10, regenDelay: 2 }),
});
hero3.health.lastDamageT = 0;
// At t=1 (within delay), regen should NOT fire
Health.tick(hero3, 0.1, 1);
ok(hero3.health.current === 50, `regen blocked within delay (got ${hero3.health.current})`);
// At t=3 (past 2s delay), regen SHOULD fire
Health.tick(hero3, 1.0, 3);
ok(hero3.health.current === 60, `regen +10/s → 60 (got ${hero3.health.current})`);
// Regen stops at max
hero3.health.current = 99;
Health.tick(hero3, 1.0, 4);
ok(hero3.health.current === 100, "regen clamped at max");

// 5. Dead entity does not regen
hero3.health.dead = true;
hero3.health.current = 0;
Health.tick(hero3, 5.0, 100);
ok(hero3.health.current === 0, "dead entity does not regen");

// 6. Respawn
Health.respawn(hero3);
ok(hero3.health.current === 100 && !hero3.health.dead, "respawn → full hp, alive");

// 7. Multiple distinct listeners — both fire
Health.clearListeners();
let count = 0;
const incA = () => count++;
const incB = () => count++;
Health.on("damage", incA);
Health.on("damage", incB);
Health.applyDamage(hero3, 5, "x", 0);
ok(count === 2, `multiple listeners both fire (got ${count})`);

// 8. off() removes a specific listener
Health.off("damage", incA);
Health.applyDamage(hero3, 5, "x", 0);
ok(count === 3, `after off(incA), only incB fires (got ${count})`);

// 9. Listener throws don't break the chain
Health.clearListeners();
let safeFired = false;
Health.on("damage", () => { throw new Error("boom"); });
Health.on("damage", () => { safeFired = true; });
Health.applyDamage(hero3, 1, "x", 0);
ok(safeFired === true, "listener exception doesn't break later listeners");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
