// test_iter_52.js — weather system + particle integration.
const W = require("./weather.js");
const Part = require("./particles.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

// 1. Presets
const expected = ["clear", "light_rain", "heavy_rain", "storm", "snow", "fog"];
for (const n of expected) {
  ok(W.PRESETS[n] !== undefined, `preset ${n} exists`);
}
ok(W.PRESETS.clear.visibility === 1.0, "clear = full visibility");
ok(W.PRESETS.fog.visibility < 0.5, "fog reduces visibility");
ok(W.PRESETS.storm.visibility < W.PRESETS.heavy_rain.visibility, "storm worse than heavy_rain");

// 2. createSystem defaults
const sys = W.createSystem();
ok(sys.getName() === "clear", "starts clear");
ok(sys.getIntensity() === 1.0, "intensity 1.0");

// 3. setWeather
ok(sys.setWeather("storm") === true, "set storm");
ok(sys.getName() === "storm", "now storm");
ok(sys.setWeather("nope") === false, "bad preset rejected");
ok(sys.getName() === "storm", "still storm after bad set");

// 4. setIntensity clamp
sys.setIntensity(2.0);
ok(sys.getIntensity() === 1.0, "intensity clamped at 1");
sys.setIntensity(-0.5);
ok(sys.getIntensity() === 0, "intensity clamped at 0");

// 5. tick auto-transitions on interval
const sys2 = W.createSystem({ transitionInterval: 1, initial: "clear" });
let seed = 42;
const detRng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
let r1 = sys2.tick(0.5, detRng);
ok(r1 === null, "before interval → no transition");
let r2 = sys2.tick(0.6, detRng);
ok(r2 !== null, "after interval → transition fires");

// 6. rollNext respects probabilities (run many trials, no impossible jumps)
const sys3 = W.createSystem({ initial: "snow" });
const reached = new Set();
for (let i = 0; i < 1000; i++) {
  sys3.setWeather("snow");
  const next = sys3.rollNext(Math.random);
  reached.add(next);
}
// snow can transition to: snow, clear, fog (per TRANSITIONS table)
const allowed = new Set(["snow", "clear", "fog"]);
for (const s of reached) {
  ok(allowed.has(s), `snow→${s} is allowed`);
}

// 7. emitParticles runs against a particle system
const psys = Part.createSystem();
psys.registerPreset("rain", (pos) => [{
  x: pos.x, y: pos.y, z: pos.z,
  vx: 0, vy: -10, vz: 0,
  life: 0, maxLife: 1, color: 0xaaaaff, size: 0.05,
  gravity: 0, kind: "rain",
}]);
psys.registerPreset("snow", (pos) => [{
  x: pos.x, y: pos.y, z: pos.z,
  vx: 0, vy: -1.5, vz: 0,
  life: 0, maxLife: 4, color: 0xffffff, size: 0.1,
  gravity: 0, kind: "snow",
}]);

sys.setWeather("heavy_rain");
sys.setIntensity(1.0);
const emitted = sys.emitParticles(psys, { u: 0, v: 0 }, 1.0);
// heavy_rain rate 120 × intensity 1 × dt 1 = ~120 particles. Within ±1 due to rounding.
ok(emitted >= 119 && emitted <= 121, `heavy rain ~120 particles (got ${emitted})`);

const c1 = psys.count("rain");
ok(c1 >= 119 && c1 <= 121, "rain particles in system");

// 8. clear weather → no particles
sys.setWeather("clear");
psys.clear();
const e2 = sys.emitParticles(psys, { u: 0, v: 0 }, 1.0);
ok(e2 === 0, "clear weather emits 0 particles");

// 9. snow emits with snow kind
sys.setWeather("snow");
psys.clear();
sys.emitParticles(psys, { u: 0, v: 0 }, 1.0);
ok(psys.count("snow") > 0, "snow weather emits snow particles");

// 10. intensity scales emission
sys.setWeather("light_rain");
sys.setIntensity(0.5);
psys.clear();
const e3 = sys.emitParticles(psys, { u: 0, v: 0 }, 1.0);
// light_rain rate 30 × 0.5 × 1 = 15
ok(e3 >= 14 && e3 <= 16, `intensity halved → 15 particles (got ${e3})`);

// 11. applyToScene returns diff
sys.setWeather("storm");
const scene = { applyWeather: null };
const diff = sys.applyToScene(scene);
ok(diff.skyColor.r === W.PRESETS.storm.skyTint.r, "skyColor = storm tint");
ok(diff.fogDensity > 0.5, "storm has high fog density");
ok(diff.windSpeed === W.PRESETS.storm.windSpeed, "wind matches preset");

// scene callback invoked
let weatherApplied = null;
const scene2 = { applyWeather: (d) => { weatherApplied = d; } };
sys.applyToScene(scene2);
ok(weatherApplied !== null && weatherApplied.fogDensity === diff.fogDensity,
   "scene.applyWeather callback received diff");

// 12. tryLightning only in storms
sys.setWeather("clear");
ok(sys.tryLightning() === false, "no lightning in clear");
sys.setWeather("storm");
let strikes = 0;
for (let i = 0; i < 10000; i++) if (sys.tryLightning()) strikes++;
ok(strikes > 100 && strikes < 1000, `lightning fires occasionally in storm (${strikes}/10000 ~ 5%)`);

// 13. registerPreset extends + duplicate rejected
sys.registerPreset("blizzard", {
  name: "blizzard", visibility: 0.1, skyTint: { r: 0.7, g: 0.7, b: 0.8 },
  particleEmitter: { kind: "snow", rate: 300, area: 80 }, windSpeed: 12,
});
ok(sys.setWeather("blizzard") === true, "custom blizzard usable");
let threw = false;
try { sys.registerPreset("blizzard", {}); } catch (e) { threw = true; }
ok(threw, "duplicate preset throws");

// 14. Scene callback exception isolated
const noisyScene = { applyWeather: () => { throw new Error("boom"); } };
const noErr = sys.applyToScene(noisyScene);  // should not throw
ok(noErr !== null, "scene callback exception isolated");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
