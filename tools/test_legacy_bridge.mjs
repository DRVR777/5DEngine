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

import { readFileSync } from "node:fs";
const spawnsRaw = readFileSync(new URL("../data/spawns/legacy_systems.json", import.meta.url), "utf8");
const spawnSet = JSON.parse(spawnsRaw);
const specs = spawnSet.children
  .map((c) => ({ id: c.id, name: c.name, mount: c.facets.find(f => f.name === "legacy-mount")?.data }))
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

process.exit(0);
