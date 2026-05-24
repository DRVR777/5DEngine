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
//
// Note (iter 770): the data/legacy/hero-regen.json spec was deleted
// — hero-regen is now a native facet. This phase remains as a bridge
// regression test, building an inline spec from src/systems/hero_regen_tick.js
// (the legacy module file is still present, game.html still imports it).
// The canonical proof for the NATIVE facet is the parity phase further below.
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

/* ---------- fps window semantic test (iter 780) ----------
 * Promotes legacy/fps-tick from HOSTED_BIND_ONLY to HOSTED_SEMANTIC_PROVEN.
 *
 * Force the bridged mount into a completed one-second FPS window:
 * _frames=9, _windowT=performance.now()-1000, then tick. The mount
 * increments to 10 frames, computes roughly 10 FPS, resets _frames,
 * advances _windowT, and leaves the display stable on the next short tick.
 */
const fpsSpec = specs.find((s) => s.id === "legacy/fps-tick");
if (fpsSpec) {
  const fd = batchRegistry.facetData("legacy/fps-tick", "legacy-mount");
  const oldWindow = performance.now() - 1000;
  fd._frames = 9;
  fd._windowT = oldWindow;
  fd._display = 0;

  batchRegistry.tick(0.016);
  const display = fd._display;
  console.log(`[test] fps-tick: display=${display}, frames=${fd._frames}, windowT advanced=${fd._windowT > oldWindow}`);
  if (display < 9 || display > 11) {
    console.log(`[test] FAIL — fps-tick display did not land near 10 FPS after forced one-second window.`);
    process.exit(1);
  }
  if (fd._frames !== 0 || fd._windowT <= oldWindow) {
    console.log(`[test] FAIL — fps-tick did not reset frame counter and advance window timestamp.`);
    process.exit(1);
  }

  batchRegistry.tick(0.016);
  if (fd._frames !== 1 || fd._display !== display) {
    console.log(`[test] FAIL — fps-tick short-window frame accumulation drifted.`);
    process.exit(1);
  }
  console.log(`[test] PASS — fps-tick window update + reset + short-window accumulation verified through cloned mountFpsTick (SEMANTIC_PROVEN).`);
}

/* ---------- footstep timer semantic test (iter 783) ----------
 * Promotes legacy/footstep-sound from HOSTED_BIND_ONLY to
 * HOSTED_SEMANTIC_PROVEN. With W+Shift held and pointer lock faked,
 * the timer should fire immediately from 0, rearm to sprint interval
 * 0.26, then decay by dt on the next tick.
 */
const footstepSpec = specs.find((s) => s.id === "legacy/footstep-sound");
if (footstepSpec) {
  const oldDocument = globalThis.document;
  globalThis.document = { pointerLockElement: {} };
  const fd = batchRegistry.facetData("legacy/footstep-sound", "legacy-mount");
  fd._footstepT = 0;

  batchRegistry.tick(0.01);
  console.log(`[test] footstep: immediate sprint rearm -> _footstepT=${fd._footstepT.toFixed(3)} (expected 0.260)`);
  if (Math.abs(fd._footstepT - 0.26) > 0.001) {
    console.log(`[test] FAIL — footstep did not rearm to sprint interval.`);
    process.exit(1);
  }

  batchRegistry.tick(0.1);
  console.log(`[test] footstep: countdown -> _footstepT=${fd._footstepT.toFixed(3)} (expected 0.160)`);
  if (Math.abs(fd._footstepT - 0.16) > 0.001) {
    console.log(`[test] FAIL — footstep countdown drifted.`);
    process.exit(1);
  }

  globalThis.document = { pointerLockElement: null };
  batchRegistry.tick(0.01);
  if (fd._footstepT !== 0) {
    console.log(`[test] FAIL — footstep did not clamp to 0 when pointer lock is absent.`);
    process.exit(1);
  }
  globalThis.document = oldDocument;
  console.log(`[test] PASS — footstep sprint interval + countdown + inactive clamp verified through cloned mountFootstepSound (SEMANTIC_PROVEN).`);
}

/* ---------- clock HUD semantic test (iter 786) ----------
 * Brings mountClockHudTick from UNHOSTED into HOSTED_SEMANTIC_PROVEN.
 * The synthetic element proves DOM text/style side effects through the
 * bridge without needing a browser.
 */
