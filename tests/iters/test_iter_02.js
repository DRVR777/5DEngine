// test_iter_02.js — exercise the browser engine + bridge integration headlessly.
// Run: node gta_demo/test_iter_02.js
//
// Loads engine_browser.js into a fake window, then drives a player through
// a building boundary and verifies the engine logs a transition.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Bridge = require("./engine_bridge.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// Load engine_browser.js into a sandbox with `self` (it attaches to GTAEngine)
const code = fs.readFileSync(path.join(__dirname, "engine_browser.js"), "utf8");
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const { WorldState, LayerBoundary } = sandbox.self.GTAEngine;
ok(typeof WorldState === "function", "engine_browser.js exposes WorldState");
ok(typeof LayerBoundary === "function", "engine_browser.js exposes LayerBoundary");

// Build a world + a single rect building
const world = new WorldState(1);
world.setPlayer("hero", 0, 0, 0, 0, 0);
const shop = new LayerBoundary(2, "rect", { u0: 10, v0: -4, u1: 16, v1: 4 });

// Walk hero from (0,0) toward (12, 0) — should enter shop boundary partway.
let entered = false;
for (let i = 0; i < 200; i++) {
  Bridge.applyCameraRelativeMove(
    world, "hero",
    1, 0,
    { x: 1, y: 0, z: 0 }, // "forward" pointing +u
    { x: 0, y: 0, z: 1 },
    5, 0.05,
  );
  const h = world.players.get("hero");
  const inside = world.boundaryAt(h.u, h.v, [shop]);
  if (inside && inside.targetLayerId === 2 && !entered) {
    entered = true;
    world.logTransition("hero", world.layerId, inside.targetLayerId, "phase_shift");
  }
}
ok(entered, "hero crossed into shop boundary while walking +u");
ok(world.layerId === 2, "world.layerId flipped to 2 after transition logged");
ok(world.transitions.length === 1, "exactly one transition recorded for the crossing");
ok(world.transitions[0].kind === "phase_shift", "transition kind is phase_shift");

// Render mapping should put hero render.x === hero.u
const h = world.players.get("hero");
const r = Bridge.engineToRenderPos(h);
ok(Math.abs(r.x - h.u) < 1e-9 && Math.abs(r.z - h.v) < 1e-9,
   "render position tracks engine u/v");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
