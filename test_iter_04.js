// test_iter_04.js — car physics + uvDist proximity.
// Run: node gta_demo/test_iter_04.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Bridge = require("./engine_bridge.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const { WorldState } = sandbox.self.GTAEngine;

ok(typeof Bridge.carPhysicsStep === "function", "carPhysicsStep exported");
ok(typeof Bridge.uvDist === "function", "uvDist exported");
ok(/iter\d+/.test(Bridge.VERSION), `VERSION carries iter tag (got ${Bridge.VERSION})`);

const world = new WorldState(1);
world.setPlayer("car", 0, 0, 0, 0, 0);

// Throttle forward → should accelerate and move along heading=0 (which is +v)
let st = { speed: 0, heading: 0 };
for (let i = 0; i < 60; i++) st = Bridge.carPhysicsStep(world, "car", st, 1, 0, 1/60);
ok(st.speed > 5, `accelerated forward to ${st.speed.toFixed(2)} m/s after 1s`);
const p = world.players.get("car");
ok(p.v > 0 && Math.abs(p.u) < 0.5, `car moved along +v (u=${p.u.toFixed(2)}, v=${p.v.toFixed(2)})`);

// Steer left while moving → heading should change
const headingBefore = st.heading;
for (let i = 0; i < 60; i++) st = Bridge.carPhysicsStep(world, "car", st, 1, 1, 1/60);
ok(Math.abs(st.heading - headingBefore) > 0.3,
   `steering changed heading by ${(st.heading - headingBefore).toFixed(2)} rad`);

// Brake to a stop
for (let i = 0; i < 120; i++) st = Bridge.carPhysicsStep(world, "car", st, -1, 0, 1/60);
ok(st.speed < 1 || st.speed > -10, `brake clamped speed (now ${st.speed.toFixed(2)})`);

// Speed cap
let st2 = { speed: 0, heading: 0 };
for (let i = 0; i < 600; i++) st2 = Bridge.carPhysicsStep(world, "car", st2, 1, 0, 1/60);
ok(st2.speed <= 18 + 0.1, `MAX_S cap holds (top=${st2.speed.toFixed(2)} ≤ 18)`);

// Proximity test
world.setPlayer("hero", 0, 0, 0, 0, 0);
world.setPlayer("car",  0, 0, 0, 1, 1);
ok(Math.abs(Bridge.uvDist(world, "hero", "car") - Math.SQRT2) < 1e-9,
   "uvDist computes 5D-ground euclidean correctly");

world.setPlayer("car",  0, 0, 0, 100, 100);
ok(Bridge.uvDist(world, "hero", "car") > 50, "uvDist scales with distance");

ok(Bridge.uvDist(world, "hero", "ghost") === Infinity,
   "uvDist returns Infinity for missing players");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
