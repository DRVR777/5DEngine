#!/usr/bin/env node
/** tools/test_legacy_bridge.mjs
 *
 *  End-to-end proof the legacy-mount base layer works.
 *
 *  Stands up a minimal in-memory ThingRegistry, registers the
 *  legacy-mount facet handler, spawns one legacy-system Thinga,
 *  awaits the dynamic import, ticks a few frames, and verifies the
 *  legacy module's logic ran against substrate state.
 *
 *  Validates:
 *    - binding DSL: $kind / $tuning / $const / $noop / $log
 *    - tick-arg resolution: @dt / @nowSec
 *    - get returns substrate-current values
 *    - set writes back into substrate state
 *    - the legacy module's tick is actually invoked
 *
 *  Run: node tools/test_legacy_bridge.mjs */

import { createDefaultRegistry } from "../experimental/holograph-runtime/src/registry.js";
import legacyMount from "../src/ankhor/facets/legacy_mount.js";

// minimal global stand-in so legacy-mount's init doesn't bail
globalThis.window = globalThis;

const registry = createDefaultRegistry();
registry.registerFacetHandler("legacy-mount", legacyMount);
registry.registerFacetHandler("health",       { priority: 25 });
registry.registerFacetHandler("tuning",       { priority: 41 });

// scaffold: one hero with health, one tuning Thinga with regen params,
// then one legacy-system that hosts hero-regen.
registry.spawn({
  id: "hero/main", kind: "hero", name: "hero",
  facets: [{ name: "health", data: { hp: 60, maxHp: 100 } }],
});
registry.spawn({
  id: "tuning/hero", kind: "tuning", name: "hero-tuning",
  facets: [{ name: "tuning", data: { regen_delay_seconds: 0, regen_rate_per_second: 10 } }],
});

const spec = {
  module_url: new URL("../src/systems/hero_regen_tick.js", import.meta.url).href,
  export:     "mountHeroRegenTick",
  tick_args:  ["@dt", { nowSec: "@nowSec" }],
  bindings: {
    "get.heroHp":         "$kind:hero[0]/health/hp",
    "get.maxHp":          "$kind:hero[0]/health/maxHp",
    "get.perkMaxHpBonus": "$const:0",
    "get.lastDamageT":    "$const:0",
    "get.regenDelay":     "$tuning:hero-tuning/tuning/regen_delay_seconds",
    "get.regenRate":      "$tuning:hero-tuning/tuning/regen_rate_per_second",
    "get.perkRegenBonus": "$const:0",
    "set.heroHp":         "$kind:hero[0]/health/hp",
    "set.nearDeathFired": "$noop",
  },
};

registry.spawn({
  id: "legacy/hero-regen", kind: "legacy-system", name: "legacy_hero_regen",
  facets: [{ name: "legacy-mount", data: spec }],
});

const data = registry.facetData("legacy/hero-regen", "legacy-mount");
if (!data._import_promise) throw new Error("init did not start the import");

await data._import_promise;
if (!data._ready) throw new Error("import resolved but legacy mount did not bind: " + (data._failed ? "FAILED" : "no _tick"));
if (typeof data._tick !== "function") throw new Error("captured tick is not a function");

const before = registry.facetData("hero/main", "health").hp;
console.log(`[test] hp before = ${before}`);

for (let i = 0; i < 5; i++) registry.tick(0.5);  // 5 frames of 0.5s each

const after = registry.facetData("hero/main", "health").hp;
console.log(`[test] hp after 5 frames @ 0.5s = ${after}`);

if (after <= before)        throw new Error(`hp did not regen: ${before} -> ${after}`);
if (after > 100)            throw new Error(`hp exceeded maxHp: ${after}`);
const expected = Math.min(100, before + 10 * 0.5 * 5);
if (Math.abs(after - expected) > 0.01) throw new Error(`unexpected hp: ${after} (expected ${expected})`);

console.log(`[test] PASS — legacy-mount bridge regenerated hero hp via cloned legacy module.`);