const clockHudSpec = specs.find((s) => s.id === "legacy/clock-hud");
if (clockHudSpec) {
  const cd = batchRegistry.facetData("legacy/clock-hud", "legacy-mount");
  cd._hour = 13.5;
  cd._el = { textContent: "", style: {} };

  batchRegistry.tick(0.016);
  console.log(`[test] clock-hud: hour=13.5 -> "${cd._el.textContent}" color=${cd._el.style.color}`);
  if (!cd._el.textContent.includes("01:30 PM") || cd._el.style.color !== "#ffd166") {
    console.log(`[test] FAIL — clock-hud did not format DayNight hour into expected PM text/color.`);
    process.exit(1);
  }

  cd._hour = null;
  batchRegistry.tick(0.016);
  if (!/\d\d:\d\d (AM|PM)$/.test(cd._el.textContent)) {
    console.log(`[test] FAIL — clock-hud fallback path did not write formatted AM/PM text.`);
    process.exit(1);
  }
  console.log(`[test] PASS — clock-hud DayNight + fallback DOM paint verified through cloned mountClockHudTick (SEMANTIC_PROVEN).`);
}

/* ---------- native footstep-sound parity test (iter 784) ----------
 * Mirrors the iter-783 legacy footstep semantic phase using ONLY the
 * native footstep-sound facet.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const footstepSound = (await import("../src/ankhor/facets/footstep_sound.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("footstep-sound", footstepSound);
  reg.registerFacetHandler("inventory",      { priority: 24 });
  reg.registerFacetHandler("input-state",    { priority: 2 });
  reg.registerFacetHandler("tuning",         { priority: 41 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory",      data: { footstepT: 0, items: {}, score: 0 } },
      { name: "footstep-sound", data: {} },
    ],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { KeyW: true, ShiftLeft: true }, mouseHeld: false, yaw: 0 } }],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      footstep_interval_sprint: 0.26,
      footstep_interval_walk: 0.38,
      footstep_interval_crouch: 0.55,
      footstep_freq_base: 80,
      footstep_freq_jitter: 40,
      footstep_sfx_volume: 0.08,
    } }],
  });

  const oldDocument = globalThis.document;
  globalThis.document = { pointerLockElement: {} };
  const inv = reg.facetData("hero/main", "inventory");
  reg.tick(0.01);
  console.log(`[test] native footstep: immediate sprint rearm -> footstepT=${inv.footstepT.toFixed(3)} (expected 0.260)`);
  if (Math.abs(inv.footstepT - 0.26) > 0.001) {
    console.log(`[test] FAIL — native footstep did not rearm to sprint interval.`);
    process.exit(1);
  }
  if (!inv.lastFootstepSfx || !/^tone:\d+:30:triangle$/.test(inv.lastFootstepSfx.id) || inv.lastFootstepSfx.volume !== 0.08) {
    console.log(`[test] FAIL — native footstep did not reproduce SFX action payload.`);
    process.exit(1);
  }

  reg.tick(0.1);
  if (Math.abs(inv.footstepT - 0.16) > 0.001) {
    console.log(`[test] FAIL — native footstep countdown drifted.`);
    process.exit(1);
  }

  globalThis.document = { pointerLockElement: null };
  reg.tick(0.01);
  if (inv.footstepT !== 0) {
    console.log(`[test] FAIL — native footstep did not clamp to 0 when pointer lock is absent.`);
    process.exit(1);
  }
  globalThis.document = oldDocument;
  console.log(`[test] PASS — native footstep reproduces sprint interval + countdown + inactive clamp (NATIVE_VERIFIED).`);
}

/* ---------- native fps-tick parity test (iter 781) ----------
 * Mirrors the iter-780 legacy fps window proof using ONLY the native
 * fps-tick facet on a synthetic hud Thinga.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const fpsTick = (await import("../src/ankhor/facets/fps_tick.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("fps-tick", fpsTick);
  reg.registerFacetHandler("tuning",   { priority: 41 });

  const oldWindow = performance.now() - 1000;
  reg.spawn({
    id: "hud/main", kind: "hud", name: "primary_hud",
    facets: [{ name: "fps-tick", data: { frames: 9, windowT: oldWindow, display: 0 } }],
  });
  reg.spawn({
    id: "tuning/hud_default", kind: "tuning", name: "hud-default-tuning",
    facets: [{ name: "tuning", data: { fps_window_ms: 1000 } }],
  });

  const fd = reg.facetData("hud/main", "fps-tick");
  reg.tick(0.016);
  console.log(`[test] native fps-tick: display=${fd.display}, frames=${fd.frames}, windowT advanced=${fd.windowT > oldWindow}`);
  if (fd.display < 9 || fd.display > 11) {
    console.log(`[test] FAIL — native fps-tick display did not land near 10 FPS after forced one-second window.`);
    process.exit(1);
  }
  if (fd.frames !== 0 || fd.windowT <= oldWindow) {
    console.log(`[test] FAIL — native fps-tick did not reset frame counter and advance window timestamp.`);
    process.exit(1);
  }

  const display = fd.display;
  reg.tick(0.016);
  if (fd.frames !== 1 || fd.display !== display) {
    console.log(`[test] FAIL — native fps-tick short-window frame accumulation drifted.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native fps-tick reproduces window update + reset + short-window accumulation (NATIVE_VERIFIED).`);
}

/* ---------- heartbeat threshold-gate test (iter 777) ----------
 * Promotes legacy/heartbeat from HOSTED_BIND_ONLY to HOSTED_SEMANTIC_PROVEN.
 *
 * Legacy mountHeartbeat: when heroHp < maxHp*0.3 AND !heroDead, count
 * heartbeatT down each frame; when it hits ≤0, reset to
 *   0.38 + (heroHp/threshold) * 0.82
 * and fire the SFX action. Above threshold, heartbeatT clamps to 0.
 *
 * Semantic verification (single registry-resolved bind chain):
 *   1. Drop hero hp to 20 (threshold = 100 * 0.3 = 30, so hp < threshold).
 *   2. Tick 1×0.1s: _heartbeatT starts at 0 → next = -0.1 → fires →
 *      _heartbeatT = 0.38 + (20/30)*0.82 = 0.38 + 0.54666… = 0.92666…
 *   3. Tick 1×0.5s: countdown only, no fire → _heartbeatT = 0.42666…
 *   4. Raise hp to 80 (above threshold). Tick 1× → _heartbeatT clamps to 0.
 */
