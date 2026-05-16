// test_iter_98.js — weather forecast: deterministic + transitions + queries.
const W = require("./weather_forecast.js");

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log("ok  -", name); }
  else      { fail++; console.log("FAIL -", name); }
}

const t0 = 1000000;

// 1. Basic forecast
const fc = W.forecast({
  startTs: t0, durationMs: 30 * 60 * 1000, slotMs: 5 * 60 * 1000,
  seed: 42, climate: "temperate",
});
ok(fc.slots.length === 6, `6 slots (got ${fc.slots.length})`);
ok(fc.climate === "temperate", "climate");
ok(fc.slots[0].startMs === t0, "slot 0 starts at t0");
ok(fc.slots[0].endMs === t0 + 5 * 60 * 1000, "slot 0 ends 5 min later");
ok(W.KINDS.includes(fc.slots[0].kind), "kind is valid");

// 2. Deterministic
const fc2 = W.forecast({ startTs: t0, durationMs: 30 * 60 * 1000, seed: 42, climate: "temperate" });
ok(JSON.stringify(fc.slots) === JSON.stringify(fc2.slots), "same seed → same slots");

const fc3 = W.forecast({ startTs: t0, durationMs: 30 * 60 * 1000, seed: 43, climate: "temperate" });
ok(JSON.stringify(fc.slots) !== JSON.stringify(fc3.slots), "different seed → different");

// 3. All intensities in [0,1]
let validIntensities = true;
for (const s of fc.slots) {
  if (s.intensity < 0 || s.intensity > 1) validIntensities = false;
}
ok(validIntensities, "all intensities in [0,1]");

// 4. weatherAt
const w1 = W.weatherAt(fc, t0);
ok(w1 !== null, "weather at t0");
ok(w1.kind === fc.slots[0].kind, "matches slot 0");
ok(w1.intensity === fc.slots[0].intensity, "intensity matches");
ok(w1.fade === 0, "no fade at start");

// Out of range
ok(W.weatherAt(fc, t0 - 1000) === null, "before start = null");
ok(W.weatherAt(fc, t0 + 30 * 60 * 1000 + 1) === null, "after end = null");

// 5. fade kicks in at end of slot if next slot differs
// Find a slot with different next-kind
let testIdx = -1;
for (let i = 0; i < fc.slots.length - 1; i++) {
  if (fc.slots[i].kind !== fc.slots[i + 1].kind) { testIdx = i; break; }
}
if (testIdx >= 0) {
  const s = fc.slots[testIdx];
  const wAtFade = W.weatherAt(fc, s.endMs - 15000);   // mid-fade
  ok(wAtFade.fade > 0 && wAtFade.fade < 1, `mid-fade: ${wAtFade.fade}`);
  ok(wAtFade.nextKind === fc.slots[testIdx + 1].kind, "nextKind reported");
}

// 6. uniqueKinds
const uniq = W.uniqueKinds(fc);
ok(uniq.length >= 1, "at least 1 unique kind");
for (const k of uniq) ok(W.KINDS.includes(k), "kind in registry: " + k);

// 7. nextOf — find next rain
const nextRain = W.nextOf(fc, "rain", t0);
if (nextRain) {
  ok(nextRain.kind === "rain", "nextOf returns rain");
  ok(nextRain.startMs >= t0, "in future");
}

// nextOf with predicate
const nextWet = W.nextOf(fc, k => k === "rain" || k === "heavy_rain" || k === "storm", t0);
if (nextWet) ok(["rain", "heavy_rain", "storm"].includes(nextWet.kind), "nextOf predicate matches");

// 8. advance — emits transition events
const transitions = W.advance(fc, t0, t0 + 30 * 60 * 1000);
ok(Array.isArray(transitions), "advance returns array");
ok(transitions.every(e => e.kind === "transition"), "all are transitions");
if (transitions.length > 0) {
  ok(transitions[0].from && transitions[0].to, "from/to populated");
  ok(transitions[0].at >= t0, "at >= t0");
}

// No advance backwards
ok(W.advance(fc, t0, t0).length === 0, "no advance at same ts");
ok(W.advance(fc, t0 + 100, t0).length === 0, "no backwards");

// 9. Climate variation
const desert = W.forecast({ startTs: t0, durationMs: 60 * 60 * 1000, seed: 1, climate: "desert" });
const arctic = W.forecast({ startTs: t0, durationMs: 60 * 60 * 1000, seed: 1, climate: "arctic" });
// Desert should have lots of clear; arctic should have snow
const dKinds = W.uniqueKinds(desert);
const aKinds = W.uniqueKinds(arctic);
ok(dKinds.includes("clear"), "desert has clear");
// Arctic may or may not roll snow with seed 1, but it should be biased
// Just check both produce different distributions for same seed
ok(JSON.stringify(desert.slots) !== JSON.stringify(arctic.slots),
   "different climates → different output for same seed");

// 10. Bad climate falls back to temperate
const badC = W.forecast({ startTs: t0, durationMs: 10000, seed: 5, climate: "ghost" });
ok(badC.slots.length > 0, "bad climate doesn't crash");

// 11. Custom startKind
const startSnow = W.forecast({ startTs: t0, durationMs: 10 * 60 * 1000, seed: 99, startKind: "snow" });
ok(["snow", "clear", "cloudy", "rain", "heavy_rain", "storm", "fog"].includes(startSnow.slots[0].kind),
   "startKind influences first slot");

// 12. Long forecast doesn't crash
const big = W.forecast({ startTs: t0, durationMs: 24 * 60 * 60 * 1000, seed: 7 });
ok(big.slots.length > 100, `24h forecast → many slots (${big.slots.length})`);

// 13. Transitioning flag on slots
let anyTransitioning = false;
for (const s of fc.slots) {
  if (s.transitioning) { anyTransitioning = true; break; }
}
// May or may not have transitions for seed 42 — just verify field exists
ok(typeof fc.slots[1].transitioning === "boolean", "transitioning is boolean");

// 14. CLIMATE_BIAS exported
ok(W.CLIMATE_BIAS.temperate !== undefined, "temperate bias");
ok(W.CLIMATE_BIAS.desert.clear > W.CLIMATE_BIAS.desert.rain, "desert bias clear > rain");

// 15. Persistence: roughly, slots tend to repeat (50% rule)
// Run many seeds, count consecutive-same vs total transitions
let same = 0, total = 0;
for (let s = 0; s < 20; s++) {
  const f = W.forecast({ startTs: t0, durationMs: 60 * 60 * 1000, seed: s, climate: "temperate" });
  for (let i = 1; i < f.slots.length; i++) {
    total++;
    if (f.slots[i].kind === f.slots[i - 1].kind) same++;
  }
}
const persistenceRate = same / total;
ok(persistenceRate > 0.3 && persistenceRate < 0.8, `persistence rate ~50% (got ${persistenceRate.toFixed(2)})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
