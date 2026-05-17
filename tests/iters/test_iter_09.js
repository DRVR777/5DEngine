// test_iter_09.js — per-world physics profile (gravity, time scale, jump).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const PP   = require("./physics_profile.js");
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

// 1. Built-in profiles
ok(PP.get("earth").gravity === -25, "earth gravity = -25");
ok(PP.get("moon").gravity === -4,   "moon gravity = -4");
ok(PP.get("underwater").gravity === -2, "underwater gravity = -2");
ok(PP.get("dreamworld").timeScale === 0.5, "dreamworld time half-speed");
ok(PP.get("nonexistent").name === "earth", "missing profile falls back to earth");

// 2. Custom profile registration
PP.register("zerog", { gravity: 0, timeScale: 1, walkSpeed: 3, sprintSpeed: 6, jumpVelocity: 0 });
ok(PP.get("zerog").gravity === 0, "registered custom profile");
let threw = false;
try { PP.register("earth", {}); } catch (e) { threw = true; }
ok(threw, "duplicate registration throws");

// 3. Apply gravity over time — earth should fall faster than moon
let earth = { y: 10, vy: 0 }, moon = { y: 10, vy: 0 };
for (let i = 0; i < 30; i++) {
  const e = PP.applyGravity(PP.get("earth"), earth.y, earth.vy, 1/60);
  const m = PP.applyGravity(PP.get("moon"),  moon.y,  moon.vy,  1/60);
  earth.y = e.y; earth.vy = e.velocityY;
  moon.y  = m.y; moon.vy  = m.velocityY;
}
ok(earth.y < moon.y, `after 0.5s, earth fell more than moon (earth=${earth.y.toFixed(2)}, moon=${moon.y.toFixed(2)})`);

// 4. Gravity respects floor — never goes below
let g = { y: 5, vy: 0 };
for (let i = 0; i < 600; i++) {
  const r = PP.applyGravity(PP.get("earth"), g.y, g.vy, 1/60);
  g.y = r.y; g.vy = r.velocityY;
}
ok(g.y === 0, `falls to floor and stops (y=${g.y})`);
ok(g.vy === 0, "velocity zeroed on landing");

// 5. tryJump only works when grounded
let j = PP.tryJump(PP.get("earth"), 0, 0);
ok(j.jumped === true && j.velocityY === 8, `jump from ground: vy=${j.velocityY}`);
j = PP.tryJump(PP.get("earth"), 5, 0);
ok(j.jumped === false, "no jump while airborne");
j = PP.tryJump(PP.get("moon"), 0, 0);
ok(j.velocityY === 12, `moon jump higher (vy=${j.velocityY})`);

// 6. Time scale: dreamworld plays at 0.5x — ball should fall slower
let earthFall = { y: 10, vy: 0 }, dreamFall = { y: 10, vy: 0 };
for (let i = 0; i < 30; i++) {
  const e = PP.applyGravity(PP.get("earth"),       earthFall.y, earthFall.vy, 1/60);
  const d = PP.applyGravity(PP.get("dreamworld"),  dreamFall.y, dreamFall.vy, 1/60);
  earthFall.y = e.y; earthFall.vy = e.velocityY;
  dreamFall.y = d.y; dreamFall.vy = d.velocityY;
}
ok(dreamFall.y > earthFall.y, `dreamworld 0.5x time → falls slower (dream=${dreamFall.y.toFixed(2)} > earth=${earthFall.y.toFixed(2)})`);

// 7. WorldState carries its own physics profile + origin + worldId
const w1 = new WorldState(1);
ok(w1.physicsProfile.name === "earth", "default world profile is earth");
ok(typeof w1.worldId === "string" && w1.worldId.length > 0, "worldId auto-generated");
const w2 = new WorldState(1, { physicsProfile: PP.get("moon"), worldId: "moon_base" });
ok(w2.physicsProfile.name === "moon", "explicit profile honored");
ok(w2.worldId === "moon_base", "explicit worldId honored");

// 8. zerog: gravity = 0 → no fall
let z = { y: 10, vy: 0 };
for (let i = 0; i < 60; i++) {
  const r = PP.applyGravity(PP.get("zerog"), z.y, z.vy, 1/60);
  z.y = r.y; z.vy = r.velocityY;
}
ok(z.y === 10, `zerog: y stayed at 10 (got ${z.y})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
