// test_iter_08.js — AABB collision (no walking through walls + jump-on top).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Phys   = require("./physics.js");
const Bridge = require("./engine_bridge.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

ok(/iter\d+/.test(Bridge.VERSION), `VERSION carries iter tag (got ${Bridge.VERSION})`);

// 1. AABB overlap basics
ok(Phys.overlapsAABB(
  { u: 0, v: 0 }, { w: 2, d: 2 },
  { u: 1, v: 1 }, { w: 2, d: 2 }
) === true, "overlapsAABB: corners overlap → true");
ok(Phys.overlapsAABB(
  { u: 0, v: 0 }, { w: 2, d: 2 },
  { u: 5, v: 0 }, { w: 2, d: 2 }
) === false, "overlapsAABB: separated → false");
ok(Phys.overlapsAABB(
  { u: 0, v: 0 }, { w: 2, d: 2 },
  { u: 2.001, v: 0 }, { w: 2, d: 2 }
) === false, "overlapsAABB: just past touching → false");

// 2. resolveAABBMove substeps: mover slides close to wall but does not enter
const wall = { u: 5, v: 0, hitbox: { w: 2, d: 4 } };  // wall spans u in [4, 6]
const mover = { u: 3.0, v: 0, hitbox: { w: 1, d: 1 } };
let r = Phys.resolveAABBMove(mover, 1.5, 0, [wall]);
ok(mover.u < 4.001, `mover stops before wall (u=${mover.u.toFixed(2)} < 4.0)`);
ok(r.dU < 1.5, `dU partially applied (got ${r.dU.toFixed(2)} < 1.5)`);

// Sliding along v works while u is blocked
r = Phys.resolveAABBMove(mover, 0.6, 0.5, [wall]);
ok(r.dV > 0.4, `slide along V worked (dV=${r.dV.toFixed(2)})`);

// Moving away from the wall is fully applied
const startU = mover.u;
r = Phys.resolveAABBMove(mover, -1, 0, [wall]);
ok(Math.abs(r.dU + 1) < 1e-9, `away from wall: full -1 applied (got ${r.dU.toFixed(3)})`);
ok(Math.abs(mover.u - (startU - 1)) < 1e-9, "mover.u advanced away from wall");

// Tunneling: a huge step into a wall must NOT cross it
const farMover = { u: 0, v: 0, hitbox: { w: 1, d: 1 } };
Phys.resolveAABBMove(farMover, 100, 0, [wall]);
ok(farMover.u < 4.001, `tunneling prevented (farMover.u=${farMover.u.toFixed(2)} < 4.0)`);

// 3. standingOn detects mover on top of a blocker
const box = { u: 0, v: 0, y: 0, hitbox: { w: 4, d: 4, h: 2 } };
const jumper = { u: 0, v: 0, y: 2.0, hitbox: { w: 1, d: 1, h: 1 } };
const top = Phys.standingOn(jumper, [box]);
ok(top === 2.0, `standingOn: jumper on top → ${top} (expected 2.0)`);

// And not standing if displaced sideways past footprint
const off = { u: 100, v: 0, y: 2.0, hitbox: { w: 1, d: 1, h: 1 } };
ok(Phys.standingOn(off, [box]) === null, "standingOn: outside footprint → null");

// 4. aabbFromRect helper
const a = Phys.aabbFromRect(10, -4, 16, 4, 6);
ok(a.u === 13 && a.v === 0, "aabbFromRect: center correct");
ok(a.hitbox.w === 6 && a.hitbox.d === 8 && a.hitbox.h === 6, "aabbFromRect: dims correct");

// 5. Bridge integration: applyCameraRelativeMove with blockers respects them
const world = new WorldState(1);
world.setPlayer("hero", 0, 0, 0, 3.0, 0);
const blockers = [Phys.aabbFromRect(5, -2, 7, 2, 4)];
Bridge.applyCameraRelativeMove(
  world, "hero",
  /*F*/ 0, /*R*/ 1,                  // strafe right (toward wall)
  /*forward*/ { x: 0, y: 0, z: -1 },
  /*right*/   { x: 1, y: 0, z: 0 },
  /*speed*/ 100, /*dt*/ 0.1,         // intentionally huge → would tunnel
  { blockers, heroHitbox: { w: 1, d: 1 } },
);
const h = world.players.get("hero");
ok(h.u <= 5.001, `hero stopped at wall (u=${h.u.toFixed(3)} ≤ 5.001)`);
ok(h.u >= 3.0,   "hero did not move backwards");

// 6. Without blockers, the move is unconstrained (back-compat)
world.setPlayer("hero2", 0, 0, 0, 0, 0);
Bridge.applyCameraRelativeMove(
  world, "hero2", 0, 1,
  { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 },
  10, 0.1,
);
const h2 = world.players.get("hero2");
ok(Math.abs(h2.u - 1.0) < 1e-9, "back-compat: no blockers → free move");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
