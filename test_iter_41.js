// test_iter_41.js — performance benchmarks across hot paths.
// These are SHIPPABLE benchmarks: they fail only if numbers grossly
// regress (large multiplicative envelope). Treat printed numbers as the
// public perf contract.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Bridge = require("./engine_bridge.js");
const Phys   = require("./physics.js");
const Int    = require("./interest.js");
const Entity = require("./entity.js");
const Health = require("./health.js");
const Guns   = require("./guns.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}
function bench(name, fn, iters) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn(i);
  const ns = Number(process.hrtime.bigint() - t0);
  const usPer = (ns / iters) / 1000;
  console.log(`  bench ${name}: ${iters} iters in ${(ns/1e6).toFixed(2)}ms (${usPer.toFixed(3)} µs/iter)`);
  return { ns, iters, usPer };
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

// ===== 1. AABB collision micro-bench =====
const wall = { u: 5, v: 0, hitbox: { w: 2, d: 4 } };
const movers = [];
for (let i = 0; i < 100; i++) movers.push({ u: 0, v: 0, hitbox: { w: 1, d: 1 } });

const aabbR = bench("AABB overlap test (100 pairs)", (i) => {
  const m = movers[i % 100];
  Phys.overlapsAABB(m, m.hitbox, wall, wall.hitbox);
}, 100000);
ok(aabbR.usPer < 5, `AABB overlap < 5µs/op (got ${aabbR.usPer.toFixed(2)})`);

// ===== 2. resolveAABBMove with substep + blockers =====
const blockers = [];
for (let i = 0; i < 20; i++) blockers.push(Phys.aabbFromRect(i * 4, 0, i * 4 + 2, 2, 4));

const moveR = bench("resolveAABBMove (20 blockers, substep)", () => {
  const mover = { u: 0, v: 5, hitbox: { w: 1, d: 1 } };
  Phys.resolveAABBMove(mover, 2, 0.5, blockers);
}, 10000);
ok(moveR.usPer < 200, `resolveAABBMove < 200µs/op (got ${moveR.usPer.toFixed(2)})`);

// ===== 3. SpatialGrid via WorldState — large world nearby query =====
const world = new WorldState(1);
for (let i = 0; i < 1000; i++) {
  world.setPlayer(`p${i}`, 0, 0, 0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200);
}
// Without spatial grid, naive scan would be O(N).
// classifyPeers is O(N) but cheap.
const peers = [];
for (let i = 0; i < 1000; i++) peers.push({ id: `p${i}`, pos: { u: (Math.random()-0.5)*200, v: (Math.random()-0.5)*200 } });

const intR = bench("classifyPeers (1000 peers)", () => {
  Int.classifyPeers({ u: 0, v: 0 }, peers);
}, 200);
ok(intR.usPer < 5000, `classifyPeers 1000 peers < 5ms (got ${(intR.usPer/1000).toFixed(2)}ms)`);

// ===== 4. tickBullets — N bullets vs M targets =====
const w2 = new WorldState(1);
// 50 targetable entities scattered
for (let i = 0; i < 50; i++) {
  const e = Entity.createEntity("enemy", {
    position: { u: (Math.random() - 0.5) * 50, v: (Math.random() - 0.5) * 50, y: 1 },
    targetable: true,
    hitbox: { w: 0.7, d: 0.7, h: 1.7 },
    health: Health.makeHealth(100),
  });
  w2.addEntity(`e${i}`, e);
}
function freshBullets(n) {
  const bs = [];
  for (let i = 0; i < n; i++) bs.push({
    ownerId: "hero", damage: 5, range: 50, speed: 60,
    position: { u: 0, v: 0, y: 1 },
    velocity: { u: Math.cos(i), v: Math.sin(i), y: 0 },
    traveled: 0,
  });
  return bs;
}
const bulletR = bench("tickBullets (50 bullets vs 50 targets, 1 tick)", () => {
  const bs = freshBullets(50);
  Bridge.tickBullets(w2, bs, 0.05);
}, 100);
ok(bulletR.usPer < 10000, `tickBullets 50x50 < 10ms (got ${(bulletR.usPer/1000).toFixed(2)}ms)`);

// ===== 5. Gun fire (cooldown check + bullet creation) =====
const pistol = Guns.makeInstance("pistol");
pistol.ammo = 999999;
let t = 0;
const fireR = bench("Guns.fire (pistol, single shot)", () => {
  t += 0.5; // > cooldown so each shot fires
  Guns.fire(pistol, { u: 0, v: 0, y: 1.4 }, { u: 1, v: 0 }, t);
}, 10000);
ok(fireR.usPer < 50, `gun fire < 50µs/op (got ${fireR.usPer.toFixed(2)})`);

// ===== 6. applyCameraRelativeMove with collision =====
const moveR2 = bench("applyCameraRelativeMove + blockers", () => {
  const w3 = new WorldState(1);
  w3.setPlayer("hero", 0, 0, 0, 0, 0);
  Bridge.applyCameraRelativeMove(
    w3, "hero", 1, 0,
    { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }, 5, 0.016,
    { blockers, heroHitbox: { w: 0.8, d: 0.8 } }
  );
}, 5000);
ok(moveR2.usPer < 1000, `camera-relative move with collision < 1ms (got ${(moveR2.usPer/1000).toFixed(2)}ms)`);

// ===== 7. Inventory throughput =====
const Inv = require("./inventory.js");
const benchInv = Inv.makeInventory(50);
const invR = bench("Inv.addItem (stackable, fill+merge)", () => {
  Inv.addItem(benchInv, "coin", 1);
}, 10000);
ok(invR.usPer < 50, `inventory add < 50µs/op (got ${invR.usPer.toFixed(2)})`);

console.log(`\nperf summary:`);
console.log(`  AABB overlap:           ${aabbR.usPer.toFixed(2)} µs/op`);
console.log(`  resolveAABBMove:        ${moveR.usPer.toFixed(2)} µs/op`);
console.log(`  classifyPeers (1000):   ${(intR.usPer/1000).toFixed(2)} ms/call`);
console.log(`  tickBullets (50x50):    ${(bulletR.usPer/1000).toFixed(2)} ms/call`);
console.log(`  Guns.fire:              ${fireR.usPer.toFixed(2)} µs/op`);
console.log(`  cam-rel move +collide:  ${(moveR2.usPer/1000).toFixed(2)} ms/op`);
console.log(`  Inv.addItem:            ${invR.usPer.toFixed(2)} µs/op`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
