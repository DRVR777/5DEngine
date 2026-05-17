// test_iter_47.js — particle system: emit, tick, retire, presets.
const Part = require("./particles.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. PRESETS exposed
ok(typeof Part.PRESETS.muzzleFlash === "function", "muzzleFlash preset");
ok(typeof Part.PRESETS.bulletHit === "function", "bulletHit preset");
ok(typeof Part.PRESETS.explosion === "function", "explosion preset");
ok(typeof Part.PRESETS.smoke === "function", "smoke preset");

// 2. emit muzzle flash spawns particles
const sys = Part.createSystem();
const n1 = sys.emit("muzzleFlash", { x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 });
ok(n1 === 6, `muzzleFlash spawns 6 particles (got ${n1})`);
ok(sys.particles.length === 6, "6 particles in system");
ok(sys.count("muzzleFlash") === 6, "count by kind works");

// 3. Each particle has the required fields
const p0 = sys.particles[0];
ok(typeof p0.x === "number" && typeof p0.y === "number" && typeof p0.z === "number", "position");
ok(typeof p0.vx === "number" && typeof p0.vy === "number" && typeof p0.vz === "number", "velocity");
ok(typeof p0.life === "number" && typeof p0.maxLife === "number", "life");
ok(typeof p0.color === "number", "color");
ok(typeof p0.size === "number", "size");
ok(p0.kind === "muzzleFlash", "kind");

// 4. tick advances + ages
sys.tick(0.05);
ok(sys.particles[0].life > 0, "life accumulates");

// 5. Particles eventually retire
const before = sys.particles.length;
for (let i = 0; i < 50; i++) sys.tick(0.05);
ok(sys.particles.length === 0, `all muzzleFlash retired after 2.5s (got ${sys.particles.length})`);

// 6. bulletHit
sys.emit("bulletHit", { x: 5, y: 1, z: 0 });
ok(sys.count("bulletHit") === 12, "bulletHit spawns 12 particles");

// 7. Gravity pulls particles down
const above = sys.particles.find(p => p.y > 0);
const initialY = above.y, initialVy = above.vy;
sys.tick(0.1);
// Velocity should have decreased (gravity), and y advanced by (initialVy * dt)
ok(above.vy < initialVy, `vy decreased due to gravity (${above.vy.toFixed(2)} < ${initialVy.toFixed(2)})`);

// 8. Floor collision bounces
const high = { x: 0, y: 0.001, z: 0, vx: 0, vy: -5, vz: 0,
                life: 0, maxLife: 1, color: 0, size: 1, gravity: 0, kind: "test" };
sys.particles.push(high);
sys.tick(0.01);  // small step: vy*-dt = -0.05, lands below 0
ok(high.y === 0, "particle clamps at floor");
ok(high.vy > 0, `vy flipped for bounce (got ${high.vy.toFixed(2)})`);
ok(high.vy < 5, "energy lost on bounce");
sys.particles.pop();

// 9. explosion is big
sys.clear();
sys.emit("explosion", { x: 0, y: 0, z: 0 });
ok(sys.count("explosion") === 40, "explosion spawns 40 particles");

// 10. maxParticles cap
const sys2 = Part.createSystem({ maxParticles: 5 });
const accepted = sys2.emit("muzzleFlash", { x: 0, y: 0, z: 0 });
ok(accepted === 5, `cap accepts only 5 of 6 (got ${accepted})`);
ok(sys2.particles.length === 5, "system has 5");
const accepted2 = sys2.emit("muzzleFlash", { x: 0, y: 0, z: 0 });
ok(accepted2 === 0, "no room → 0 accepted");

// 11. Unknown preset → 0
ok(sys.emit("ghost", { x: 0, y: 0, z: 0 }) === 0, "unknown preset → 0");

// 12. registerPreset extends + duplicate rejected
sys.clear();
sys.registerPreset("sparkle", (pos) => [{
  x: pos.x, y: pos.y, z: pos.z,
  vx: 0, vy: 1, vz: 0, life: 0, maxLife: 0.5,
  color: 0xff00ff, size: 0.1, gravity: 0, kind: "sparkle",
}]);
const r = sys.emit("sparkle", { x: 0, y: 0, z: 0 });
ok(r === 1, "custom preset emits");
ok(sys.count("sparkle") === 1, "1 sparkle");
let threw = false;
try { sys.registerPreset("sparkle", () => []); } catch (e) { threw = true; }
ok(threw, "duplicate preset throws");

// 13. clear
sys.clear();
ok(sys.particles.length === 0, "clear empties");

// 14. count without kind = total
sys.emit("muzzleFlash", { x: 0, y: 0, z: 0 });
sys.emit("bulletHit", { x: 1, y: 0, z: 0 });
ok(sys.count() === 18, `total count = 6 + 12 = 18 (got ${sys.count()})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
