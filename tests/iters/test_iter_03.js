// test_iter_03.js — NPC wander + arena clamp.
// Run: node gta_demo/test_iter_03.js
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

// Deterministic rng for reproducibility
let seed = 1;
function rng() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; }

const world = new WorldState(1);
world.setPlayer("npc", 0, 0, 0, 0, 0);

// Wander 200 ticks; expect movement is non-trivial but bounded
let heading = 0;
for (let i = 0; i < 200; i++) {
  heading = Bridge.wanderStep(world, "npc", heading, 2.0, 0.05, rng);
}
const p = world.players.get("npc");
const dist = Math.hypot(p.u, p.v);
ok(dist > 0.5, `wander produced movement (dist=${dist.toFixed(2)})`);
ok(dist < 30,  `wander stayed roughly local (dist=${dist.toFixed(2)} < 30)`);

// Arena clamp: push way out then clamp
world.setPlayer("npc", 0, 0, 0, 999, -999);
Bridge.clampToArena(world, "npc", 30);
const p2 = world.players.get("npc");
ok(p2.u === 30 && p2.v === -30, "clampToArena pulls back to ±half on both axes");

// Clamp is no-op when inside
world.setPlayer("npc", 0, 0, 0, 5, -10);
Bridge.clampToArena(world, "npc", 30);
const p3 = world.players.get("npc");
ok(p3.u === 5 && p3.v === -10, "clampToArena is a no-op inside the arena");

// Determinism: same seed → same path
seed = 42;
const w2 = new WorldState(1); w2.setPlayer("a", 0, 0, 0, 0, 0);
let h = 0;
for (let i = 0; i < 50; i++) h = Bridge.wanderStep(w2, "a", h, 1, 0.1, rng);
const a1 = w2.players.get("a");

seed = 42;
const w3 = new WorldState(1); w3.setPlayer("a", 0, 0, 0, 0, 0);
let h2 = 0;
for (let i = 0; i < 50; i++) h2 = Bridge.wanderStep(w3, "a", h2, 1, 0.1, rng);
const a2 = w3.players.get("a");

ok(Math.abs(a1.u - a2.u) < 1e-9 && Math.abs(a1.v - a2.v) < 1e-9,
   "wanderStep is deterministic given a deterministic rng");

ok(typeof Bridge.wanderStep === "function" && /iter\d+/.test(Bridge.VERSION),
   "Bridge has wanderStep and a tagged VERSION");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
