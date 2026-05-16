// test_iter_11.js — 7 gun types as data, fire/reload/tick.
const Guns = require("./guns.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. All 7 gun types present
const expected = ["pistol", "smg", "rifle", "shotgun", "sniper", "rocket", "plasma"];
for (const name of expected) {
  ok(Guns.get(name) !== null, `gun ${name} defined`);
}
ok(Guns.names().length >= 7, `>= 7 guns registered (got ${Guns.names().length})`);

// 2. Each gun has the required schema fields
for (const name of expected) {
  const g = Guns.get(name);
  ok(typeof g.damage === "number" && g.damage > 0, `${name}: positive damage`);
  ok(typeof g.fireRate === "number" && g.fireRate > 0, `${name}: positive fireRate`);
  ok(typeof g.magSize === "number" && g.magSize > 0, `${name}: positive magSize`);
  ok(typeof g.ammoType === "string", `${name}: ammoType set`);
}

// 3. Sniper does the most damage; smg the least per shot among hitscans
const dmgs = expected.map(n => ({ n, d: Guns.get(n).damage }));
const sniper = dmgs.find(x => x.n === "sniper");
const smg = dmgs.find(x => x.n === "smg");
ok(sniper.d > 50, `sniper damage > 50 (got ${sniper.d})`);
ok(smg.d < 20, `smg damage < 20 (got ${smg.d})`);

// 4. Rocket is projectile + blast
const rocket = Guns.get("rocket");
ok(rocket.kind === "projectile", "rocket kind = projectile");
ok(rocket.blastRadius > 0, "rocket has blast radius");

// 5. Shotgun fires multiple pellets
ok(Guns.get("shotgun").pellets === 8, "shotgun pellets = 8");

// 6. makeInstance + fire flow
const inst = Guns.makeInstance("pistol");
ok(inst.ammo === 12, "pistol instance starts with 12 in mag");
ok(inst.reserve === 36, "pistol reserve is 3 mags");

const r1 = Guns.fire(inst, { u: 0, v: 0, y: 1.4 }, { u: 1, v: 0 }, 0.0);
ok(r1.fired === true, "first shot fires");
ok(r1.bullets.length === 1, "pistol fires 1 bullet");
ok(inst.ammo === 11, "ammo decremented");

// Cooldown: too-soon shot blocked
const r2 = Guns.fire(inst, { u: 0, v: 0, y: 1.4 }, { u: 1, v: 0 }, 0.05);
ok(r2.fired === false && r2.reason === "cooldown", `cooldown blocks early shot (${r2.reason})`);

// After cooldown elapses, fires again
const r3 = Guns.fire(inst, { u: 0, v: 0, y: 1.4 }, { u: 1, v: 0 }, 0.5);
ok(r3.fired === true, "fires again after cooldown");

// Empty mag
inst.ammo = 0;
const r4 = Guns.fire(inst, { u: 0, v: 0, y: 1.4 }, { u: 1, v: 0 }, 10);
ok(r4.fired === false && r4.reason === "empty_mag", "empty mag blocks fire");

// Reload pulls from reserve
const ok_r = Guns.reload(inst);
ok(ok_r === true, "reload succeeds with reserve");
ok(inst.ammo === 12, `reload refills mag (got ${inst.ammo})`);
ok(inst.reserve < 36, "reserve depleted");

// 7. Shotgun fires 8 bullets per shot
const sh = Guns.makeInstance("shotgun");
const shr = Guns.fire(sh, { u: 0, v: 0 }, { u: 0, v: 1 }, 0);
ok(shr.bullets.length === 8, `shotgun fires 8 pellets (got ${shr.bullets.length})`);

// 8. Bullet ticks across the world, retires at range
const bullet = shr.bullets[0];
let retired = false;
for (let i = 0; i < 1000; i++) {
  if (Guns.tickBullet(bullet, 1/60)) { retired = true; break; }
}
ok(retired, "bullet eventually retires (range exceeded)");

// 9. register a custom gun
Guns.register("railgun", { damage: 200, fireRate: 0.3, magSize: 2, ammoType: "energy_cell", range: 300, projectileSpeed: 250, accuracy: 1.0 });
ok(Guns.get("railgun").damage === 200, "custom gun registered");
let threw = false;
try { Guns.register("pistol", {}); } catch (e) { threw = true; }
ok(threw, "duplicate gun throws");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