const heartbeatSpec = specs.find((s) => s.id === "legacy/heartbeat");
if (heartbeatSpec) {
  const hd = batchRegistry.facetData("legacy/heartbeat", "legacy-mount");
  hd._heartbeatT = 0;
  batchRegistry.updateFacet("hero/main", "health", { hp: 20, maxHp: 100 });

  batchRegistry.tick(0.1);
  const fireValue = hd._heartbeatT;
  const expectedFire = 0.38 + (20 / 30) * 0.82;
  console.log(`[test] heartbeat: low-hp fire → _heartbeatT = ${fireValue.toFixed(4)} (expected ${expectedFire.toFixed(4)})`);
  if (Math.abs(fireValue - expectedFire) > 0.001) {
    console.log(`[test] FAIL — heartbeat gate-fire math drifted from legacy formula.`);
    process.exit(1);
  }

  batchRegistry.tick(0.5);
  const decayed = hd._heartbeatT;
  const expectedDecayed = expectedFire - 0.5;
  console.log(`[test] heartbeat: countdown → _heartbeatT = ${decayed.toFixed(4)} (expected ${expectedDecayed.toFixed(4)})`);
  if (Math.abs(decayed - expectedDecayed) > 0.001) {
    console.log(`[test] FAIL — heartbeat countdown math drifted.`);
    process.exit(1);
  }

  batchRegistry.updateFacet("hero/main", "health", { hp: 80, maxHp: 100 });
  batchRegistry.tick(0.1);
  const cleared = hd._heartbeatT;
  console.log(`[test] heartbeat: hp above threshold → _heartbeatT = ${cleared}`);
  if (cleared !== 0) {
    console.log(`[test] FAIL — heartbeat did not clamp _heartbeatT to 0 above threshold.`);
    process.exit(1);
  }
  // Restore hero hp so downstream phases see the original fixture.
  batchRegistry.updateFacet("hero/main", "health", { hp: 60, maxHp: 100 });

  console.log(`[test] PASS — heartbeat threshold gate + reset formula + clamp verified through cloned mountHeartbeat (SEMANTIC_PROVEN).`);
}

