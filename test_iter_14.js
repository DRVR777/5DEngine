// test_iter_14.js — AI state machine.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const AI = require("./ai.js");
const Entity = require("./entity.js");
const Health = require("./health.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// Fresh listeners per test
Health.clearListeners();

// 1. makeAI defaults + states
const a = AI.makeAI();
ok(a.state === "idle", "AI starts in idle");
ok(AI.STATES.includes("idle") && AI.STATES.includes("seek")
    && AI.STATES.includes("attack") && AI.STATES.includes("dead"),
   "STATES enumerates the 4 states");

// 2. Idle: no target → state stays idle, position drifts within patrol
const world = new WorldState(1);
const enemy = Entity.createEntity("enemy", {
  position: { u: 0, v: 0, y: 0 },
  ai: AI.makeAI({ patrolCenter: { u: 0, v: 0 }, patrolRadius: 5 }),
  health: Health.makeHealth(50),
});
world.addEntity("enemy1", enemy);
for (let i = 0; i < 50; i++) AI.tick(enemy, world, 0.1, i * 0.1, {});
ok(enemy.ai.state === "idle", "no target → still idle");
ok(Math.hypot(enemy.position.u, enemy.position.v) <= 6,
   `patrol kept enemy near center (d=${Math.hypot(enemy.position.u, enemy.position.v).toFixed(2)})`);

// 3. Seek: targetable hero appears in sight range → state flips to seek and enemy approaches
const hero = Entity.createEntity("player", {
  position: { u: 8, v: 0, y: 0 },
  targetable: true,
  health: Health.makeHealth(100),
});
world.addEntity("hero", hero);
enemy.position = { u: 0, v: 0, y: 0 }; // reset
const startDist = Math.hypot(hero.position.u - enemy.position.u, hero.position.v - enemy.position.v);
for (let i = 0; i < 10; i++) AI.tick(enemy, world, 0.1, i * 0.1, {});
const newDist = Math.hypot(hero.position.u - enemy.position.u, hero.position.v - enemy.position.v);
ok(enemy.ai.state === "seek" || enemy.ai.state === "attack",
   `state flipped to seek/attack (got ${enemy.ai.state})`);
ok(newDist < startDist, `enemy closed distance (${newDist.toFixed(2)} < ${startDist.toFixed(2)})`);
ok(enemy.ai.targetId === "hero", "targetId locked onto hero");

// 4. Attack: when within attackRange, fire callback at cooldown
let attacks = 0;
let totalDamage = 0;
hero.position = { u: 1, v: 0, y: 0 };
enemy.position = { u: 0, v: 0, y: 0 };
for (let i = 0; i < 50; i++) {
  AI.tick(enemy, world, 0.05, i * 0.05, {
    onAttack: (atk, tgt, dmg) => { attacks++; totalDamage += dmg; }
  });
}
ok(enemy.ai.state === "attack", `state = attack at close range (got ${enemy.ai.state})`);
ok(attacks >= 2, `multiple attacks at 1s cooldown over 2.5s (got ${attacks})`);
ok(totalDamage === attacks * 8, `damage matches attackDamage*count (got ${totalDamage})`);

// 5. Out of sight → returns to idle
hero.position = { u: 1000, v: 0, y: 0 };
AI.tick(enemy, world, 0.1, 100, {});
ok(enemy.ai.state === "idle", "lost sight → idle");
ok(enemy.ai.targetId === null, "targetId cleared");

// 6. Dead enemy stays dead, doesn't attack
enemy.health.dead = true;
attacks = 0;
hero.position = { u: 0.5, v: 0, y: 0 };
for (let i = 0; i < 20; i++) {
  AI.tick(enemy, world, 0.1, 200 + i, { onAttack: () => attacks++ });
}
ok(enemy.ai.state === "dead", "dead enemy is in dead state");
ok(attacks === 0, "dead enemy does not attack");

// 7. Dead targets are skipped
enemy.health.dead = false;
hero.position = { u: 1, v: 0, y: 0 };
hero.health.dead = true;
AI.tick(enemy, world, 0.1, 300, {});
ok(enemy.ai.state === "idle", "dead target ignored → idle");

// 8. findNearestTarget picks nearest among multiple
const e2 = Entity.createEntity("player", {
  position: { u: 0.5, v: 0, y: 0 }, targetable: true, health: Health.makeHealth(100),
});
world.addEntity("p2", e2);
hero.health.dead = false;
hero.position = { u: 5, v: 0, y: 0 };
const found = AI.findNearestTarget(world, enemy, 50);
ok(found && found.id === "p2", `nearest of two targets (${found ? found.id : 'null'})`);

// 9. Wire AI.onAttack into Health.applyDamage end-to-end
Health.respawn(hero);  // test 7 left hero dead
world.removeEntity("p2");  // remove the second target from test 8
hero.position = { u: 1, v: 0, y: 0 };
enemy.position = { u: 0, v: 0, y: 0 };
const initialHp = hero.health.current;
let deathCount = 0;
Health.on("death", () => deathCount++);
let t = 1000;
for (let i = 0; i < 400; i++) {
  AI.tick(enemy, world, 0.05, t, {
    onAttack: (atk, tgt, dmg) => Health.applyDamage(tgt, dmg, "enemy1", t),
  });
  t += 0.05;
  if (hero.health.dead) break;
}
ok(hero.health.current < initialHp, `hero took damage (${hero.health.current} < ${initialHp})`);
ok(hero.health.dead === true, "hero eventually dies");
ok(deathCount >= 1, "death event fired");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
