// test_iter_18.js — plane flight physics + plane vehicle build.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Bridge  = require("./engine_bridge.js");
const Vehicle = require("./vehicle.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sb = { self: {} }; vm.createContext(sb); vm.runInContext(code, sb);
const { WorldState } = sb.self.GTAEngine;

ok(typeof Bridge.planePhysicsStep === "function", "planePhysicsStep exported");

// 1. Throttle accelerates the plane on the ground (no pitch yet)
const w = new WorldState(1);
w.setPlayer("plane", 0, 0, 0, 0, 0);
let st = { speed: 0, heading: 0, pitch: 0, altitude: 0 };
for (let i = 0; i < 60; i++) st = Bridge.planePhysicsStep(w, "plane", st, 1, 0, 0, 1/60);
ok(st.speed > 10, `accelerated to ${st.speed.toFixed(2)} after 1s`);
ok(st.altitude === 0, "no pitch → no altitude gain");

// 2. Pitch up at speed → altitude climbs
for (let i = 0; i < 120; i++) st = Bridge.planePhysicsStep(w, "plane", st, 1, 1, 0, 1/60);
ok(st.altitude > 5, `climbed (alt=${st.altitude.toFixed(2)})`);
ok(st.pitch > 0.4, `pitch held positive (${st.pitch.toFixed(2)})`);

// 3. Pitch capped at MAX_PITCH (=0.6)
ok(st.pitch <= 0.61, `pitch capped near 0.6 (got ${st.pitch.toFixed(2)})`);

// 4. Speed capped at MAX_S (=60)
let st2 = { speed: 0, heading: 0, pitch: 0, altitude: 0 };
for (let i = 0; i < 600; i++) st2 = Bridge.planePhysicsStep(w, "plane", st2, 1, 0, 0, 1/60);
ok(st2.speed <= 60.1, `speed capped at 60 (got ${st2.speed.toFixed(2)})`);

// 5. Yaw at speed turns the heading
let st3 = { speed: 60, heading: 0, pitch: 0, altitude: 30 };
const heading0 = st3.heading;
for (let i = 0; i < 60; i++) st3 = Bridge.planePhysicsStep(w, "plane", st3, 1, 0, 1, 1/60);
ok(Math.abs(st3.heading - heading0) > 0.5, `heading turned (Δ=${(st3.heading - heading0).toFixed(2)})`);

// 6. Altitude floors at 0 (no underground)
let st4 = { speed: 60, heading: 0, pitch: -1, altitude: 5 };
for (let i = 0; i < 240; i++) st4 = Bridge.planePhysicsStep(w, "plane", st4, 1, -1, 0, 1/60);
ok(st4.altitude === 0, `pitch down lands at 0 (alt=${st4.altitude})`);

// 7. Plane vehicle from parts (iter 16 integration)
const plane = Vehicle.buildVehicle([
  "part_body_plane", "part_engine_jet",
  "part_wheel_stock", "part_wheel_stock", "part_wheel_stock",
]);
ok(plane.kind === "plane", "buildVehicle → kind=plane");
ok(plane.complete === true, "plane build is complete with 3 wheels");
ok(plane.stats.topSpeed === 80, "plane stat topSpeed=80 from jet engine");

// 8. Engine plumbing on world.players matches the plane state
const player = w.players.get("plane");
ok(player.y === st4.altitude, `world.players.y tracks altitude (got ${player.y})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