/* ---------- native heartbeat parity test (iter 778) ----------
 * Mirrors the iter-777 legacy heartbeat semantic phase using ONLY the
 * native heartbeat facet. State is lifted from legacy/heartbeat
 * _heartbeatT scratch into hero.inventory.heartbeatT.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const heartbeatFacet = (await import("../src/ankhor/facets/heartbeat.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("heartbeat", heartbeatFacet);
  reg.registerFacetHandler("health",    { priority: 25 });
  reg.registerFacetHandler("inventory", { priority: 24 });
  reg.registerFacetHandler("tuning",    { priority: 41 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "health",    data: { hp: 20, maxHp: 100 } },
      { name: "inventory", data: { heartbeatT: 0, items: {}, score: 0 } },
      { name: "heartbeat", data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      heartbeat_threshold_frac: 0.3,
      heartbeat_min_period: 0.38,
      heartbeat_period_range: 0.82,
      heartbeat_sfx_id: "tone:42:95:sine",
      heartbeat_sfx_base_volume: 0.30,
      heartbeat_sfx_volume_range: 0.18,
    } }],
  });

  reg.tick(0.1);
  const inv = reg.facetData("hero/main", "inventory");
  const expectedFire = 0.38 + (20 / 30) * 0.82;
  console.log(`[test] native heartbeat: low-hp fire -> heartbeatT = ${inv.heartbeatT.toFixed(4)} (expected ${expectedFire.toFixed(4)})`);
  if (Math.abs(inv.heartbeatT - expectedFire) > 0.001) {
    console.log(`[test] FAIL — native heartbeat gate-fire math drifted from legacy formula.`);
    process.exit(1);
  }
  const expectedVol = 0.30 + (1 - (20 / 30)) * 0.18;
  if (!inv.lastHeartbeatSfx || inv.lastHeartbeatSfx.id !== "tone:42:95:sine" || Math.abs(inv.lastHeartbeatSfx.volume - expectedVol) > 0.001) {
    console.log(`[test] FAIL — native heartbeat did not reproduce SFX action payload.`);
    process.exit(1);
  }

  reg.tick(0.5);
  const expectedDecayed = expectedFire - 0.5;
  console.log(`[test] native heartbeat: countdown -> heartbeatT = ${inv.heartbeatT.toFixed(4)} (expected ${expectedDecayed.toFixed(4)})`);
  if (Math.abs(inv.heartbeatT - expectedDecayed) > 0.001) {
    console.log(`[test] FAIL — native heartbeat countdown math drifted.`);
    process.exit(1);
  }

  reg.updateFacet("hero/main", "health", { hp: 80, maxHp: 100 });
  reg.tick(0.1);
  console.log(`[test] native heartbeat: hp above threshold -> heartbeatT = ${inv.heartbeatT}`);
  if (inv.heartbeatT !== 0) {
    console.log(`[test] FAIL — native heartbeat did not clamp heartbeatT to 0 above threshold.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native heartbeat reproduces threshold gate + reset formula + clamp (NATIVE_VERIFIED).`);
}

/* ---------- native hero-regen parity test (iter 769) ----------
 * Mirrors the iter-757 legacy hero-regen test: same hero hp=60 +
 * tuning regen_rate=10/s, tick 5×0.5s, assert hp == 85.
 * Uses ONLY the native facet (no legacy spec) — clean registry.
 *
 * If math drifts vs the legacy module, the flip stalls. Lockstep
 * parity is the gate for promoting NATIVE_BUILT → NATIVE_VERIFIED.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const heroRegen = (await import("../src/ankhor/facets/hero_regen.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("hero-regen", heroRegen);
  reg.registerFacetHandler("health",     { priority: 25 });
  reg.registerFacetHandler("tuning",     { priority: 41 });
  reg.registerFacetHandler("inventory",  { priority: 24 });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "health",     data: { hp: 60, maxHp: 100, lastDamageT: 0 } },
      { name: "hero-regen", data: {} },
      { name: "inventory",  data: { items: {}, score: 0 } },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: { regen_delay_seconds: 0, regen_rate_per_second: 10 } }],
  });

  const hp0 = reg.facetData("hero/main", "health").hp;
  for (let i = 0; i < 5; i++) reg.tick(0.5);
  const hp1 = reg.facetData("hero/main", "health").hp;
  const expected = Math.min(100, hp0 + 10 * 0.5 * 5);
  console.log(`[test] native hero-regen: hp ${hp0}→${hp1} (expected ${expected})`);
  if (Math.abs(hp1 - expected) > 0.01) {
    console.log(`[test] FAIL — native hero-regen drifted from legacy math.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native hero-regen reproduces legacy mountHeroRegenTick math (NATIVE_VERIFIED).`);
}

/* ---------- native stamina parity test (iter 771) ----------
 * Mirrors the iter-759 legacy stamina semantic phase: synthetic
 * input with KeyW + ShiftLeft held, tick 4×0.1s, assert stamina
 * drained 100 → 90 (matches STAMINA_DRAIN 25/s × 0.4s).
 * Uses ONLY the native facet (no legacy spec).
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const staminaFacet = (await import("../src/ankhor/facets/stamina.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("stamina",     staminaFacet);
  reg.registerFacetHandler("inventory",   { priority: 24 });
  reg.registerFacetHandler("tuning",      { priority: 41 });
  reg.registerFacetHandler("input-state", { priority: 2 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory", data: { stamina: 100, heroEmpT: 0, items: {}, score: 0 } },
      { name: "stamina",   data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      stamina_max: 100, stamina_drain: 25, stamina_regen: 18, stamina_lockout: 20,
    } }],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { KeyW: true, ShiftLeft: true }, mouseHeld: false, yaw: 0 } }],
  });

  const s0 = reg.facetData("hero/main", "inventory").stamina;
  for (let i = 0; i < 4; i++) reg.tick(0.1);  // 0.4s W+Shift
  const s1 = reg.facetData("hero/main", "inventory").stamina;
  const expected = 100 - 25 * 0.4;
  console.log(`[test] native stamina: ${s0}→${s1.toFixed(2)} (expected ${expected})`);
  if (Math.abs(s1 - expected) > 0.5) {
    console.log(`[test] FAIL — native stamina drifted from legacy math.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native stamina reproduces legacy mountStaminaTick math (NATIVE_VERIFIED).`);
}

/* ---------- native speed-boost parity test (iter 773) ----------
 * Mirrors the iter-760 legacy speed-boost semantic phase: with the
 * boost active and KeyW held, tick 6×0.05s = 0.30s. TRAIL_PERIOD
 * is 0.08, so we expect 3 decals (at 0.00, 0.08, 0.16, 0.24).
 * Uses ONLY the native facet (no legacy spec).
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const speedBoostFacet = (await import("../src/ankhor/facets/speed_boost.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("speed-boost", speedBoostFacet);
  reg.registerFacetHandler("inventory",   { priority: 24 });
  reg.registerFacetHandler("tuning",      { priority: 41 });
  reg.registerFacetHandler("input-state", { priority: 2 });
  reg.registerFacetHandler("position",    { priority: 10 });
  reg.registerFacetHandler("mesh",        { priority: 70 });
  reg.registerFacetHandler("ttl",         { priority: 80 });
  reg.registerFacetHandler("expand-fade", { priority: 60 });

  const nowSec = Date.now() / 1000;
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",    data: { x: 0, y: 0, z: 0 } },
      { name: "inventory",   data: { speed_boost_until_sec: nowSec + 5, speed_trail_t: 0, items: {}, score: 0 } },
      { name: "speed-boost", data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      speed_boost_trail_period: 0.08, speed_boost_mul: 1.5,
    } }],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { KeyW: true }, mouseHeld: false, yaw: 0 } }],
  });

  const before = reg.byKind("decal-particle").length;
  for (let i = 0; i < 6; i++) reg.tick(0.05);
  const after = reg.byKind("decal-particle").length;
  console.log(`[test] native speed-boost: decals ${before}→${after} after 0.30s W+boost`);
  if (after <= before) {
    console.log(`[test] FAIL — native speed-boost did not spawn trail decals.`);
    process.exit(1);
  }
  const mul = reg.facetData("hero/main", "inventory").speed_boost_mul;
  if (Math.abs(mul - 1.5) > 0.001) {
    console.log(`[test] FAIL — speed_boost_mul did not become 1.5 (got ${mul}).`);
    process.exit(1);
  }
  console.log(`[test] PASS — native speed-boost emitted ${after - before} trail decal(s) + exposed speed_boost_mul=${mul} (NATIVE_VERIFIED).`);
}

/* ---------- native cam-shake parity test (iter 789) ----------
 * Legacy mountCamShakeTick decays camShakeAmt by exp(-dt*14), offsets
 * camera x/y by two random signed impulses scaled by amt*0.18, and
 * clamps sub-threshold shake to 0. Use deterministic Math.random so the
 * native test proves exact offset math.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const camShakeFacet = (await import("../src/ankhor/facets/cam_shake.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("cam-shake",      camShakeFacet);
  reg.registerFacetHandler("render-context", { priority: 1 });

  reg.spawn({
    id: "world/default", kind: "world", name: "default-world",
    facets: [{ name: "cam-shake", data: { amount: 1 } }],
  });
  const camera = { position: { x: 10, y: 20, z: 30 } };
  reg.spawn({
    id: "render/context", kind: "render-context", name: "render-context",
    facets: [{ name: "render-context", data: { camera } }],
  });

  const oldRandom = Math.random;
  const seq = [1, 0];
  Math.random = () => seq.shift() ?? 0.5;
  reg.tick(0.1);
  Math.random = oldRandom;

  const data = reg.facetData("world/default", "cam-shake");
  const expectedAmt = Math.exp(-1.4);
  console.log(`[test] native cam-shake: amount 1→${data.amount.toFixed(4)} camera=(${camera.position.x.toFixed(3)},${camera.position.y.toFixed(3)})`);
  if (Math.abs(data.amount - expectedAmt) > 0.0001) {
    console.log(`[test] FAIL — native cam-shake decay drifted from legacy exp(-dt*14).`);
    process.exit(1);
  }
  if (Math.abs(camera.position.x - 10.09) > 0.0001 || Math.abs(camera.position.y - 19.91) > 0.0001) {
    console.log(`[test] FAIL — native cam-shake deterministic camera offset drifted.`);
    process.exit(1);
  }

  data.amount = 0.004;
  reg.tick(0.016);
  if (data.amount !== 0) {
    console.log(`[test] FAIL — native cam-shake did not clamp sub-threshold amount to 0.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native cam-shake matches legacy decay + offset + clamp math (NATIVE_VERIFIED).`);
}

/* ---------- native burn parity test (iter 775) ----------
 * Legacy mountBurnTick: while heroFireT > 0, every BURN_DMG_PERIOD
 * (0.5s) deal BURN_DMG (3) and spawn 2 particle decals.
 *
 * Native: with heroFireT = 1.2 + heroFireDmgT = 0.5, ticking 6×0.2s
 * (= 1.2s) fires the damage gate twice before clamping. Hp
 * goes 60 → 57 → 54. Decals ≥ 4 (2 per gate × 2 gates).
 * Uses ONLY the native facet (no legacy spec).
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const burnFacet = (await import("../src/ankhor/facets/burn.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("burn",        burnFacet);
  reg.registerFacetHandler("inventory",   { priority: 24 });
  reg.registerFacetHandler("health",      { priority: 25 });
  reg.registerFacetHandler("tuning",      { priority: 41 });
  reg.registerFacetHandler("position",    { priority: 10 });
  reg.registerFacetHandler("mesh",        { priority: 70 });
  reg.registerFacetHandler("ttl",         { priority: 80 });
  reg.registerFacetHandler("expand-fade", { priority: 60 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",  data: { x: 0, y: 0, z: 0 } },
      { name: "health",    data: { hp: 60, maxHp: 100 } },
      { name: "inventory", data: { heroFireT: 1.2, heroFireDmgT: 0.5, items: {}, score: 0 } },
      { name: "burn",      data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      burn_dmg: 3, burn_dmg_period: 0.5,
      burn_particle_count: 2, burn_particle_y_base: 0.8,
      burn_particle_y_jitter: 0.8, burn_particle_xz_jitter: 0.6,
    } }],
  });

  const hpBefore     = reg.facetData("hero/main", "health").hp;
  const decalsBefore = reg.byKind("decal-particle").length;
  for (let i = 0; i < 6; i++) reg.tick(0.2);
  const hpAfter     = reg.facetData("hero/main", "health").hp;
  const decalsAfter = reg.byKind("decal-particle").length;

  console.log(`[test] native burn: hp ${hpBefore}→${hpAfter} + decals ${decalsBefore}→${decalsAfter} after 6×0.2s with heroFireT=1.2`);
  if (hpAfter !== 54) {
    console.log(`[test] FAIL — expected hp=54 after two burn-dmg gates of 3 dmg, got ${hpAfter}.`);
    process.exit(1);
  }
  if (decalsAfter - decalsBefore < 4) {
    console.log(`[test] FAIL — expected ≥4 burn decals (2 per damage gate × 2 gates), got ${decalsAfter - decalsBefore}.`);
    process.exit(1);
  }
  const invFinal = reg.facetData("hero/main", "inventory");
  if (Math.abs(invFinal.heroFireT) > 1e-9) {
    console.log(`[test] FAIL — heroFireT should be effectively 0 after running out, got ${invFinal.heroFireT}.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native burn dealt ${hpBefore - hpAfter} dmg + spawned ${decalsAfter - decalsBefore} decals + clamped heroFireT (NATIVE_VERIFIED).`);
}

process.exit(0);
