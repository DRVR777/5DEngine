// test_iter_05.js — pickups + day/night cycle.
// Run: node gta_demo/test_iter_05.js
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

ok(typeof Bridge.collectPickup === "function", "collectPickup exported");
ok(typeof Bridge.dayNightPhase === "function", "dayNightPhase exported");

const world = new WorldState(1);
world.setPlayer("hero", 0, 0, 0, 0, 0);
const pickups = [
  { id: "a", u: 0.5, v: 0.5, collected: false },
  { id: "b", u: 10,  v: 10,  collected: false },
  { id: "c", u: 0.0, v: 1.0, collected: false },
];

// First call collects 'a' (in radius)
const c1 = Bridge.collectPickup(world, "hero", pickups, 1.0);
ok(c1 === "a", `first collect=${c1} (expected 'a')`);
ok(pickups[0].collected === true, "'a' marked collected");

// Second call same tick collects 'c' (also in radius)
const c2 = Bridge.collectPickup(world, "hero", pickups, 1.5);
ok(c2 === "c", `second collect=${c2} (expected 'c')`);

// Third call no more in radius
const c3 = Bridge.collectPickup(world, "hero", pickups, 1.5);
ok(c3 === null, `third collect=${c3} (expected null)`);

// 'b' at distance 14 not collected by radius 1.5
ok(pickups[1].collected === false, "'b' not collected (out of radius)");

// Missing player → null, no throw
ok(Bridge.collectPickup(world, "ghost", pickups, 99) === null, "missing player returns null");

// Day-night phase
const noon = Bridge.dayNightPhase(15, 60); // phase 0.25 = sunrise (sun.y peak)
ok(noon.sun.y > 0.5, `noon sun is high (sun.y=${noon.sun.y.toFixed(2)})`);
ok(noon.dayMix > 0.8, `noon dayMix near 1 (=${noon.dayMix.toFixed(2)})`);

const midnight = Bridge.dayNightPhase(45, 60); // phase 0.75
ok(midnight.sun.y < 0, `midnight sun is below horizon (sun.y=${midnight.sun.y.toFixed(2)})`);
ok(midnight.dayMix < 0.1, `midnight dayMix near 0 (=${midnight.dayMix.toFixed(2)})`);

ok(midnight.fog > noon.fog, `night has more fog than day (${midnight.fog} > ${noon.fog})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
