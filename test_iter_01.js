// test_iter_01.js — headless smoke for the bridge.
// Run: node gta_demo/test_iter_01.js
const path = require("path");
const Bridge = require("./engine_bridge.js");
const { WorldState } = require(path.join(__dirname, "..", "multi_dim_engine_skeleton", "world_state.js"));

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. engine→render mapping is u→x, v→z
const p = { x: 0, y: 1, z: 0, u: 5, v: 7 };
const r = Bridge.engineToRenderPos(p);
ok(r.x === 5 && r.z === 7 && r.y === 1, "engineToRenderPos: u→x, v→z, y preserved");

// 2. render→engine inverse
const back = Bridge.renderToEngineUV({ x: 5, y: 1, z: 7 });
ok(back.u === 5 && back.v === 7 && back.y === 1, "renderToEngineUV: round-trip");

// 3. camera-relative move: forward=(0,0,-1) right=(1,0,0); inputF=1, inputR=0 should advance -z
const w = new WorldState(1);
w.setPlayer("hero", 0, 0, 0, 0, 0);
Bridge.applyCameraRelativeMove(
  w, "hero",
  /*F*/ 1, /*R*/ 0,
  /*forward*/ { x: 0, y: 0, z: -1 },
  /*right*/   { x: 1, y: 0, z:  0 },
  /*speed*/ 5, /*dt*/ 0.1,
);
const ph = w.players.get("hero");
ok(Math.abs(ph.v - (-0.5)) < 1e-9, "applyCameraRelativeMove: F=1 → v decreases by speed*dt");
ok(Math.abs(ph.u - 0) < 1e-9, "applyCameraRelativeMove: R=0 → u unchanged");

// 4. strafe right
w.setPlayer("hero", 0, 0, 0, 0, 0);
Bridge.applyCameraRelativeMove(
  w, "hero",
  0, 1,
  { x: 0, y: 0, z: -1 },
  { x: 1, y: 0, z:  0 },
  5, 0.1,
);
const ph2 = w.players.get("hero");
ok(Math.abs(ph2.u - 0.5) < 1e-9, "strafe right: R=1 → u increases by speed*dt");
ok(Math.abs(ph2.v - 0) < 1e-9, "strafe right: v unchanged");

// 5. diagonal move is normalized (no speed boost)
w.setPlayer("hero", 0, 0, 0, 0, 0);
Bridge.applyCameraRelativeMove(
  w, "hero",
  1, 1,
  { x: 0, y: 0, z: -1 },
  { x: 1, y: 0, z:  0 },
  10, 0.1,
);
const ph3 = w.players.get("hero");
const dist = Math.hypot(ph3.u, ph3.v);
ok(Math.abs(dist - 1.0) < 1e-6, "diagonal move normalized to speed*dt magnitude");

// 6. chase camera sits behind the character (yaw=0 → camera at -z)
const cam0 = Bridge.chaseCameraPos({ x: 0, y: 0, z: 0 }, 0, 5, 2);
ok(Math.abs(cam0.x) < 1e-9 && Math.abs(cam0.z + 5) < 1e-9 && Math.abs(cam0.y - 2) < 1e-9,
   "chase cam at yaw=0 sits at (0, height, -dist)");

// 7. yaw=π/2 → camera at -x (behind a character facing +x)
const cam90 = Bridge.chaseCameraPos({ x: 0, y: 0, z: 0 }, Math.PI / 2, 5, 2);
ok(Math.abs(cam90.x + 5) < 1e-6 && Math.abs(cam90.z) < 1e-6,
   "chase cam at yaw=π/2 sits at (-dist, _, 0)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