/* ---------- batch-binding test (iter 758) ---------- */
// Verifies every spec in data/spawns/legacy_systems.json binds without
// _failed and ticks once without throwing. Doesn't verify semantic
// correctness — that requires per-mount visual / state inspection —
// only the wiring is checked here.

import { readFileSync, readdirSync } from "node:fs";
const LEGACY_DIR = new URL("../data/legacy/", import.meta.url);
const specs = readdirSync(LEGACY_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => {
    const t = JSON.parse(readFileSync(new URL(f, LEGACY_DIR), "utf8"));
    return { id: t.id, name: t.name, mount: t.facets.find((x) => x.name === "legacy-mount")?.data };
  })
  .filter((s) => s.mount && s.id !== "legacy/hero-regen");  // hero-regen already covered above

console.log(`[test] batch: ${specs.length} additional legacy specs`);

const batchRegistry = createDefaultRegistry();
batchRegistry.registerFacetHandler("legacy-mount", legacyMount);
batchRegistry.registerFacetHandler("health",       { priority: 25 });
batchRegistry.registerFacetHandler("tuning",       { priority: 41 });

// minimal scene so $kind:hero / $tuning:hero-tuning resolve where needed
batchRegistry.spawn({
  id: "hero/main", kind: "hero", name: "hero",
  facets: [{ name: "health", data: { hp: 60, maxHp: 100 } }],
});
batchRegistry.spawn({
  id: "tuning/hero", kind: "tuning", name: "hero-tuning",
  facets: [{ name: "tuning", data: { regen_delay_seconds: 0, regen_rate_per_second: 10 } }],
});
// synthetic input so $input:<key> atoms have something to resolve against
batchRegistry.registerFacetHandler("input-state", { priority: 2 });
batchRegistry.spawn({
  id: "input/main", kind: "input", name: "primary_input",
  facets: [{ name: "input-state", data: { keys: { KeyW: true, ShiftLeft: true }, mouseHeld: false, yaw: 0 } }],
});

// register no-op handlers so $emit template kinds spawn cleanly
batchRegistry.registerFacetHandler("position",    { priority: 10 });
batchRegistry.registerFacetHandler("mesh",        { priority: 70 });
batchRegistry.registerFacetHandler("ttl",         { priority: 80 });
batchRegistry.registerFacetHandler("expand-fade", { priority: 60 });

for (const s of specs) {
  // Rewrite module_url to an absolute file URL (the file in spawns has a
  // browser-relative path that doesn't resolve under Node).
  const absUrl = new URL("../" + s.mount.module_url.replace(/^\.\//, ""), import.meta.url).href;
  const liveSpec = { ...s.mount, module_url: absUrl };
  batchRegistry.spawn({
    id: s.id, kind: "legacy-system", name: s.name,
    facets: [{ name: "legacy-mount", data: liveSpec }],
  });
}

// wait for every async import
for (const s of specs) {
  const d = batchRegistry.facetData(s.id, "legacy-mount");
  if (d._import_promise) await d._import_promise;
}

let bound = 0, failed = [], notReady = [];
for (const s of specs) {
  const d = batchRegistry.facetData(s.id, "legacy-mount");
  if (d._failed) failed.push(s.id);
  else if (!d._ready) notReady.push(s.id);
  else bound++;
}

// tick once
try { batchRegistry.tick(0.5); } catch (e) {
  throw new Error(`batch tick threw: ${e.message}`);
}

console.log(`[test] batch result: ${bound}/${specs.length} bound`);
if (failed.length)   console.log(`[test] FAILED: ${failed.join(", ")}`);
if (notReady.length) console.log(`[test] NOT READY: ${notReady.join(", ")}`);

if (failed.length || notReady.length) {
  console.log(`[test] FAIL — some legacy specs did not bind cleanly.`);
  process.exit(1);
}
console.log(`[test] PASS — all ${specs.length} additional legacy specs bound and ticked.`);

/* ---------- input-driven semantic test (iter 759) ---------- */
// With KeyW + ShiftLeft held in the synthetic input, stamina should
// drain when ticked, footstep timer should ALSO drain (then re-arm).

const stamSpec = specs.find((s) => s.id === "legacy/stamina");
const footSpec = specs.find((s) => s.id === "legacy/footstep-sound");
if (stamSpec && footSpec) {
  const sd = batchRegistry.facetData("legacy/stamina", "legacy-mount");
  sd._stamina = 100; sd._heroEmpT = 0;
  for (let i = 0; i < 4; i++) batchRegistry.tick(0.1);  // 0.4s of W+Shift held
  const remainingStam = sd._stamina;
  console.log(`[test] stamina after 0.4s W+Shift = ${remainingStam.toFixed(2)} (was 100)`);
  if (remainingStam >= 100) {
    console.log(`[test] FAIL — stamina did not drain. $input atoms not wiring.`);
    process.exit(1);
  }
  const expected = 100 - 25 * 0.4;
  if (Math.abs(remainingStam - expected) > 0.5) {
    console.log(`[test] FAIL — unexpected stamina: got ${remainingStam}, expected ~${expected}`);
    process.exit(1);
  }
  console.log(`[test] PASS — $input atoms drove stamina drain through cloned legacy module.`);
}

/* ---------- $emit-driven action test (iter 760) ---------- */
// With KeyW held, the speed-boost mount with speedBoostT > 0 should
// emit decal-particle Things via $emit each TRAIL_PERIOD seconds.
// Register the kinds the template references so spawn() accepts.
const speedSpec = specs.find((s) => s.id === "legacy/speed-boost");
if (speedSpec) {
  const sd = batchRegistry.facetData("legacy/speed-boost", "legacy-mount");
  sd._speedBoostT = 5;
  sd._speedTrailT = 0;  // trigger immediately
  const beforeCount = batchRegistry.byKind("decal-particle").length;
  // tick several frames; need ~0.08s * 3 = 0.24s of W held to emit ~3 trails
  for (let i = 0; i < 6; i++) batchRegistry.tick(0.05);
  const afterCount = batchRegistry.byKind("decal-particle").length;
  console.log(`[test] decal-particle count after 0.30s W+boost = ${afterCount} (was ${beforeCount})`);
  if (afterCount <= beforeCount) {
    console.log(`[test] FAIL — $emit did not spawn any decal-particle.`);
    process.exit(1);
  }
  console.log(`[test] PASS — $emit action atom spawned ${afterCount - beforeCount} decal-particle(s) via cloned mountSpeedBoostTick.`);
}

/* ---------- $kindPos + burn-over-time test (iter 761) ---------- */
const burnSpec = specs.find((s) => s.id === "legacy/burn");
if (burnSpec) {
  const bd = batchRegistry.facetData("legacy/burn", "legacy-mount");
  bd._heroFireT = 3; bd._heroFireDmgT = 0;
  batchRegistry.updateFacet("hero/main", "position", { x: 1, y: 0, z: 2 });
  const hp0 = batchRegistry.facetData("hero/main", "health").hp;
  const decals0 = batchRegistry.byKind("decal-particle").length;
  for (let i = 0; i < 6; i++) batchRegistry.tick(0.1);  // 0.6s — past BURN_DMG_PERIOD 0.5s
  const hp1 = batchRegistry.facetData("hero/main", "health").hp;
  const decals1 = batchRegistry.byKind("decal-particle").length;
  console.log(`[test] burn: hp ${hp0}→${hp1}, decals ${decals0}→${decals1} after 0.6s`);
  if (hp1 >= hp0) {
    console.log(`[test] FAIL — burn did not damage hero.`);
    process.exit(1);
  }
  if (decals1 <= decals0) {
    console.log(`[test] FAIL — burn did not $emit any particles.`);
    process.exit(1);
  }
  console.log(`[test] PASS — $kindPos + $emit ($arg0/$arg1/$arg2) drove burn DOT + particle spawn through cloned mountBurnTick.`);
}

process.exit(0);
