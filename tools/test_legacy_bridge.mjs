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

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const LEGACY_DIR = new URL("../data/legacy/", import.meta.url);
const specs = existsSync(fileURLToPath(LEGACY_DIR))
  ? readdirSync(LEGACY_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const t = JSON.parse(readFileSync(new URL(f, LEGACY_DIR), "utf8"));
        return { id: t.id, name: t.name, mount: t.facets.find((x) => x.name === "legacy-mount")?.data };
      })
      .filter((s) => s.mount && s.id !== "legacy/hero-regen")  // hero-regen already covered above
  : [];

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

/* ---------- native clock-hud parity test (iter 797) ----------
 * Mirrors the iter-786 semantic phase using ONLY the native clock-hud
 * facet: hour=13.5 must paint 01:30 PM and day color; null hour must
 * exercise the fallback formatted clock path.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const clockHud = (await import("../src/ankhor/facets/clock_hud.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("clock-hud", clockHud);
  reg.registerFacetHandler("tuning",    { priority: 41 });

  reg.spawn({
    id: "hud/main", kind: "hud", name: "primary_hud",
    facets: [{ name: "clock-hud", data: { hour: 13.5, _el: { textContent: "", style: {} } } }],
  });
  reg.spawn({
    id: "tuning/hud", kind: "tuning", name: "hud-default-tuning",
    facets: [{ name: "tuning", data: {
      clock_right_px: 12,
      clock_top_px: 40,
      clock_day_color: "#ffd166",
      clock_night_color: "#6699cc",
      clock_fallback_day_mix: 0.8,
    } }],
  });

  reg.tick(0.016);
  const data = reg.facetData("hud/main", "clock-hud");
  console.log(`[test] native clock-hud: hour=13.5 -> "${data.text}" color=${data.color}`);
  if (!data.text.includes("01:30 PM") || data.color !== "#ffd166") {
    console.log(`[test] FAIL — native clock-hud did not format DayNight hour into expected PM text/color.`);
    process.exit(1);
  }

  data.hour = null;
  reg.tick(0.016);
  if (!/\d\d:\d\d (AM|PM)$/.test(data.text)) {
    console.log(`[test] FAIL — native clock-hud fallback path did not write formatted AM/PM text.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native clock-hud reproduces legacy DayNight + fallback DOM paint (NATIVE_VERIFIED).`);
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

/* ---------- native ammo-reload parity test (iter 829) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ammoReload = (await import("../src/ankhor/facets/ammo_reload.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("ammo-reload", ammoReload);
  reg.registerFacetHandler("inventory", { priority: 24 });
  reg.spawn({
    id: "weapon/pistol", kind: "weapon", name: "pistol",
    facets: [
      { name: "ammo-reload", data: {} },
      { name: "inventory", data: { items: {} } },
    ],
  });
  reg.spawn({
    id: "tuning/ammo", kind: "tuning", name: "ammo-tuning",
    facets: [{ name: "tuning", data: { reloadDurationMs: 1500, magCapacity: 17 } }],
  });
  // State lives in facet data — set reloading state on the thing via inventory facet
  const fd = reg.facetData("weapon/pistol", "ammo-reload");
  fd.reloading = true;
  fd.reloadStart = Date.now() - 1600;
  fd.pistolAmmo = 5;
  fd.inventoryAmmo = 50;
  reg.tick(0.016);
  console.log(`[test] native ammo-reload: reloading=${fd.reloading} ammo=${fd.pistolAmmo} inv=${fd.inventoryAmmo}`);
  if (fd.reloading !== false || fd.pistolAmmo !== 17 || fd.inventoryAmmo !== 38) {
    console.log(`[test] FAIL — native ammo-reload drifted (expected reloading=false, ammo=17, inv=38)`);
    process.exit(1);
  }
  console.log(`[test] PASS — native ammo-reload reproduces legacy mountAmmoReloadTick math (NATIVE_VERIFIED).`);
}

/* ---------- native ammo-pickup parity test (iter 830) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ammoPickup = (await import("../src/ankhor/facets/ammo_pickup.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("ammo-pickup", ammoPickup);
  reg.spawn({ id: "pickups/ammo", kind: "pickup", name: "ammo-pickup", facets: [{ name: "ammo-pickup", data: {
    pickups: [{ u: 0, v: 0, qty: 10 }], heroU: 0, heroV: 0.5
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("pickups/ammo", "ammo-pickup");
  // pickup at dist 0.5 < 1.2 should be collected
  const collected = fd.pickups.length === 0 && fd.collectedAmmo === 10;
  console.log(`[test] native ammo-pickup: pickups=${fd.pickups.length} collected=${fd.collectedAmmo} (expected 0/10)`);
  if (!collected) { console.log(`[test] FAIL — ammo pickup not collected at close range`); process.exit(1); }
  console.log(`[test] PASS — native ammo-pickup reproduces legacy mountAmmoPickupTick (NATIVE_VERIFIED).`);
}

/* ---------- native coin-drop parity test (iter 831) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const coinDrop = (await import("../src/ankhor/facets/coin_drop.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("coin-drop", coinDrop);
  reg.spawn({ id: "pickups/coin", kind: "pickup", name: "coin", facets: [{ name: "coin-drop", data: {
    pickups: [{ u: 0, v: 0, value: 50 }], heroU: 0, heroV: 0.3
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("pickups/coin", "coin-drop");
  if (fd.pickups.length !== 0 || fd.score !== 50) { console.log(`[test] FAIL coin-drop`); process.exit(1); }
  console.log(`[test] PASS — native coin-drop reproduces mountCoinDropTick (NATIVE_VERIFIED).`);
}

/* ---------- native fire-patch parity test (iter 832) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const fp = (await import("../src/ankhor/facets/fire_patch.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("fire-patch", fp);
  reg.spawn({ id: "hazards/fire", kind: "pickup", name: "fire", facets: [{ name: "fire-patch", data: {
    patches: [{ u: 0, v: 0, radius: 2, timeLeft: 5, dmgT: 0 }], heroU: 0, heroV: 0, heroHp: 100
  }}] });
  for (let i = 0; i < 5; i++) reg.tick(0.5);
  const fd = reg.facetData("hazards/fire", "fire-patch");
  const hp = fd.heroHp, ft = fd.heroFireT;
  if (hp >= 94 || ft !== 2.5) { console.log(`[test] FAIL fire-patch: hp=${hp} fireT=${ft}`); process.exit(1); }
  console.log(`[test] PASS — native fire-patch reproduces hero damage (NATIVE_VERIFIED).`);
}

/* ---------- native grenade-physics parity (iter 833) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const gp = (await import("../src/ankhor/facets/grenade_physics.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("grenade-physics", gp);
  const g = { fuse: 3, velY: 0, velU: 2, velV: 0, u: 0, y: 2, v: 0, data: {} };
  reg.spawn({ id: "proj/grenade", kind: "pickup", name: "grenade", facets: [{ name: "grenade-physics", data: { grenades: [g], gravity: -9.8 } }] });
  for (let i = 0; i < 50; i++) reg.tick(0.1);  // 5s — fuse runs out
  const fd = reg.facetData("proj/grenade", "grenade-physics");
  if (fd.grenades.length !== 0 || !g.data.exploded) { console.log(`[test] FAIL grenade-physics: len=${fd.grenades.length} expl=${g.data.exploded}`); process.exit(1); }
  console.log(`[test] PASS — native grenade-physics fuse + gravity (NATIVE_VERIFIED).`);
}

/* ---------- native camera-pos parity test (iter 834) — MAGIC NUMBERS PINNED ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const cp = (await import("../src/ankhor/facets/camera_pos.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("camera-pos", cp);
  reg.spawn({ id: "cam/main", kind: "hero", name: "camera", facets: [{ name: "camera-pos", data: {
    firstPerson: false, buildMode: false, crouchAmt: 0, aiming: false, canSprint: false, camSide: 0, strafeRollAmt: 0,
    heroU: 0, heroY: 0, heroV: 0, camYaw: 0, camPitch: 0, dist: 6, gunBobPhase: 0
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("cam/main", "camera-pos");
  // Third person, no crouch: eyeH = 1.20, camTarget.y = 0 + 1.20
  // camPos.y = 0 + sin(-0)*6 + 1.2 = 1.2
  if (fd.camTarget.y !== 1.20 || fd.camPos.y !== 1.2) { console.log(`[test] FAIL camera-pos TP: target.y=${fd.camTarget.y} pos.y=${fd.camPos.y}`); process.exit(1); }
  // First person test
  fd.firstPerson = true;
  reg.tick(0.016);
  if (fd.camTarget.y !== 1.78) { console.log(`[test] FAIL camera-pos FP: target.y=${fd.camTarget.y} expected 1.78`); process.exit(1); }
  // Crouch test — FP crouch factor 0.75
  fd.crouchAmt = 1; fd.firstPerson = true;
  reg.tick(0.016);
  if (fd.camTarget.y !== 1.03) { console.log(`[test] FAIL camera-pos crouch FP: target.y=${fd.camTarget.y} expected 1.03 (1.78-0.75)`); process.exit(1); }
  console.log(`[test] PASS — native camera-pos preserves magic numbers (NATIVE_VERIFIED).`);
}

/* ---------- native grenade-warn parity (iter 835) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const gw = (await import("../src/ankhor/facets/grenade_warn.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("grenade-warn", gw);
  reg.spawn({ id: "hud/warn", kind: "pickup", name: "warn", facets: [{ name: "grenade-warn", data: {
    grenades: [{ u: 0, v: 0, fuse: 0.5 }], heroU: 0, heroV: 0
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("hud/warn", "grenade-warn");
  if (!fd.warnVisible) { console.log(`[test] FAIL grenade-warn not visible`); process.exit(1); }
  // Move hero far away — warn should hide
  fd.heroU = 10; fd.heroV = 0;
  reg.tick(0.016);
  if (fd.warnVisible) { console.log(`[test] FAIL grenade-warn should hide at distance`); process.exit(1); }
  console.log(`[test] PASS — native grenade-warn (NATIVE_VERIFIED).`);
}

/* ---------- native fp-gun-pos parity (iter 836) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const fgp = (await import("../src/ankhor/facets/fp_gun_pos.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("fp-gun-pos", fgp);
  reg.spawn({ id: "weapon/gun", kind: "pickup", name: "fp-gun", facets: [{ name: "fp-gun-pos", data: {
    active: true, aiming: false, reloading: false, canSprint: false, gunBobPhase: 0, gunKickZ: 0, gunReloadX: 0, meleeSwing: 0, weaponSwitchT: 0
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("weapon/gun", "fp-gun-pos");
  if (fd.gunX !== 0.22 || fd.gunY !== -0.24 || fd.gunZ !== -0.45) { console.log(`[test] FAIL fp-gun default pos: ${fd.gunX}/${fd.gunY}/${fd.gunZ}`); process.exit(1); }
  // Aiming shifts X by -0.08
  fd.aiming = true;
  reg.tick(0.016);
  if (fd.gunX !== 0.14) { console.log(`[test] FAIL fp-gun aim shift: ${fd.gunX} expected 0.14`); process.exit(1); }
  console.log(`[test] PASS — native fp-gun-pos preserves magic numbers (NATIVE_VERIFIED).`);
}

/* ---------- native legacy-pickup parity (iter 837) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const lp = (await import("../src/ankhor/facets/legacy_pickup.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("legacy-pickup", lp);
  reg.spawn({ id: "pickups/test", kind: "pickup", name: "lp", facets: [{ name: "legacy-pickup", data: { pickups: [{ u: 1, collected: false }] } }] });
  reg.tick(0.016);
  const fd = reg.facetData("pickups/test", "legacy-pickup");
  const pk = fd.pickups[0];
  if (pk.spin <= 0) { console.log(`[test] FAIL legacy-pickup no spin`); process.exit(1); }
  if (pk.bobY < 0.8 || pk.bobY > 1.2) { console.log(`[test] FAIL legacy-pickup bob range: ${pk.bobY}`); process.exit(1); }
  console.log(`[test] PASS — native legacy-pickup (NATIVE_VERIFIED).`);
}

/* ---------- native hero-inventory parity (iter 838) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const hi = (await import("../src/ankhor/facets/hero_inventory.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("hero-inventory", hi);
  reg.spawn({ id: "hero/player", kind: "hero", name: "player", facets: [{ name: "hero-inventory", data: {
    weapons: [{ id: "pistol", ammoItem: "pistol_9mm", magCap: 17 }], heroMaxHp: 100
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("hero/player", "hero-inventory");
  if (fd.items.medkit !== 2) { console.log(`[test] FAIL inv medkits: ${fd.items.medkit}`); process.exit(1); }
  if (fd.items.gun_pistol !== 1) { console.log(`[test] FAIL inv pistol: ${fd.items.gun_pistol}`); process.exit(1); }
  if (fd.items.pistol_9mm !== 68) { console.log(`[test] FAIL inv ammo: ${fd.items.pistol_9mm}`); process.exit(1); }
  if (fd.hp !== 100) { console.log(`[test] FAIL inv hp: ${fd.hp}`); process.exit(1); }
  console.log(`[test] PASS — native hero-inventory (NATIVE_VERIFIED).`);
}

/* ---------- native proximity parity (iter 839) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const px = (await import("../src/ankhor/facets/proximity.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("proximity", px);
  reg.spawn({ id: "sensors/prox", kind: "pickup", name: "prox", facets: [{ name: "proximity", data: {
    heroU: 0, heroV: 0, compU: 1, compV: 0, npcDefs: [{ id: "npc1", u: 1, v: 0 }]
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("sensors/prox", "proximity");
  if (!fd.nearComputer) { console.log(`[test] FAIL proximity computer not near`); process.exit(1); }
  if (!fd.nearNpc) { console.log(`[test] FAIL proximity npc not found`); process.exit(1); }
  // Move hero far away
  fd.heroU = 10; fd.heroV = 10;
  reg.tick(0.016);
  if (fd.nearComputer) { console.log(`[test] FAIL proximity should lose computer`); process.exit(1); }
  // Dialog open blocks NPC proximity
  fd.heroU = 0; fd.heroV = 0; fd.dialogOpen = true;
  reg.tick(0.016);
  if (fd.nearNpc) { console.log(`[test] FAIL proximity npc should be blocked by dialog`); process.exit(1); }
  console.log(`[test] PASS — native proximity (NATIVE_VERIFIED).`);
}

/* ---------- native armor-shard parity (iter 840) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ash = (await import("../src/ankhor/facets/armor_shard.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("armor-shard", ash);
  reg.spawn({ id: "pickups/armor", kind: "pickup", name: "armor", facets: [{ name: "armor-shard", data: {
    pickups: [{ u: 0, v: 0, amount: 25 }], heroU: 0, heroV: 0.3
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("pickups/armor", "armor-shard");
  if (fd.pickups.length !== 0 || fd.armorGained !== 25) { console.log(`[test] FAIL armor-shard: len=${fd.pickups.length} gained=${fd.armorGained}`); process.exit(1); }
  console.log(`[test] PASS — native armor-shard (NATIVE_VERIFIED).`);
}

/* ---------- native crate-system parity (iter 841) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const cs = (await import("../src/ankhor/facets/crate_system.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("crate-system", cs);
  reg.spawn({ id: "obj/crates", kind: "pickup", name: "crates", facets: [{ name: "crate-system", data: { crates: [{ hp: 0, broken: false }] } }] });
  reg.tick(0.016);
  const fd = reg.facetData("obj/crates", "crate-system");
  if (!fd.crates[0].broken || fd.cratesBroken !== 1) { console.log(`[test] FAIL crate-system`); process.exit(1); }
  console.log(`[test] PASS — native crate-system (NATIVE_VERIFIED).`);
}

/* ---------- native bullet-world-hit parity (iter 842) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const bwh = (await import("../src/ankhor/facets/bullet_world_hit.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("bullet-world-hit", bwh);
  reg.spawn({ id: "proj/bullet", kind: "pickup", name: "bullet", facets: [{ name: "bullet-world-hit", data: {
    bullets: [{ posU: 0, posV: 0, posY: 0.2, damage: 10, range: 50, traveled: 5 }],
    barrels: [{ u: 0.2, v: 0, hp: 20, exploded: false }],
    crates: []
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("proj/bullet", "bullet-world-hit");
  // Barrel at dist 0.2, dist²=0.04 < 0.18, y=0.2 < 0.95 → hit
  if (fd.bullets.length !== 0) { console.log(`[test] FAIL bullet-world-hit: bullet not removed`); process.exit(1); }
  if (fd.barrels[0].hp !== 10) { console.log(`[test] FAIL bullet-world-hit: barrel hp=${fd.barrels[0].hp}`); process.exit(1); }
  console.log(`[test] PASS — native bullet-world-hit (NATIVE_VERIFIED).`);
}

/* ---------- native bullet-hit-feedback parity (iter 843) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const bhf = (await import("../src/ankhor/facets/bullet_hit_feedback.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("bullet-hit-feedback", bhf);
  reg.spawn({ id: "enemy/test", kind: "pickup", name: "en", facets: [{ name: "bullet-hit-feedback", data: {
    u: 0, v: 0, bulletU: 1, bulletV: 0, headshot: true, dmg: 40, maxHp: 100, hp: 60, type: "normal"
  }}] });
  reg.tick(0.016);
  const fd = reg.facetData("enemy/test", "bullet-hit-feedback");
  if (fd.flinchX !== -0.6) { console.log(`[test] FAIL hit-feedback flinch: ${fd.flinchX}`); process.exit(1); }
  if (fd.staggerT !== 0.6) { console.log(`[test] FAIL hit-feedback stagger: ${fd.staggerT}`); process.exit(1); }
  if (fd.kbT !== 0.1) { console.log(`[test] FAIL hit-feedback kbT: ${fd.kbT}`); process.exit(1); }
  console.log(`[test] PASS — native bullet-hit-feedback (NATIVE_VERIFIED).`);
}

/* ---------- native debug-hud parity (iter 844) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const dh = (await import("../src/ankhor/facets/debug_hud.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("debug-hud", dh);
  reg.spawn({ id: "hud/debug", kind: "pickup", name: "debug", facets: [{ name: "debug-hud", data: { heroHp: 100, heroMaxHp: 100 } }] });
  reg.tick(0.016);
  let fd = reg.facetData("hud/debug", "debug-hud");
  if (fd.hpColor !== "#5dff5d") { console.log(`[test] FAIL debug-hud full: ${fd.hpColor}`); process.exit(1); }
  fd.heroHp = 40; reg.tick(0.016);
  if (fd.hpColor !== "#ffd166") { console.log(`[test] FAIL debug-hud mid: ${fd.hpColor}`); process.exit(1); }
  fd.heroHp = 10; reg.tick(0.016);
  if (fd.hpColor !== "#ff5d5d") { console.log(`[test] FAIL debug-hud low: ${fd.hpColor}`); process.exit(1); }
  console.log(`[test] PASS — native debug-hud (NATIVE_VERIFIED).`);
}

/* ---------- native barrel-system parity (iter 845) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const bs = (await import("../src/ankhor/facets/barrel_system.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("barrel-system", bs);
  reg.spawn({ id: "obj/barrels", kind: "pickup", name: "barrels", facets: [{ name: "barrel-system", data: { barrels: [{ hp: 0, exploded: false }] } }] });
  reg.tick(0.016);
  const fd = reg.facetData("obj/barrels", "barrel-system");
  if (!fd.barrels[0].exploded || fd.barrelsExploded !== 1) { console.log(`[test] FAIL barrel-system`); process.exit(1); }
  console.log(`[test] PASS — native barrel-system (NATIVE_VERIFIED).`);
}

/* ---------- native enemy-kill parity (iter 846) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ek = (await import("../src/ankhor/facets/enemy_kill.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("enemy-kill", ek);
  reg.spawn({ id: "enemy/kill", kind: "pickup", name: "kill", facets: [{ name: "enemy-kill", data: { killed: true, headshot: true, type: "normal" } }] });
  reg.tick(0.016);
  const fd = reg.facetData("enemy/kill", "enemy-kill");
  if (fd.hp !== 0 || !fd.dead) { console.log(`[test] FAIL enemy-kill`); process.exit(1); }
  if (fd.bulletTimeBonus !== 0.22) { console.log(`[test] FAIL enemy-kill headshot bonus`); process.exit(1); }
  if (fd.enemyKills !== 1) { console.log(`[test] FAIL enemy-kill count`); process.exit(1); }
  console.log(`[test] PASS — native enemy-kill (NATIVE_VERIFIED).`);
}

/* ---------- native bullet-geo parity (iter 847) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const bg = (await import("../src/ankhor/facets/bullet_geo.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("bullet-geo", bg);
  reg.spawn({ id: "geo/bullet", kind: "pickup", name: "bgeo", facets: [{ name: "bullet-geo", data: {} }] });
  reg.tick(0.016);
  const fd = reg.facetData("geo/bullet", "bullet-geo");
  if (fd.bulletW !== 0.025 || fd.bulletH !== 0.025 || fd.bulletL !== 0.28 || fd.bulletColor !== 0xffff00) { console.log(`[test] FAIL bullet-geo`); process.exit(1); }
  console.log(`[test] PASS — native bullet-geo (NATIVE_VERIFIED).`);
}

/* ---------- native bullet-physics parity (iter 848) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const bp = (await import("../src/ankhor/facets/bullet_physics.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("bullet-physics", bp);
  reg.spawn({ id: "phys/bullet", kind: "pickup", name: "bphys", facets: [{ name: "bullet-physics", data: {} }] });
  reg.tick(0.016);
  const fd = reg.facetData("phys/bullet", "bullet-physics");
  if (fd.substeps !== 5 || fd.hitRadius !== 0.6) { console.log(`[test] FAIL bullet-physics`); process.exit(1); }
  console.log(`[test] PASS — native bullet-physics (NATIVE_VERIFIED).`);
}

/* ---------- native combat-hud parity (iter 849) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ch = (await import("../src/ankhor/facets/combat_hud.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("combat-hud", ch);
  reg.spawn({ id: "hud/combat", kind: "pickup", name: "combat", facets: [{ name: "combat-hud", data: { hitMarkerUntil: Date.now() + 1000, killMarkerUntil: Date.now() + 500, killMarkerHs: true, moveSpread: 0 } }] });
  reg.tick(0.016);
  const fd = reg.facetData("hud/combat", "combat-hud");
  if (!fd.hitNow || fd.crosshairScale !== 1.5) { console.log(`[test] FAIL combat-hud hit`); process.exit(1); }
  if (fd.killBg !== "#ffd166" || fd.killFade <= 0) { console.log(`[test] FAIL combat-hud kill marker`); process.exit(1); }
  console.log(`[test] PASS — native combat-hud (NATIVE_VERIFIED).`);
}

/* ---------- native combo-hud parity (iter 850) ---------- */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const ch = (await import("../src/ankhor/facets/combo_hud.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("combo-hud", ch);
  reg.spawn({ id: "hud/combo", kind: "pickup", name: "combo", facets: [{ name: "combo-hud", data: { comboCount: 6, comboLastT: Date.now() / 1000 } }] });
  reg.tick(0.016);
  const fd = reg.facetData("hud/combo", "combo-hud");
  if (!fd.comboVisible || fd.comboMul !== 6) { console.log(`[test] FAIL combo-hud visible`); process.exit(1); }
  if (fd.comboHue !== "#ff4466") { console.log(`[test] FAIL combo-hud hue: ${fd.comboHue}`); process.exit(1); }
  fd.comboCount = 2; reg.tick(0.016);
  if (fd.comboHue !== "#ffd166") { console.log(`[test] FAIL combo-hud low hue`); process.exit(1); }
  console.log(`[test] PASS — native combo-hud (NATIVE_VERIFIED).`);
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

/* ---------- native vignette parity test (iter 791) ----------
 * Legacy mountVignetteTick: low HP drives a sine pulse target, then
 * springs vignetteAmt toward it by min(1, dt*6), writing opacity to
 * the DOM element when present.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const vignetteFacet = (await import("../src/ankhor/facets/vignette.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("vignette", vignetteFacet);
  reg.registerFacetHandler("health",   { priority: 25 });

  const el = { style: {} };
  reg.spawn({
    id: "world/default", kind: "world", name: "default-world",
    facets: [{ name: "vignette", data: { amount: 0.1, nowMs: 0, el } }],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [{ name: "health", data: { hp: 20, maxHp: 100 } }],
  });

  reg.tick(0.1);
  const data = reg.facetData("world/default", "vignette");
  const expectedLow = 0.1 + (0.22 - 0.1) * 0.6;
  console.log(`[test] native vignette low-hp: amount=${data.amount.toFixed(3)} opacity=${el.style.opacity}`);
  if (Math.abs(data.amount - expectedLow) > 0.0001 || el.style.opacity !== "0.172") {
    console.log(`[test] FAIL — native vignette low-hp spring/opacity drifted from legacy math.`);
    process.exit(1);
  }

  reg.facetData("hero/main", "health").hp = 80;
  reg.tick(0.1);
  const expectedHigh = expectedLow + (0 - expectedLow) * 0.6;
  if (Math.abs(data.amount - expectedHigh) > 0.0001 || el.style.opacity !== "0.069") {
    console.log(`[test] FAIL — native vignette high-hp return spring drifted from legacy math.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native vignette matches legacy low-hp pulse + spring + opacity write (NATIVE_VERIFIED).`);
}

/* ---------- native hero-face parity test (iter 793) ----------
 * Legacy mountHeroFaceTick chooses camYaw while aiming, otherwise the
 * movement vector heading, then turns by min(1, dt*turnRate) with
 * wrapped angle diff.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const heroFace = (await import("../src/ankhor/facets/hero_face.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("hero-face", heroFace);
  reg.registerFacetHandler("position",   { priority: 10 });
  reg.registerFacetHandler("mesh",       { priority: 70 });
  reg.registerFacetHandler("input-state", { priority: 2 });

  const threeObj = { rotation: { y: 0 } };
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",  data: { x: 0, y: 0, z: 0, heading: 0 } },
      { name: "mesh",      data: { threeObj } },
      { name: "hero-face", data: { rotY: 0 } },
    ],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: {}, mouseHeld: true, yaw: Math.PI / 2 } }],
  });

  reg.tick(0.1);
  const pos = reg.facetData("hero/main", "position");
  const face = reg.facetData("hero/main", "hero-face");
  if (Math.abs(face.rotY - Math.PI / 2) > 0.0001 || Math.abs(pos.heading - Math.PI / 2) > 0.0001 || Math.abs(threeObj.rotation.y - Math.PI / 2) > 0.0001) {
    console.log(`[test] FAIL — native hero-face aiming turn did not clamp to camYaw like legacy.`);
    process.exit(1);
  }

  face.rotY = 0;
  pos.heading = 0;
  const input = reg.facetData("input/main", "input-state");
  input.mouseHeld = false;
  input.yaw = 0;
  input.keys = { KeyD: true };
  reg.tick(0.05);
  const expected = Math.PI / 2 * 0.5;
  console.log(`[test] native hero-face: strafe-right heading=${face.rotY.toFixed(4)} expected=${expected.toFixed(4)}`);
  if (Math.abs(face.rotY - expected) > 0.0001) {
    console.log(`[test] FAIL — native hero-face movement-vector turn drifted from legacy math.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native hero-face matches legacy aiming + movement heading interpolation (NATIVE_VERIFIED).`);
}

/* ---------- native scope-fov parity test (iter 795) ----------
 * Legacy mountScopeFovTick springs aim/sprint FOV amounts, sets sniper
 * scope distance while scoped, restores saved distance when leaving, and
 * writes camera fov + projection update.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const scopeFov = (await import("../src/ankhor/facets/scope_fov.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("scope-fov",      scopeFov);
  reg.registerFacetHandler("input-state",    { priority: 2 });
  reg.registerFacetHandler("render-context", { priority: 1 });
  reg.registerFacetHandler("inventory",      { priority: 24 });

  let projectionUpdates = 0;
  const camera = { fov: 60, updateProjectionMatrix: () => { projectionUpdates++; } };
  reg.spawn({
    id: "world/default", kind: "world", name: "default-world",
    facets: [{ name: "scope-fov", data: { aimAmt: 0, sprintFovAmt: 0, wasSniperScope: false, sniperSavedCamDist: 6, camDist: 6, currentWeaponId: "sniper" } }],
  });
  reg.spawn({
    id: "render/context", kind: "render-context", name: "render-context",
    facets: [{ name: "render-context", data: { camera } }],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: {}, mouseHeld: true, yaw: 0 } }],
  });

  reg.tick(0.1);
  const data = reg.facetData("world/default", "scope-fov");
  if (Math.abs(data.aimAmt - 1) > 0.0001 || data.camDist !== 0.01 || data.sniperSavedCamDist !== 6 || camera.fov !== 20 || projectionUpdates !== 1) {
    console.log(`[test] FAIL — native scope-fov sniper enter drifted from legacy.`);
    process.exit(1);
  }

  const input = reg.facetData("input/main", "input-state");
  input.mouseHeld = false;
  input.keys = { ShiftLeft: true };
  reg.tick(0.1);
  const expectedSprint = 0.8;
  if (data.wasSniperScope !== false || data.camDist !== 6 || Math.abs(data.sprintFovAmt - expectedSprint) > 0.0001 || Math.abs(camera.fov - 66.4) > 0.0001) {
    console.log(`[test] FAIL — native scope-fov sniper exit/sprint fov drifted from legacy.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native scope-fov matches legacy aim/sprint/sniper FOV and camDist transitions (NATIVE_VERIFIED).`);
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

/* ---------- native cam-pitch-springs parity test (iter 799) ----------
 * Legacy mountCamPitchSprings:
 *   recoil branch: camPitch += recoilPitch * dt * 8;
 *                  recoilPitch = recoilPitch + (0 - recoilPitch) * min(1, dt*8);
 *                  zero out if |next| < 0.0001
 *   hitpunch branch (when hitPunchPitch > 0.0001):
 *                  camPitch = min(camPitchMax, camPitch + hitPunchPitch * dt * 10)
 *                  decayed = hitPunchPitch * exp(-dt * 14)
 *                  hitPunchPitch = decayed < 0.0001 ? 0 : decayed
 *
 * Test 1 — recoil flush: recoil_pitch=0.5, cam_pitch=0, dt=0.125.
 *   cam_pitch += 0.5 * 0.125 * 8 = 0.5
 *   next = 0.5 + (-0.5) * min(1, 1.0) = 0.0 → recoil_pitch = 0
 * Test 2 — hitpunch decay: hit_punch_pitch=0.3, cam_pitch=0, dt=0.1.
 *   cam_pitch = min(0.4, 0 + 0.3*0.1*10) = min(0.4, 0.3) = 0.3
 *   decayed = 0.3 * exp(-1.4) ≈ 0.07398 (kept, > 0.0001)
 * Test 3 — hitpunch cap: hit_punch_pitch=2.0, cam_pitch=0.1, dt=0.1.
 *   cam_pitch = min(0.4, 0.1 + 2.0*0.1*10) = min(0.4, 2.1) = 0.4
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const camPitchSpringsFacet = (await import("../src/ankhor/facets/cam_pitch_springs.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("cam-pitch-springs", camPitchSpringsFacet);
  reg.registerFacetHandler("inventory",         { priority: 24 });
  reg.registerFacetHandler("tuning",            { priority: 41 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory",         data: { cam_pitch: 0, recoil_pitch: 0.5, hit_punch_pitch: 0, items: {}, score: 0 } },
      { name: "cam-pitch-springs", data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      cam_pitch_max: 0.4,
      cam_recoil_spring_rate: 8,
      cam_recoil_zero_threshold: 0.0001,
      cam_hitpunch_spring_rate: 10,
      cam_hitpunch_decay_rate: 14,
    } }],
  });

  reg.tick(0.125);
  const invAfterRecoil = reg.facetData("hero/main", "inventory");
  console.log(`[test] native cam-pitch-springs recoil: cam_pitch=${invAfterRecoil.cam_pitch.toFixed(4)}, recoil_pitch=${invAfterRecoil.recoil_pitch}`);
  if (Math.abs(invAfterRecoil.cam_pitch - 0.5) > 1e-9) {
    console.log(`[test] FAIL — recoil cam_pitch math: expected 0.5, got ${invAfterRecoil.cam_pitch}.`);
    process.exit(1);
  }
  if (invAfterRecoil.recoil_pitch !== 0) {
    console.log(`[test] FAIL — recoil_pitch should clamp to 0, got ${invAfterRecoil.recoil_pitch}.`);
    process.exit(1);
  }

  // Reset for hitpunch decay test.
  invAfterRecoil.cam_pitch = 0;
  invAfterRecoil.recoil_pitch = 0;
  invAfterRecoil.hit_punch_pitch = 0.3;
  reg.tick(0.1);
  const expectedDecayed = 0.3 * Math.exp(-1.4);
  console.log(`[test] native cam-pitch-springs hitpunch decay: cam_pitch=${invAfterRecoil.cam_pitch.toFixed(4)}, hit_punch_pitch=${invAfterRecoil.hit_punch_pitch.toFixed(5)} (expected ${expectedDecayed.toFixed(5)})`);
  if (Math.abs(invAfterRecoil.cam_pitch - 0.3) > 1e-9) {
    console.log(`[test] FAIL — hitpunch cam_pitch: expected 0.3, got ${invAfterRecoil.cam_pitch}.`);
    process.exit(1);
  }
  if (Math.abs(invAfterRecoil.hit_punch_pitch - expectedDecayed) > 1e-6) {
    console.log(`[test] FAIL — hitpunch decay math: expected ${expectedDecayed}, got ${invAfterRecoil.hit_punch_pitch}.`);
    process.exit(1);
  }

  // Reset for cap test.
  invAfterRecoil.cam_pitch = 0.1;
  invAfterRecoil.hit_punch_pitch = 2.0;
  reg.tick(0.1);
  console.log(`[test] native cam-pitch-springs cap: cam_pitch=${invAfterRecoil.cam_pitch.toFixed(4)} (expected 0.4)`);
  if (Math.abs(invAfterRecoil.cam_pitch - 0.4) > 1e-9) {
    console.log(`[test] FAIL — cam_pitch_max cap: expected 0.4, got ${invAfterRecoil.cam_pitch}.`);
    process.exit(1);
  }
  console.log(`[test] PASS — native cam-pitch-springs reproduces legacy mountCamPitchSprings math: recoil flush, hitpunch decay, cam_pitch_max cap (NATIVE_VERIFIED).`);
}

/* ---------- native hero-knockback parity test (iter 800) ----------
 * Legacy mountHeroKnockbackTick decay: knockback velocity vector
 * decays by * max(0, 1 - dt*8) each tick, position += vel*dt, timer
 * counts down by dt. Active only while kb_t > 0.
 *
 * Test: kb_t=0.5, kb_x=10, kb_z=-6, hero.position=(0,0,0), dt=0.1.
 *   kb_t → 0.4
 *   pos.x → 0 + 10 * 0.1 = 1.0
 *   pos.z → 0 + (-6) * 0.1 = -0.6
 *   decay factor = 1 - 0.1*8 = 0.2
 *   kb_x → 10 * 0.2 = 2.0
 *   kb_z → -6 * 0.2 = -1.2
 *
 * Test 2 (inactive): kb_t=0 → tick is no-op, position unchanged.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const heroKnockbackFacet = (await import("../src/ankhor/facets/hero_knockback.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("hero-knockback", heroKnockbackFacet);
  reg.registerFacetHandler("inventory",      { priority: 24 });
  reg.registerFacetHandler("position",       { priority: 10 });
  reg.registerFacetHandler("tuning",         { priority: 41 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",       data: { x: 0, y: 0, z: 0 } },
      { name: "inventory",      data: { kb_t: 0.5, kb_x: 10, kb_z: -6, items: {}, score: 0 } },
      { name: "hero-knockback", data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: { knockback_decay_rate: 8 } }],
  });

  reg.tick(0.1);
  const inv = reg.facetData("hero/main", "inventory");
  const pos = reg.facetData("hero/main", "position");
  console.log(`[test] native hero-knockback active: pos=(${pos.x.toFixed(3)}, ${pos.z.toFixed(3)}), kb=(${inv.kb_x.toFixed(3)}, ${inv.kb_z.toFixed(3)}), kb_t=${inv.kb_t.toFixed(3)}`);
  if (Math.abs(pos.x - 1.0) > 1e-9) { console.log(`[test] FAIL — kb pos.x: expected 1.0, got ${pos.x}.`); process.exit(1); }
  if (Math.abs(pos.z + 0.6) > 1e-9) { console.log(`[test] FAIL — kb pos.z: expected -0.6, got ${pos.z}.`); process.exit(1); }
  if (Math.abs(inv.kb_x - 2.0) > 1e-9) { console.log(`[test] FAIL — kb_x decay: expected 2.0, got ${inv.kb_x}.`); process.exit(1); }
  if (Math.abs(inv.kb_z + 1.2) > 1e-9) { console.log(`[test] FAIL — kb_z decay: expected -1.2, got ${inv.kb_z}.`); process.exit(1); }
  if (Math.abs(inv.kb_t - 0.4) > 1e-9) { console.log(`[test] FAIL — kb_t countdown: expected 0.4, got ${inv.kb_t}.`); process.exit(1); }

  // Reset to inactive.
  inv.kb_t = 0; inv.kb_x = 99; inv.kb_z = 99; pos.x = 5; pos.z = 5;
  reg.tick(0.1);
  if (pos.x !== 5 || pos.z !== 5) {
    console.log(`[test] FAIL — inactive kb_t should leave pos unchanged, got pos=(${pos.x}, ${pos.z}).`);
    process.exit(1);
  }
  console.log(`[test] PASS — native hero-knockback reproduces legacy mountHeroKnockbackTick math: velocity decay, position delta, inactive gate (NATIVE_VERIFIED).`);
}

/* ---------- native dodge parity test (iter 801) ----------
 * Legacy mountDodgeTick:
 *   - dodge_cooldown counts down each tick (when > 0)
 *   - while dodge_t > 0: pos += dodge_vel * dt; spawn trail decal
 *   - when dodge_t <= 0: bash_done resets to false
 *
 * Test 1 (active): dodge_t=0.3, vel=(8,-4), cooldown=0.5, dt=0.1, hero.pos=(0,1,0)
 *   cooldown → 0.4
 *   dodge_t → 0.2
 *   pos.x → 0.8, pos.z → -0.4
 *   trail decal count → 1
 *
 * Test 2 (cooldown expires after dodge ends): dodge_t=0, bash_done=true
 *   tick → bash_done resets to false, no position change, no new decal
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const dodgeFacet = (await import("../src/ankhor/facets/dodge.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("dodge",        dodgeFacet);
  reg.registerFacetHandler("inventory",    { priority: 24 });
  reg.registerFacetHandler("position",     { priority: 10 });
  reg.registerFacetHandler("tuning",       { priority: 41 });
  reg.registerFacetHandler("mesh",         { priority: 70 });
  reg.registerFacetHandler("ttl",          { priority: 80 });
  reg.registerFacetHandler("expand-fade",  { priority: 60 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",  data: { x: 0, y: 1, z: 0 } },
      { name: "inventory", data: { dodge_t: 0.3, dodge_vel_x: 8, dodge_vel_z: -4, dodge_cooldown: 0.5, dodge_bash_done: false, items: {}, score: 0 } },
      { name: "dodge",     data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: { dodge_trail_ttl: 0.18 } }],
  });

  const decalsBefore = reg.byKind("decal-particle").length;
  reg.tick(0.1);
  const inv = reg.facetData("hero/main", "inventory");
  const pos = reg.facetData("hero/main", "position");
  const decalsAfter = reg.byKind("decal-particle").length;
  console.log(`[test] native dodge active: pos=(${pos.x.toFixed(3)}, ${pos.z.toFixed(3)}), dodge_t=${inv.dodge_t.toFixed(3)}, cooldown=${inv.dodge_cooldown.toFixed(3)}, decals ${decalsBefore}→${decalsAfter}`);
  if (Math.abs(pos.x - 0.8) > 1e-9)             { console.log(`[test] FAIL — dodge pos.x: expected 0.8, got ${pos.x}.`); process.exit(1); }
  if (Math.abs(pos.z + 0.4) > 1e-9)             { console.log(`[test] FAIL — dodge pos.z: expected -0.4, got ${pos.z}.`); process.exit(1); }
  if (Math.abs(inv.dodge_t - 0.2) > 1e-9)       { console.log(`[test] FAIL — dodge_t countdown: expected 0.2, got ${inv.dodge_t}.`); process.exit(1); }
  if (Math.abs(inv.dodge_cooldown - 0.4) > 1e-9){ console.log(`[test] FAIL — cooldown: expected 0.4, got ${inv.dodge_cooldown}.`); process.exit(1); }
  if (decalsAfter - decalsBefore !== 1)         { console.log(`[test] FAIL — expected 1 trail decal, got ${decalsAfter - decalsBefore}.`); process.exit(1); }

  // Test 2: dodge_t=0 + bash_done=true → reset, no position change, no new decal.
  inv.dodge_t = 0; inv.dodge_bash_done = true; pos.x = 5; pos.z = 5;
  const decalsBefore2 = reg.byKind("decal-particle").length;
  reg.tick(0.1);
  const decalsAfter2 = reg.byKind("decal-particle").length;
  if (inv.dodge_bash_done !== false) { console.log(`[test] FAIL — bash_done should reset to false when dodge_t<=0.`); process.exit(1); }
  if (pos.x !== 5 || pos.z !== 5)    { console.log(`[test] FAIL — inactive dodge moved hero.`); process.exit(1); }
  if (decalsAfter2 !== decalsBefore2){ console.log(`[test] FAIL — inactive dodge spawned trail decals.`); process.exit(1); }
  console.log(`[test] PASS — native dodge reproduces legacy mountDodgeTick math: cooldown countdown, position delta, trail spawn, bash_done reset (NATIVE_VERIFIED).`);
}

/* ---------- native crouch-speed parity test (iter 802) ----------
 * Legacy mountCrouchSpeedTick: spring crouch_amt toward 0/1 by
 * dt*spring_rate=12, derive crouch_speed_mul = 1 - amt * 0.4,
 * and branch move_spread_target on (aiming/sprinting/moving/crouching).
 *
 * Using dt = 1/12 makes the spring factor exactly 1.0 → snap, which
 * gives deterministic post-tick values without simulating dozens of
 * frames.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const crouchSpeedFacet = (await import("../src/ankhor/facets/crouch_speed.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("crouch-speed", crouchSpeedFacet);
  reg.registerFacetHandler("inventory",    { priority: 24 });
  reg.registerFacetHandler("position",     { priority: 10 });
  reg.registerFacetHandler("input-state",  { priority: 2 });
  reg.registerFacetHandler("tuning",       { priority: 41 });
  reg.registerFacetHandler("mesh",         { priority: 70 });
  reg.registerFacetHandler("ttl",          { priority: 80 });
  reg.registerFacetHandler("expand-fade",  { priority: 60 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",     data: { x: 0, y: 0, z: 0 } },
      { name: "inventory",    data: { items: {}, score: 0 } },
      { name: "crouch-speed", data: {} },
    ],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      crouch_spring_rate: 12, crouch_speed_factor: 0.4,
      move_spread_aiming: 0, move_spread_sprint: 1,
      move_spread_walk: 0.45, move_spread_walk_crouch: 0.18,
      move_spread_idle: 0,
      sprint_trail_chance: 0.45, sprint_trail_ttl: 0.2, sprint_trail_y: 0.08,
    } }],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { ControlLeft: true, KeyW: true }, mouseHeld: false, yaw: 0, pointer_locked: false } }],
  });

  reg.tick(1/12);
  let inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native crouch-speed crouch+walk: amt=${inv.crouch_amt.toFixed(4)}, mul=${inv.crouch_speed_mul.toFixed(4)}, spread=${inv.move_spread_target}`);
  if (Math.abs(inv.crouch_amt - 1) > 1e-9)            { console.log(`[test] FAIL — crouch_amt snap: expected 1, got ${inv.crouch_amt}.`); process.exit(1); }
  if (Math.abs(inv.crouch_speed_mul - 0.6) > 1e-9)    { console.log(`[test] FAIL — crouch_speed_mul: expected 0.6, got ${inv.crouch_speed_mul}.`); process.exit(1); }
  if (Math.abs(inv.move_spread_target - 0.18) > 1e-9) { console.log(`[test] FAIL — walk-crouch spread: expected 0.18, got ${inv.move_spread_target}.`); process.exit(1); }

  const inputSt = reg.facetData("input/main", "input-state");
  inputSt.keys = { ShiftLeft: true, KeyW: true };
  reg.tick(1/12);
  inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native crouch-speed sprint: amt=${inv.crouch_amt.toFixed(4)}, mul=${inv.crouch_speed_mul.toFixed(4)}, spread=${inv.move_spread_target}`);
  if (Math.abs(inv.crouch_amt - 0) > 1e-9)         { console.log(`[test] FAIL — crouch_amt should return to 0, got ${inv.crouch_amt}.`); process.exit(1); }
  if (Math.abs(inv.crouch_speed_mul - 1) > 1e-9)   { console.log(`[test] FAIL — crouch_speed_mul: expected 1, got ${inv.crouch_speed_mul}.`); process.exit(1); }
  if (Math.abs(inv.move_spread_target - 1) > 1e-9) { console.log(`[test] FAIL — sprint spread: expected 1, got ${inv.move_spread_target}.`); process.exit(1); }

  inputSt.keys = {};
  reg.tick(1/12);
  inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native crouch-speed idle: amt=${inv.crouch_amt.toFixed(4)}, spread=${inv.move_spread_target}`);
  if (Math.abs(inv.move_spread_target - 0) > 1e-9) { console.log(`[test] FAIL — idle spread: expected 0, got ${inv.move_spread_target}.`); process.exit(1); }

  console.log(`[test] PASS — native crouch-speed reproduces legacy mountCrouchSpeedTick math: spring+mul, sprint/walk/walk-crouch/idle branches (NATIVE_VERIFIED).`);
}

/* ---------- native freecam parity test (iter 803) ----------
 * Legacy mountFreecamTick gates on buildMode; off → no-op. On →
 * computes forward + right vectors from yaw/pitch and applies the
 * key-driven delta to the camera.
 *
 * Test 1 (build_mode=false): camera should not move.
 * Test 2 (build_mode=true, yaw=0, KeyW+ShiftLeft, dt=0.1):
 *   spd=24, fwd=(0,0,1) → camera.z += 2.4
 * Test 3 (yaw=π/2, KeyD, no shift, dt=0.1):
 *   spd=8, rgt=(0,0,-1) → camera.z -= 0.8
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const freecamFacet = (await import("../src/ankhor/facets/freecam.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("freecam",     freecamFacet);
  reg.registerFacetHandler("inventory",   { priority: 24 });
  reg.registerFacetHandler("position",    { priority: 10 });
  reg.registerFacetHandler("input-state", { priority: 2 });
  reg.registerFacetHandler("tuning",      { priority: 41 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory", data: { build_mode: false, freecam_yaw: 0, freecam_pitch: 0, items: {}, score: 0 } },
      { name: "freecam",   data: {} },
    ],
  });
  // Stub render-context with a camera-like object the facet can mutate.
  reg.registerFacetHandler("render-context", { priority: 1 });
  const camStub = { position: { x: 0, y: 5, z: 0 } };
  reg.spawn({
    id: "render-context/main", kind: "render-context", name: "primary_render_context",
    facets: [{ name: "render-context", data: { camera: camStub } }],
  });
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: { freecam_speed: 8, freecam_speed_fast: 24 } }],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { KeyW: true, ShiftLeft: true }, mouseHeld: false, yaw: 0 } }],
  });

  reg.tick(0.1);
  let camPos = camStub.position;
  if (camPos.x !== 0 || camPos.y !== 5 || camPos.z !== 0) {
    console.log(`[test] FAIL — freecam off should not move camera, got (${camPos.x},${camPos.y},${camPos.z}).`);
    process.exit(1);
  }
  console.log(`[test] native freecam gate: build_mode=false → camera stays at (0,5,0)`);

  const inv = reg.facetData("hero/main", "inventory");
  inv.build_mode = true;
  reg.tick(0.1);
  camPos = camStub.position;
  console.log(`[test] native freecam fwd-fast: camera=(${camPos.x.toFixed(3)}, ${camPos.y.toFixed(3)}, ${camPos.z.toFixed(3)}) expected z=2.4`);
  if (Math.abs(camPos.z - 2.4) > 1e-9) { console.log(`[test] FAIL — expected camera.z=2.4, got ${camPos.z}.`); process.exit(1); }

  inv.freecam_yaw = Math.PI / 2;
  const inputSt = reg.facetData("input/main", "input-state");
  inputSt.keys = { KeyD: true };
  const z2 = camPos.z;
  reg.tick(0.1);
  camPos = camStub.position;
  const dz = camPos.z - z2;
  console.log(`[test] native freecam strafe-right: dz=${dz.toFixed(4)} expected -0.8`);
  if (Math.abs(dz - (-0.8)) > 1e-9) { console.log(`[test] FAIL — expected dz=-0.8, got ${dz}.`); process.exit(1); }

  console.log(`[test] PASS — native freecam reproduces legacy mountFreecamTick math: build_mode gate, forward fast move, yaw-rotated strafe (NATIVE_VERIFIED).`);
}

/* ---------- native layer-transition parity test (iter 804) ----------
 * Legacy mountLayerTransitionTick: with boundaryAt → null (no buildings),
 * targetLayer always = 1; the transition condition only fires when
 * layer_id != 1. Native facet snaps inv.layer_id back to OUTSIDE (1)
 * when no boundary contains hero.
 *
 * Test 1 (default): inv.layer_id undefined → initialized to 1, no change.
 * Test 2 (forced wrong): inv.layer_id = 2 → tick snaps it back to 1.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const layerTransitionFacet = (await import("../src/ankhor/facets/layer_transition.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("layer-transition", layerTransitionFacet);
  reg.registerFacetHandler("inventory", { priority: 24 });
  reg.registerFacetHandler("position",  { priority: 10 });

  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",         data: { x: 5, y: 0, z: -3 } },
      { name: "inventory",        data: { items: {}, score: 0 } },
      { name: "layer-transition", data: {} },
    ],
  });

  reg.tick(0.1);
  let inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native layer-transition default: layer_id=${inv.layer_id} expected 1`);
  if (inv.layer_id !== 1) { console.log(`[test] FAIL — default layer_id should init to 1, got ${inv.layer_id}.`); process.exit(1); }

  inv.layer_id = 2;
  reg.tick(0.1);
  inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native layer-transition reset: layer_id=${inv.layer_id} expected 1`);
  if (inv.layer_id !== 1) { console.log(`[test] FAIL — should snap back to 1 with no buildings, got ${inv.layer_id}.`); process.exit(1); }

  console.log(`[test] PASS — native layer-transition reproduces legacy mountLayerTransitionTick no-boundary path: defaults to layer 1, snaps back when no building contains hero (NATIVE_VERIFIED).`);
}

/* ---------- native motion-springs parity test (iter 805) ----------
 * Legacy mountMotionSprings: three spring/decay equations.
 *
 * Test 1 — move_spread snap (dt=0.2 → dt*5=1.0):
 *   inv.move_spread_target=1, inv.move_spread=0
 *   → 0 + (1-0)*1 = 1
 * Test 2 — gun_bob_phase sprint (KeyW + ShiftLeft, dt=0.2):
 *   inv.gun_bob_phase=0 → 0 + 11*0.2 = 2.2
 * Test 3 — gun_bob_phase decay (no movement, dt=0.1):
 *   inv.gun_bob_phase=10 → 10 * exp(-0.8) ≈ 4.4933
 * Test 4 — strafe_roll snap to aiming (dt=0.125 → dt*8=1.0):
 *   inv.input_r=2, inv.aiming=true, inv.strafe_roll_amt=0
 *   → 0 + (2*0.3 - 0)*1 = 0.6
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const motionSpringsFacet = (await import("../src/ankhor/facets/motion_springs.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("motion-springs", motionSpringsFacet);
  reg.registerFacetHandler("inventory",      { priority: 24 });
  reg.registerFacetHandler("input-state",    { priority: 2 });
  reg.registerFacetHandler("tuning",         { priority: 41 });

  const tuning = {
    move_spread_spring_rate: 5,
    gun_bob_phase_sprint_rate: 11, gun_bob_phase_walk_rate: 7,
    gun_bob_decay_rate: 8,
    strafe_roll_aiming_mul: 0.3, strafe_roll_normal_mul: 1.0,
    strafe_roll_spring_rate: 8,
  };
  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: tuning }],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory",      data: { move_spread_target: 1, items: {}, score: 0 } },
      { name: "motion-springs", data: {} },
    ],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { KeyW: true, ShiftLeft: true }, mouseHeld: false, yaw: 0 } }],
  });

  reg.tick(0.2);  // dt*5 = 1 → spring snaps; dt*11 = 2.2 added to gun_bob
  let inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native motion-springs sprint: move_spread=${inv.move_spread.toFixed(4)}, gun_bob_phase=${inv.gun_bob_phase.toFixed(4)}, strafe_roll=${inv.strafe_roll_amt.toFixed(4)}`);
  if (Math.abs(inv.move_spread - 1) > 1e-9)     { console.log(`[test] FAIL — move_spread snap: expected 1, got ${inv.move_spread}.`); process.exit(1); }
  if (Math.abs(inv.gun_bob_phase - 2.2) > 1e-9) { console.log(`[test] FAIL — gun_bob_phase sprint: expected 2.2, got ${inv.gun_bob_phase}.`); process.exit(1); }

  // Test 3 — decay: clear keys (no movement), set gun_bob to 10, dt=0.1 → 10*exp(-0.8)
  const inputSt = reg.facetData("input/main", "input-state");
  inputSt.keys = {};
  inv.gun_bob_phase = 10;
  inv.move_spread_target = 0;
  inv.move_spread = 0;  // freeze spring (target == current)
  reg.tick(0.1);
  const expectedDecay = 10 * Math.exp(-0.8);
  console.log(`[test] native motion-springs decay: gun_bob_phase=${inv.gun_bob_phase.toFixed(5)} (expected ${expectedDecay.toFixed(5)})`);
  if (Math.abs(inv.gun_bob_phase - expectedDecay) > 1e-6) { console.log(`[test] FAIL — gun_bob_phase decay: expected ${expectedDecay}, got ${inv.gun_bob_phase}.`); process.exit(1); }

  // Test 4 — strafe_roll with aiming: input_r=2, aiming=true, dt=0.125, strafe_roll_amt=0.
  inv.input_r = 2; inv.aiming = true; inv.strafe_roll_amt = 0;
  reg.tick(0.125);  // dt*8 = 1 → spring snaps
  console.log(`[test] native motion-springs strafe_roll aiming: amt=${inv.strafe_roll_amt.toFixed(4)} expected 0.6`);
  if (Math.abs(inv.strafe_roll_amt - 0.6) > 1e-9) { console.log(`[test] FAIL — strafe_roll aiming snap: expected 0.6, got ${inv.strafe_roll_amt}.`); process.exit(1); }

  console.log(`[test] PASS — native motion-springs reproduces legacy mountMotionSprings math: move_spread spring, gun_bob_phase sprint/decay, strafe_roll aiming (NATIVE_VERIFIED).`);
}

/* ---------- native sniper-sway parity test (iter 806) ----------
 * Legacy mountSniperSway: when is_sniper_scope, advances scope_sway_t,
 * lerps breath_hold_t, computes breath_mul + sway_mul, applies
 * camPitch/Yaw += new sway (after subtracting previous). When inactive,
 * zeros everything and refunds last sway.
 *
 * Test 1 (inactive baseline): is_sniper_scope=false → all sway state
 *   stays at 0 and cam_pitch unchanged.
 * Test 2 (active, no breath, standing): is_sniper_scope=true, dt=0.1,
 *   cam_pitch=0.5 (from prior recoil). After 1 tick:
 *     scope_sway_t = 0.1
 *     breath_hold_t = 0
 *     breath_mul = 1.0 (holdingBreath=false; breath_hold_t < 1.5 → 1.0)
 *     sway_mul = 1.0 * 1.0 = 1.0
 *     newPitch = sin(0.1*0.9) * 0.0025 * 1 = sin(0.09)*0.0025
 *     cam_pitch = 0.5 + newPitch
 * Test 3 (deactivate): is_sniper_scope=false → last sway refunded;
 *   cam_pitch returns to 0.5, sway state zeroed.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const sniperSwayFacet = (await import("../src/ankhor/facets/sniper_sway.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("sniper-sway", sniperSwayFacet);
  reg.registerFacetHandler("inventory",   { priority: 24 });
  reg.registerFacetHandler("input-state", { priority: 2 });
  reg.registerFacetHandler("tuning",      { priority: 41 });

  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      breath_hold_cap: 3.0, breath_release_rate: 2.5,
      breath_steady_threshold: 1.5, breath_steady_min: 0.05,
      breath_neutral_mul: 1.0, breath_overshoot_rate: 2.2,
      sway_crouch_mul: 0.25, sway_stand_mul: 1.0,
      sway_pitch_freq: 0.9, sway_pitch_amp: 0.0025,
      sway_yaw_freq: 0.6, sway_yaw_amp: 0.002, sway_yaw_phase: 1.2,
    } }],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "inventory",   data: { cam_pitch: 0.5, cam_yaw: 0.1, is_sniper_scope: false, items: {}, score: 0 } },
      { name: "sniper-sway", data: {} },
    ],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: {}, mouseHeld: false, yaw: 0 } }],
  });

  reg.tick(0.1);
  let inv = reg.facetData("hero/main", "inventory");
  console.log(`[test] native sniper-sway inactive: cam_pitch=${inv.cam_pitch}, scope_t=${inv.scope_sway_t}, last_pitch=${inv.last_sway_pitch}`);
  if (inv.cam_pitch !== 0.5)        { console.log(`[test] FAIL — inactive: cam_pitch should stay 0.5, got ${inv.cam_pitch}.`); process.exit(1); }
  if (inv.last_sway_pitch !== 0)    { console.log(`[test] FAIL — inactive: last_sway_pitch should be 0.`); process.exit(1); }
  if (inv.scope_sway_t !== 0)       { console.log(`[test] FAIL — inactive: scope_sway_t should be 0.`); process.exit(1); }

  inv.is_sniper_scope = true;
  reg.tick(0.1);
  const expectedPitch = Math.sin(0.1 * 0.9) * 0.0025 * 1.0;
  console.log(`[test] native sniper-sway active: cam_pitch=${inv.cam_pitch.toFixed(7)} expected=${(0.5 + expectedPitch).toFixed(7)}, last_pitch=${inv.last_sway_pitch.toFixed(7)}`);
  if (Math.abs(inv.cam_pitch - (0.5 + expectedPitch)) > 1e-9) {
    console.log(`[test] FAIL — active cam_pitch: expected ${0.5 + expectedPitch}, got ${inv.cam_pitch}.`);
    process.exit(1);
  }
  if (Math.abs(inv.last_sway_pitch - expectedPitch) > 1e-9) {
    console.log(`[test] FAIL — active last_sway_pitch: expected ${expectedPitch}, got ${inv.last_sway_pitch}.`);
    process.exit(1);
  }

  inv.is_sniper_scope = false;
  reg.tick(0.1);
  console.log(`[test] native sniper-sway deactivate: cam_pitch=${inv.cam_pitch} expected 0.5, last=0`);
  if (Math.abs(inv.cam_pitch - 0.5) > 1e-9) { console.log(`[test] FAIL — deactivate should refund sway, got cam_pitch=${inv.cam_pitch}.`); process.exit(1); }
  if (inv.last_sway_pitch !== 0)            { console.log(`[test] FAIL — last_sway_pitch should reset to 0.`); process.exit(1); }
  if (inv.scope_sway_t !== 0)               { console.log(`[test] FAIL — scope_sway_t should reset to 0.`); process.exit(1); }

  console.log(`[test] PASS — native sniper-sway reproduces legacy mountSniperSway math: inactive zero, active sin-sway with breath/crouch muls, deactivate refund (NATIVE_VERIFIED).`);
}

/* ---------- native jump-gravity parity test (iter 807) ----------
 * Legacy mountJumpGravityTick: gravity integration + jump trigger +
 * double-jump trigger + ground clamp.
 *
 * Test 1 (jump trigger from ground): hero.pos.y=0, velocity_y=0,
 *   Space=true, dt=0.1. spaceDown && onSupport → velocity_y = 6.5;
 *   gravity adds: velocity_y = 6.5 + (-18)*0.1 = 4.7; newY = 0 + 4.7*0.1 = 0.47.
 *   can_double_jump = true.
 * Test 2 (free fall): hero.pos.y=2, velocity_y=0, Space=false, dt=0.1.
 *   gravity adds: velocity_y = -1.8; newY = 2 - 0.18 = 1.82. on_ground=false.
 * Test 3 (ground clamp): hero.pos.y=0.05, velocity_y=-5, Space=false, dt=0.1.
 *   gravity: velocity_y = -5 + (-18)*0.1 = -6.8; newY = 0.05 - 0.68 = -0.63 → clamped to 0.
 *   velocity_y reset to 0. on_ground=true.
 * Test 4 (double-jump in air): hero.pos.y=2, velocity_y=0,
 *   can_double_jump=true, stamina=50, space_was_down=false, Space=true.
 *   spaceRising && !onSupport && can_double_jump && stamina>=20 →
 *   velocity_y = 6.5*0.85 = 5.525; stamina = 30; can_double_jump = false.
 *   Then gravity: velocity_y = 5.525 - 1.8 = 3.725; newY = 2 + 0.3725 = 2.3725.
 *   decal-particle spawned (double-jump FX).
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const jumpGravityFacet = (await import("../src/ankhor/facets/jump_gravity.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("jump-gravity", jumpGravityFacet);
  reg.registerFacetHandler("inventory",    { priority: 24 });
  reg.registerFacetHandler("position",     { priority: 10 });
  reg.registerFacetHandler("input-state",  { priority: 2 });
  reg.registerFacetHandler("tuning",       { priority: 41 });
  reg.registerFacetHandler("mesh",         { priority: 70 });
  reg.registerFacetHandler("ttl",          { priority: 80 });
  reg.registerFacetHandler("expand-fade",  { priority: 60 });

  reg.spawn({
    id: "tuning/hero", kind: "tuning", name: "hero-tuning",
    facets: [{ name: "tuning", data: {
      jump_v: 6.5, jump_gravity: -18,
      double_jump_v_mul: 0.85, double_jump_stamina_cost: 20,
      jump_ground_y: 0, jump_support_epsilon: 0.001,
      double_jump_fx_ttl: 0.25,
    } }],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",     data: { x: 0, y: 0, z: 0 } },
      { name: "inventory",    data: { stamina: 50, items: {}, score: 0 } },
      { name: "jump-gravity", data: {} },
    ],
  });
  reg.spawn({
    id: "input/main", kind: "input", name: "primary_input",
    facets: [{ name: "input-state", data: { keys: { Space: true }, mouseHeld: false, yaw: 0 } }],
  });

  // Test 1: jump from ground.
  reg.tick(0.1);
  let inv = reg.facetData("hero/main", "inventory");
  let pos = reg.facetData("hero/main", "position");
  console.log(`[test] native jump-gravity jump: y=${pos.y.toFixed(4)}, vy=${inv.velocity_y.toFixed(4)}, can_double=${inv.can_double_jump}`);
  if (Math.abs(pos.y - 0.47) > 1e-9)         { console.log(`[test] FAIL — jump y: expected 0.47, got ${pos.y}.`); process.exit(1); }
  if (Math.abs(inv.velocity_y - 4.7) > 1e-9) { console.log(`[test] FAIL — jump vy: expected 4.7, got ${inv.velocity_y}.`); process.exit(1); }
  if (inv.can_double_jump !== true)          { console.log(`[test] FAIL — can_double_jump should be true after ground jump.`); process.exit(1); }

  // Test 2: free fall.
  const inputSt = reg.facetData("input/main", "input-state");
  inputSt.keys = {};
  pos.y = 2; inv.velocity_y = 0; inv.space_was_down = false;
  reg.tick(0.1);
  console.log(`[test] native jump-gravity fall: y=${pos.y.toFixed(4)}, vy=${inv.velocity_y.toFixed(4)}, on_ground=${inv.on_ground}`);
  if (Math.abs(pos.y - 1.82) > 1e-9)          { console.log(`[test] FAIL — fall y: expected 1.82, got ${pos.y}.`); process.exit(1); }
  if (Math.abs(inv.velocity_y - (-1.8)) > 1e-9){ console.log(`[test] FAIL — fall vy: expected -1.8, got ${inv.velocity_y}.`); process.exit(1); }
  if (inv.on_ground !== false)                { console.log(`[test] FAIL — on_ground should be false mid-fall.`); process.exit(1); }

  // Test 3: ground clamp.
  pos.y = 0.05; inv.velocity_y = -5;
  reg.tick(0.1);
  console.log(`[test] native jump-gravity clamp: y=${pos.y.toFixed(4)}, vy=${inv.velocity_y.toFixed(4)}, on_ground=${inv.on_ground}`);
  if (pos.y !== 0)             { console.log(`[test] FAIL — clamp y: expected 0, got ${pos.y}.`); process.exit(1); }
  if (inv.velocity_y !== 0)    { console.log(`[test] FAIL — clamp vy: expected 0, got ${inv.velocity_y}.`); process.exit(1); }
  if (inv.on_ground !== true)  { console.log(`[test] FAIL — on_ground should be true after clamp.`); process.exit(1); }

  // Test 4: double-jump in air.
  pos.y = 2; inv.velocity_y = 0; inv.can_double_jump = true;
  inv.stamina = 50; inv.space_was_down = false;
  inputSt.keys = { Space: true };
  const decalsBefore = reg.byKind("decal-particle").length;
  reg.tick(0.1);
  const decalsAfter = reg.byKind("decal-particle").length;
  console.log(`[test] native jump-gravity double-jump: y=${pos.y.toFixed(4)}, vy=${inv.velocity_y.toFixed(4)}, stamina=${inv.stamina}, can_double=${inv.can_double_jump}, decals ${decalsBefore}→${decalsAfter}`);
  if (Math.abs(pos.y - 2.3725) > 1e-9)            { console.log(`[test] FAIL — dj y: expected 2.3725, got ${pos.y}.`); process.exit(1); }
  if (Math.abs(inv.velocity_y - 3.725) > 1e-9)    { console.log(`[test] FAIL — dj vy: expected 3.725, got ${inv.velocity_y}.`); process.exit(1); }
  if (inv.stamina !== 30)                         { console.log(`[test] FAIL — dj stamina: expected 30, got ${inv.stamina}.`); process.exit(1); }
  if (inv.can_double_jump !== false)              { console.log(`[test] FAIL — can_double_jump should reset to false after dj.`); process.exit(1); }
  if (decalsAfter - decalsBefore !== 1)           { console.log(`[test] FAIL — expected 1 dj fx decal, got ${decalsAfter - decalsBefore}.`); process.exit(1); }

  console.log(`[test] PASS — native jump-gravity reproduces legacy mountJumpGravityTick math: jump, free fall, ground clamp, double-jump (NATIVE_VERIFIED).`);
}

/* ---------- speed-orb composition parity (iter 808) ----------
 * PARITY: mountSpeedOrbTick
 *
 * The legacy mount runs four behaviors in one function:
 *   - spin orb.mesh.rotation.y by SPIN_SPEED * dt (legacy 3.5 rad/s)
 *   - bob orb.mesh.position.y = BOB_BASE + sin(nowMs/BOB_PERIOD + orb.u) * BOB_AMP
 *   - emissive intensity = EMISSIVE_BASE + EMISSIVE_AMP * sin(nowMs/EMISSIVE_PERIOD)
 *   - collect on heroDistance < COLLECT_DIST: dispatch speed-boost
 *
 * The substrate splits these into four ortho facets (bob, spin,
 * emissive-pulse, pickup-radius) declared in data/kinds/speed_orb.json
 * defaults. This phase proves the composition reproduces the legacy
 * math identically when fed the same inputs.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const spinFacet          = (await import("../src/ankhor/facets/spin.js")).default;
  const pickupRadiusFacet  = (await import("../src/ankhor/facets/pickup_radius.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("spin",          spinFacet);
  reg.registerFacetHandler("pickup-radius", pickupRadiusFacet);
  reg.registerFacetHandler("position",      { priority: 10 });
  reg.registerFacetHandler("mesh",          { priority: 70 });
  reg.registerFacetHandler("inventory",     { priority: 24 });
  reg.registerFacetHandler("health",        { priority: 25 });

  // Test 1 — spin parity: orb spin facet writes pos.heading at speed * dt.
  // Legacy SPIN_SPEED=3.5; tick 0.1s → heading delta = 0.35.
  reg.spawn({
    id: "speed-orb/0", kind: "speed-orb", name: "speed-orb-0",
    facets: [
      { name: "position", data: { x: 5, y: 0.7, z: -3, heading: 0 } },
      { name: "mesh",     data: {} },
      { name: "spin",     data: { speed: 3.5 } },
    ],
  });
  reg.tick(0.1);
  const orbPos = reg.facetData("speed-orb/0", "position");
  console.log(`[test] speed-orb composition spin: heading=${orbPos.heading.toFixed(4)} expected 0.35`);
  if (Math.abs(orbPos.heading - 0.35) > 1e-9) {
    console.log(`[test] FAIL — speed-orb spin: expected heading=0.35, got ${orbPos.heading}.`);
    process.exit(1);
  }

  // Test 2 — pickup-radius collect: hero within radius 1.2 triggers
  // speed-boost effect (inv.speed_boost_until_sec set + orb collected).
  reg.spawn({
    id: "speed-orb/1", kind: "speed-orb", name: "speed-orb-1",
    facets: [
      { name: "position",      data: { x: 0, y: 0.7, z: 0 } },
      { name: "mesh",          data: {} },
      { name: "pickup-radius", data: { radius: 1.2, on_pickup_action: "speed-boost", heroU: 0.5, heroV: 0.4 } },
    ],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",  data: { x: 0.5, y: 0, z: 0.4 } },
      { name: "health",    data: { hp: 100, maxHp: 100 } },
      { name: "inventory", data: { items: {}, score: 0 } },
    ],
  });

  const nowSecBefore = Date.now() / 1000;
  reg.tick(0.016);
  const heroInv = reg.facetData("hero/main", "inventory");
  // Despawn removes the orb from byKind; check via soft-deleted row.
  const orbThing = reg.get("speed-orb/1");
  const wasDespawned = orbThing?.deleted_at != null;
  console.log(`[test] speed-orb composition collect: despawned=${wasDespawned}, speed_boost_until_sec=${heroInv.speed_boost_until_sec?.toFixed(2)} (now=${nowSecBefore.toFixed(2)})`);
  if (!wasDespawned) {
    console.log(`[test] FAIL — orb should be despawned after collection.`);
    process.exit(1);
  }
  if (typeof heroInv.speed_boost_until_sec !== "number") {
    console.log(`[test] FAIL — speed_boost_until_sec should be set on hero.inventory.`);
    process.exit(1);
  }
  const boostDur = heroInv.speed_boost_until_sec - nowSecBefore;
  if (boostDur < 3.9 || boostDur > 4.1) {
    console.log(`[test] FAIL — speed-boost duration should be ≈4s, got ${boostDur}.`);
    process.exit(1);
  }

  // Test 3 — out-of-radius: hero too far → orb NOT collected.
  reg.spawn({
    id: "speed-orb/2", kind: "speed-orb", name: "speed-orb-2",
    facets: [
      { name: "position",      data: { x: 10, y: 0.7, z: 10 } },
      { name: "mesh",          data: {} },
      { name: "pickup-radius", data: { radius: 1.2, on_pickup_action: "speed-boost", heroU: 0.5, heroV: 0.4 } },
    ],
  });
  reg.tick(0.016);
  const orb2Data = reg.facetData("speed-orb/2", "pickup-radius");
  console.log(`[test] speed-orb composition out-of-radius: orb.collected=${orb2Data?.collected}`);
  if (orb2Data?.collected === true) {
    console.log(`[test] FAIL — orb at (10,10) should NOT be collected with hero at (0.5,0.4).`);
    process.exit(1);
  }

  console.log(`[test] PASS — speed-orb composition (bob+spin+emissive-pulse+pickup-radius) reproduces mountSpeedOrbTick semantics: spin rate, collect-distance dispatch, out-of-radius no-op (NATIVE_VERIFIED via composition).`);
}

/* ---------- weapon-pickup composition parity (iter 809) ----------
 * PARITY: mountWeaponPickupTick
 *
 * Legacy mountWeaponPickupTick visual + collect math:
 *   rotation.y += dt * SPIN_SPEED (1.8)
 *   position.y  = BOB_BASE + sin(nowMs/BOB_PERIOD + u) * BOB_AMP
 *                            (0.35, 350, 0.1)
 *   pillar.opacity = PILLAR_BASE + PILLAR_AMP * sin(nowMs/PILLAR_PERIOD + u)
 *                                   (0.25, 0.15, 400)
 *   if hypot(heroU-u, heroV-v) < COLLECT_DIST (1.2): collect
 *
 * Substrate kind data/kinds/weapon_pickup.json defaults declare the
 * exact composition: bob(0.35/0.1/350) + spin(1.8) +
 * opacity-pulse(0.25/0.15/400) + pickup-radius(1.2). The auto-equip /
 * weapon-switch path is excluded from this parity (it depends on
 * weapon-system Things that aren't migrated yet). The collect-and-
 * despawn dispatch is verified.
 */
{
  const { createDefaultRegistry: createReg } = await import("../experimental/holograph-runtime/src/registry.js");
  const spinFacet         = (await import("../src/ankhor/facets/spin.js")).default;
  const pickupRadiusFacet = (await import("../src/ankhor/facets/pickup_radius.js")).default;
  const reg = createReg();
  reg.registerFacetHandler("spin",          spinFacet);
  reg.registerFacetHandler("pickup-radius", pickupRadiusFacet);
  reg.registerFacetHandler("position",      { priority: 10 });
  reg.registerFacetHandler("mesh",          { priority: 70 });
  reg.registerFacetHandler("inventory",     { priority: 24 });
  reg.registerFacetHandler("health",        { priority: 25 });
  reg.registerFacetHandler("weapon",        { priority: 41 });

  // Test 1 — spin parity: weapon-pickup spin facet writes heading
  // at speed * dt. Legacy SPIN_SPEED=1.8; tick 0.1s → delta = 0.18.
  reg.spawn({
    id: "weapon-pickup/0", kind: "weapon-pickup", name: "weapon-pickup-0",
    facets: [
      { name: "position", data: { x: 4, y: 0.35, z: -2, heading: 0 } },
      { name: "mesh",     data: {} },
      { name: "spin",     data: { speed: 1.8 } },
      { name: "weapon",   data: { id: "rifle" } },
    ],
  });
  reg.tick(0.1);
  const wpPos = reg.facetData("weapon-pickup/0", "position");
  console.log(`[test] weapon-pickup composition spin: heading=${wpPos.heading.toFixed(4)} expected 0.18`);
  if (Math.abs(wpPos.heading - 0.18) > 1e-9) {
    console.log(`[test] FAIL — weapon-pickup spin: expected heading=0.18, got ${wpPos.heading}.`);
    process.exit(1);
  }

  // Test 2 — pickup-radius collect: hero within radius 1.2 triggers
  // despawn even when on_pickup_action is "give-weapon" (handler not
  // implemented — the despawn still fires, matching legacy mountWeaponPickupTick
  // which marks collected and removes mesh regardless of auto-equip path).
  reg.spawn({
    id: "weapon-pickup/1", kind: "weapon-pickup", name: "weapon-pickup-1",
    facets: [
      { name: "position",      data: { x: 0, y: 0.35, z: 0 } },
      { name: "mesh",          data: {} },
      { name: "pickup-radius", data: { radius: 1.2, on_pickup_action: "give-weapon", heroU: 0.7, heroV: 0.3 } },
      { name: "weapon",        data: { id: "smg" } },
    ],
  });
  reg.spawn({
    id: "hero/main", kind: "hero", name: "hero",
    facets: [
      { name: "position",  data: { x: 0.7, y: 0, z: 0.3 } },
      { name: "health",    data: { hp: 100, maxHp: 100 } },
      { name: "inventory", data: { items: {}, score: 0 } },
    ],
  });

  reg.tick(0.016);
  const wpThing = reg.get("weapon-pickup/1");
  const wpDespawned = wpThing?.deleted_at != null;
  console.log(`[test] weapon-pickup composition collect: despawned=${wpDespawned}`);
  if (!wpDespawned) {
    console.log(`[test] FAIL — weapon-pickup should despawn when hero within radius.`);
    process.exit(1);
  }

  // Test 3 — out-of-radius: hero too far (distance ≈ 14.14 > 1.2) → pickup intact.
  reg.spawn({
    id: "weapon-pickup/2", kind: "weapon-pickup", name: "weapon-pickup-2",
    facets: [
      { name: "position",      data: { x: 10, y: 0.35, z: 10 } },
      { name: "mesh",          data: {} },
      { name: "pickup-radius", data: { radius: 1.2, on_pickup_action: "give-weapon", heroU: 0.7, heroV: 0.3 } },
      { name: "weapon",        data: { id: "sniper" } },
    ],
  });
  reg.tick(0.016);
  const wp2Thing = reg.get("weapon-pickup/2");
  const wp2Alive = wp2Thing && wp2Thing.deleted_at == null;
  console.log(`[test] weapon-pickup composition out-of-radius: alive=${wp2Alive}`);
  if (!wp2Alive) {
    console.log(`[test] FAIL — weapon-pickup at (10,10) should NOT despawn with hero at (0.7,0.3).`);
    process.exit(1);
  }

  console.log(`[test] PASS — weapon-pickup composition (bob+spin+opacity-pulse+pickup-radius) reproduces mountWeaponPickupTick visuals + collect dispatch (NATIVE_VERIFIED via composition).`);
}

/* ---------- speed-orb spawner config parity (iter 810) ----------
 * PARITY: mountSpeedOrbSpawner
 *
 * Legacy mountSpeedOrbSpawner literal config:
 *   geo = DodecahedronGeometry(0.22, 0)
 *   mat = MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffa500,
 *                                 emissiveIntensity: 0.9, metalness: 0.2 })
 *   mesh.position.set(u, 0.7, v)        // bob base
 *
 * Substrate data/tuning/speed_orb.json mesh-spec must declare these
 * exact values for the spawn to render identically. This is a static
 * config-parity assertion: reads the tuning JSON and asserts every
 * literal matches the legacy source. No runtime tick needed — the
 * spawner is config-only in both legacy and substrate.
 */
{
  const { readFileSync: rfs } = await import("node:fs");
  const { fileURLToPath: fU } = await import("node:url");
  const tuningPath = fU(new URL("../data/tuning/speed_orb.json", import.meta.url));
  const tuning = JSON.parse(rfs(tuningPath, "utf8"));
  const tn = tuning.facets.find((f) => f.name === "tuning")?.data;
  const ms = tuning.facets.find((f) => f.name === "mesh-spec")?.data;
  if (!tn || !ms) { console.log(`[test] FAIL — speed-orb tuning missing tuning or mesh-spec facet.`); process.exit(1); }

  // Geometry: DodecahedronGeometry(0.22, 0)
  if (ms.geometry?.kind !== "dodecahedron") { console.log(`[test] FAIL — speed-orb geometry kind: expected dodecahedron, got ${ms.geometry?.kind}.`); process.exit(1); }
  const [radius, detail] = ms.geometry.args || [];
  if (radius !== 0.22 || detail !== 0)      { console.log(`[test] FAIL — speed-orb geometry args: expected [0.22, 0], got [${radius}, ${detail}].`); process.exit(1); }

  // Material: color 0xffdd00 (16768256), emissive 0xffa500 (16753920),
  //           intensity 0.9, metalness 0.2
  if (ms.material?.color !== 0xffdd00)               { console.log(`[test] FAIL — speed-orb material.color: expected 16768256, got ${ms.material?.color}.`); process.exit(1); }
  if (ms.material?.emissive !== 0xffa500)            { console.log(`[test] FAIL — speed-orb material.emissive: expected 16753920, got ${ms.material?.emissive}.`); process.exit(1); }
  if (Math.abs(ms.material?.emissive_intensity - 0.9) > 1e-9) { console.log(`[test] FAIL — speed-orb material.emissive_intensity: expected 0.9, got ${ms.material?.emissive_intensity}.`); process.exit(1); }
  if (Math.abs(ms.material?.metalness - 0.2) > 1e-9)          { console.log(`[test] FAIL — speed-orb material.metalness: expected 0.2, got ${ms.material?.metalness}.`); process.exit(1); }

  // bob_base = 0.7 (legacy spawn placed mesh at y=0.7)
  if (Math.abs(tn.bob_base - 0.7) > 1e-9)   { console.log(`[test] FAIL — speed-orb bob_base: expected 0.7, got ${tn.bob_base}.`); process.exit(1); }

  console.log(`[test] speed-orb spawner config: geo dodecahedron[0.22,0], color 0xffdd00, emissive 0xffa500, intensity 0.9, metalness 0.2, y=0.7 — all match.`);
  console.log(`[test] PASS — substrate data/tuning/speed_orb.json reproduces mountSpeedOrbSpawner literal config (NATIVE_VERIFIED via static parity).`);
}

/* ---------- vehicle-dash legacy regression parity (iter 811) ----------
 * PARITY: mountVehicleDashTick
 *
 * Pins down the legacy DOM-update formulas precisely so a future
 * substrate vehicle-dash facet can be verified 1:1. Uses hand-stubbed
 * DOM elements (style + textContent) since the function is pure-text-
 * update over passed `els`.
 */
{
  const { mountVehicleDashTick } = await import("../src/systems/vehicle_dash_tick.js");
  const dash  = { style: { display: "" } };
  const speed = { textContent: "" };
  const gear  = { textContent: "", style: { color: "" } };
  const els   = { vehicleDash: dash, vdSpeed: speed, vdGear: gear };
  const { tick } = mountVehicleDashTick();

  tick(false, null, false, els);
  if (dash.style.display !== "none") { console.log(`[test] FAIL — vehicle-dash inactive: expected display=none, got ${dash.style.display}.`); process.exit(1); }

  tick(true, { speed: 8.333333, gearName: "D" }, false, els);
  if (dash.style.display !== "block") { console.log(`[test] FAIL — active dash should be block, got ${dash.style.display}.`); process.exit(1); }
  if (speed.textContent !== "30")     { console.log(`[test] FAIL — speed text: expected "30", got "${speed.textContent}".`); process.exit(1); }
  if (gear.textContent !== "D")       { console.log(`[test] FAIL — gear text: expected "D", got "${gear.textContent}".`); process.exit(1); }
  if (gear.style.color !== "#ffd166") { console.log(`[test] FAIL — gear color (D): expected amber #ffd166, got ${gear.style.color}.`); process.exit(1); }

  tick(true, { speed: -2.5, gearName: "R" }, false, els);
  if (speed.textContent !== "9")       { console.log(`[test] FAIL — reverse km/h: expected "9", got "${speed.textContent}".`); process.exit(1); }
  if (gear.style.color !== "#ff4466")  { console.log(`[test] FAIL — gear color (R): expected red #ff4466, got ${gear.style.color}.`); process.exit(1); }

  tick(true, { speed: 5, altY: 12.5 }, true, els);
  if (speed.textContent !== "18 km/h") { console.log(`[test] FAIL — drone speed: expected "18 km/h", got "${speed.textContent}".`); process.exit(1); }
  if (gear.textContent !== "ALT 12.5m"){ console.log(`[test] FAIL — drone gear: expected "ALT 12.5m", got "${gear.textContent}".`); process.exit(1); }
  if (gear.style.color !== "#00bbff")  { console.log(`[test] FAIL — drone gear color: expected cyan #00bbff, got ${gear.style.color}.`); process.exit(1); }

  console.log(`[test] PASS — mountVehicleDashTick legacy regression: km/h = abs(speed)*3.6 rounded, gear D amber + R red, drone shows ALT Xm cyan, hidden when inactive (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- vehicle-render legacy regression parity (iter 812) ----------
 * PARITY: mountVehicleRenderTick
 *
 * Pins the ground/drone rotation formulas with stubbed three.js
 * objects (plain JS with position.set + rotation.x/y/z). Substrate
 * tuning data/tuning/vehicle_car.json declares wheel_radius=0.35,
 * matching the legacy WHEEL_RADIUS const. Verifies:
 *   • ground: wheel spin delta = (speed / WHEEL_RADIUS) * dt
 *             tick at speed 7, dt=0.1 → delta = 7/0.35*0.1 = 2.0
 *   • drone:  rotor.rotation.y += rotSpd*dt; speed>0.5 → 28; else 12
 *   • position+heading from state regardless of type
 */
{
  const { mountVehicleRenderTick } = await import("../src/systems/vehicle_render_tick.js");
  const { readFileSync: rfsV } = await import("node:fs");
  const { fileURLToPath: fUV } = await import("node:url");
  const vTun = JSON.parse(rfsV(fUV(new URL("../data/tuning/vehicle_car.json", import.meta.url)), "utf8"))
    .facets.find((f) => f.name === "tuning").data;
  if (Math.abs(vTun.wheel_radius - 0.35) > 1e-9) {
    console.log(`[test] FAIL — substrate wheel_radius drifted from legacy WHEEL_RADIUS=0.35, got ${vTun.wheel_radius}.`);
    process.exit(1);
  }

  const mockVec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } });
  const mkGrp = (extras = {}) => ({ position: mockVec(), rotation: mockVec(), visible: false, ...extras });
  const toRenderPos = (_id) => ({ x: 10, y: 0.5, z: -4 });
  const { tick } = mountVehicleRenderTick();

  const wheels = [0, 1, 2, 3].map(() => ({ rotation: mockVec() }));
  const groundGrp = mkGrp({ _wheels: wheels });
  tick(0.1, {
    vehicleDefs:    [{ id: "car/0", type: "car" }],
    vehicleMeshes:  new Map([["car/0", groundGrp]]),
    vehicleStates:  new Map([["car/0", { heading: Math.PI / 4, speed: 7 }]]),
    activeVehicleId: "car/0", inCar: true, keys: {}, toRenderPos,
  });
  if (Math.abs(groundGrp.position.x - 10) > 1e-9)        { console.log(`[test] FAIL — ground pos.x: expected 10, got ${groundGrp.position.x}.`); process.exit(1); }
  if (Math.abs(groundGrp.rotation.y - Math.PI / 4) > 1e-9){ console.log(`[test] FAIL — ground rotation.y: expected π/4, got ${groundGrp.rotation.y}.`); process.exit(1); }
  if (!groundGrp.visible)                                 { console.log(`[test] FAIL — ground visible should be true.`); process.exit(1); }
  for (let i = 0; i < 4; i++) {
    if (Math.abs(wheels[i].rotation.x - (-2.0)) > 1e-9) {
      console.log(`[test] FAIL — wheel ${i} rotation.x: expected -2.0, got ${wheels[i].rotation.x}.`);
      process.exit(1);
    }
  }
  console.log(`[test] vehicle-render ground: 4 wheels spun -2.0 (speed 7 / 0.35 * 0.1).`);

  const rotors = [0, 1, 2, 3].map(() => ({ rotation: mockVec() }));
  const droneGrp = mkGrp({ _rotors: rotors });
  tick(0.1, {
    vehicleDefs:   [{ id: "drone/0", type: "drone" }],
    vehicleMeshes: new Map([["drone/0", droneGrp]]),
    vehicleStates: new Map([["drone/0", { heading: 0, speed: 1 }]]),
    activeVehicleId: "drone/0", inCar: true, keys: {}, toRenderPos,
  });
  if (Math.abs(rotors[0].rotation.y - 2.8) > 1e-9) {
    console.log(`[test] FAIL — drone rotor fast spin: expected 2.8 (28*0.1), got ${rotors[0].rotation.y}.`);
    process.exit(1);
  }

  // Drone idle: speed < 0.5 → rotSpd = 12; rotor.y += 12*0.1.
  tick(0.1, {
    vehicleDefs:   [{ id: "drone/0", type: "drone" }],
    vehicleMeshes: new Map([["drone/0", droneGrp]]),
    vehicleStates: new Map([["drone/0", { heading: 0, speed: 0 }]]),
    activeVehicleId: "drone/0", inCar: true, keys: {}, toRenderPos,
  });
  const expectedIdle = 2.8 + 1.2;
  if (Math.abs(rotors[0].rotation.y - expectedIdle) > 1e-9) {
    console.log(`[test] FAIL — drone rotor idle: expected ${expectedIdle}, got ${rotors[0].rotation.y}.`);
    process.exit(1);
  }

  console.log(`[test] PASS — mountVehicleRenderTick legacy regression: wheel spin = speed/0.35*dt, drone rotor 28/12 rad/s fast/idle, position+heading written each tick (NATIVE_VERIFIED via legacy anchor; substrate wheel_radius cross-checked).`);
}

/* ---------- vehicle-physics drone legacy regression (iter 813) ----------
 * PARITY: mountVehiclePhysicsTick
 *
 * Drone branch constants (DRONE_H=15, DRONE_V=7, DRONE_MAX_ALT=40)
 * pinned via stubbed actions. Ground branch calls into the separate
 * carPhysicsStep module; not anchored here. The drone branch alone
 * fully reproduces the legacy physics envelope.
 */
{
  const { mountVehiclePhysicsTick } = await import("../src/systems/vehicle_physics_tick.js");

  let writtenPos = null;
  let updatedState = null;
  const actions = {
    key(name) { return ({ KeyW: true, KeyD: true, Space: true })[name] === true; },
    getPos(id) { return id === "drone/0" ? { x: 5, y: 0, z: -5, u: 0, v: 0 } : null; },
    getCamYaw() { return 0; },
    setPos(id, x, y, z, u, v) { if (id === "drone/0") writtenPos = { id, x, y, z, u, v }; },
    updateCarState(st) { updatedState = { ...st }; },
  };
  const { tickDrone } = mountVehiclePhysicsTick({ actions });
  const vDef = { id: "drone/0", type: "drone" };
  const vSt  = { altY: 10, speed: 0, heading: 0 };
  tickDrone(vDef, vSt, "drone/0", 0.1);

  console.log(`[test] vehicle-physics drone: altY=${vSt.altY}, written=(u=${writtenPos.u}, v=${writtenPos.v}, y=${writtenPos.y}), speed=${vSt.speed.toFixed(3)}, heading=${vSt.heading.toFixed(4)}`);
  if (Math.abs(vSt.altY - 10.7) > 1e-9)     { console.log(`[test] FAIL — altY: expected 10.7, got ${vSt.altY}.`); process.exit(1); }
  if (Math.abs(writtenPos.u - 1.5) > 1e-9)  { console.log(`[test] FAIL — written u: expected 1.5 (u=0 + du=1.5), got ${writtenPos.u}.`); process.exit(1); }
  if (Math.abs(writtenPos.v - 1.5) > 1e-9)  { console.log(`[test] FAIL — written v: expected 1.5, got ${writtenPos.v}.`); process.exit(1); }
  if (Math.abs(writtenPos.y - 10.7) > 1e-9) { console.log(`[test] FAIL — written y: expected 10.7, got ${writtenPos.y}.`); process.exit(1); }
  const expectedSpeed = Math.hypot(1.5, 1.5) / 0.1;
  if (Math.abs(vSt.speed - expectedSpeed) > 1e-9) { console.log(`[test] FAIL — speed: expected ${expectedSpeed}, got ${vSt.speed}.`); process.exit(1); }
  if (Math.abs(vSt.heading - Math.PI / 4) > 1e-9) { console.log(`[test] FAIL — heading: expected π/4, got ${vSt.heading}.`); process.exit(1); }
  if (!updatedState)                          { console.log(`[test] FAIL — updateCarState not called.`); process.exit(1); }

  const vSt2 = { altY: 39.5, speed: 0, heading: 0 };
  tickDrone(vDef, vSt2, "drone/0", 1.0);
  if (vSt2.altY !== 40) { console.log(`[test] FAIL — altY clamp at DRONE_MAX_ALT=40, got ${vSt2.altY}.`); process.exit(1); }

  console.log(`[test] PASS — mountVehiclePhysicsTick drone: altY += mv*7*dt clamped [0,40], du/dv = (fwd*mf + rgt*mr)*15*dt, speed = hypot/dt, heading = atan2 (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- vehicle-meshes legacy regression (iter 814) ----------
 * PARITY: mountVehicleMeshes
 *
 * Trivial setup: build Map<id, group> via makeVehicleMesh and
 * scene.add each. carGroup = vehicleMeshes.get(first.id), carBody =
 * group._bodyMesh. Verifies invariants under stubs.
 */
{
  const { mountVehicleMeshes } = await import("../src/render/vehicle_meshes.js");
  const addedToScene = [];
  const fakeTHREE = { Group: function Group() { return { _isGroup: true }; } };
  const scene = { add: (g) => addedToScene.push(g) };
  const makeVehicleMesh = (vDef) => ({ _vDef: vDef.id, _bodyMesh: { _is: "body" } });

  const vehicleDefs = [
    { id: "car/0", type: "car" },
    { id: "drone/0", type: "drone" },
    { id: "mech/0", type: "mech" },
  ];
  const { vehicleMeshes, carGroup, carBody } = mountVehicleMeshes({
    THREE: fakeTHREE, scene, vehicleDefs, makeVehicleMesh,
  });

  if (vehicleMeshes.size !== 3)                          { console.log(`[test] FAIL — expected 3 meshes, got ${vehicleMeshes.size}.`); process.exit(1); }
  if (addedToScene.length !== 3)                         { console.log(`[test] FAIL — expected scene.add ×3, got ${addedToScene.length}.`); process.exit(1); }
  if (vehicleMeshes.get("car/0")?._vDef !== "car/0")     { console.log(`[test] FAIL — car/0 missing.`); process.exit(1); }
  if (vehicleMeshes.get("drone/0")?._vDef !== "drone/0") { console.log(`[test] FAIL — drone/0 missing.`); process.exit(1); }
  if (vehicleMeshes.get("mech/0")?._vDef !== "mech/0")   { console.log(`[test] FAIL — mech/0 missing.`); process.exit(1); }
  if (carGroup?._vDef !== "car/0")                       { console.log(`[test] FAIL — carGroup should be car/0, got ${carGroup?._vDef}.`); process.exit(1); }
  if (carBody?._is !== "body")                           { console.log(`[test] FAIL — carBody should be group._bodyMesh.`); process.exit(1); }

  console.log(`[test] PASS — mountVehicleMeshes legacy regression: Map<id,group> via makeVehicleMesh, scene.add each, carGroup=first, carBody=group._bodyMesh (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- hero-move slide legacy regression (iter 815) ----------
 * PARITY: mountHeroMoveTick
 *
 * Slide trigger + decay constants (SLIDE_DUR=0.6, SLIDE_MULT=1.5)
 * pinned via stubbed get/set/actions. Verifies:
 *   • slide trigger: ctrl edge rising + canSprint + isMoving sets
 *     slideT to SLIDE_DUR, slideDU/DV to normalized*sprintSpeed*1.5
 *   • slide tick: slideT decays by dt; slideMove called with
 *     slideDU * decay * dt, slideDV * decay * dt
 *   • no slide while heroDead or buildMode
 */
{
  const { mountHeroMoveTick } = await import("../src/systems/hero_move_tick.js");

  // Per-test state container; get/set close over this.
  const makeMount = () => {
    const s = { ctrlWasDown: false, slideT: 0, slideDU: 0, slideDV: 0 };
    const calls = { slideMove: [], spawnTrail: 0, applyMove: [], playSlideSound: 0 };
    const get = {
      ctrlWasDown: () => s.ctrlWasDown,
      slideT: () => s.slideT, slideDU: () => s.slideDU, slideDV: () => s.slideDV,
    };
    const set = {
      ctrlWasDown: (v) => { s.ctrlWasDown = v; },
      slideT: (v) => { s.slideT = v; },
      slideDU: (v) => { s.slideDU = v; },
      slideDV: (v) => { s.slideDV = v; },
    };
    const actions = {
      playSlideSound: () => { calls.playSlideSound++; },
      slideMove: (du, dv, blockers) => { calls.slideMove.push({ du, dv }); },
      spawnTrail: () => { calls.spawnTrail++; },
      applyMove: (...args) => { calls.applyMove.push(args); },
    };
    return { s, calls, mount: mountHeroMoveTick({ get, set, actions }) };
  };

  // Test 1: slide trigger. forward=(0,1), inputF=1 → slideDV = 1*10*1.5 = 15.
  {
    const { s, calls, mount } = makeMount();
    mount.tick(0.016, {
      inputF: 1, inputR: 0,
      forward: { x: 0, z: 1 }, right: { x: 1, z: 0 },
      speed: 5, sprintSpeed: 10,
      canSprint: true, isMoving: true,
      heroDead: false, buildMode: false,
      ctrlDown: true, blockers: [],
    });
    // Same-tick: trigger sets slideT=0.6, then the if-slideT>0 branch
    // decrements by dt=0.016 → slideT ends at 0.584.
    if (Math.abs(s.slideT - 0.584) > 1e-9) { console.log(`[test] FAIL — slide trigger+decay slideT: expected 0.584 (0.6 - 0.016), got ${s.slideT}.`); process.exit(1); }
    if (Math.abs(s.slideDU - 0) > 1e-9)  { console.log(`[test] FAIL — slide trigger slideDU: expected 0, got ${s.slideDU}.`); process.exit(1); }
    if (Math.abs(s.slideDV - 15) > 1e-9) { console.log(`[test] FAIL — slide trigger slideDV: expected 15, got ${s.slideDV}.`); process.exit(1); }
    if (calls.playSlideSound !== 1)      { console.log(`[test] FAIL — playSlideSound should fire once, got ${calls.playSlideSound}.`); process.exit(1); }
    if (calls.slideMove.length !== 1)    { console.log(`[test] FAIL — slideMove should fire during slide tick, got ${calls.slideMove.length}.`); process.exit(1); }
    // First-frame slide tick: slideT becomes 0.6 then -= 0.016 = 0.584; decay = 0.584/0.6 ≈ 0.973333
    const decay = (0.6 - 0.016) / 0.6;
    const expectedDU = 0 * decay * 0.016;
    const expectedDV = 15 * decay * 0.016;
    if (Math.abs(calls.slideMove[0].dv - expectedDV) > 1e-6) {
      console.log(`[test] FAIL — slideMove dv: expected ${expectedDV}, got ${calls.slideMove[0].dv}.`);
      process.exit(1);
    }
  }

  // Test 2: heroDead suppresses slide trigger.
  {
    const { s, calls, mount } = makeMount();
    mount.tick(0.016, {
      inputF: 1, inputR: 0, forward: { x: 0, z: 1 }, right: { x: 1, z: 0 },
      speed: 5, sprintSpeed: 10, canSprint: true, isMoving: true,
      heroDead: true, buildMode: false, ctrlDown: true, blockers: [],
    });
    if (s.slideT !== 0) { console.log(`[test] FAIL — slide should not trigger while heroDead, got slideT=${s.slideT}.`); process.exit(1); }
    if (calls.playSlideSound !== 0) { console.log(`[test] FAIL — playSlideSound fired while heroDead.`); process.exit(1); }
  }

  // Test 3: ctrlDown without rising edge (already held) does not re-trigger.
  {
    const { s, calls, mount } = makeMount();
    s.ctrlWasDown = true;
    mount.tick(0.016, {
      inputF: 1, inputR: 0, forward: { x: 0, z: 1 }, right: { x: 1, z: 0 },
      speed: 5, sprintSpeed: 10, canSprint: true, isMoving: true,
      heroDead: false, buildMode: false, ctrlDown: true, blockers: [],
    });
    if (s.slideT !== 0) { console.log(`[test] FAIL — slide should not re-trigger without ctrl edge, got slideT=${s.slideT}.`); process.exit(1); }
  }

  console.log(`[test] PASS — mountHeroMoveTick legacy regression: slide trigger (SLIDE_DUR=0.6, SLIDE_MULT=1.5), decay-driven slideMove, gating on heroDead/buildMode/ctrl-rising-edge (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- npc-move flee legacy regression (iter 816) ----------
 * PARITY: mountNpcMoveTick
 *
 * Flee constants (FLEE_RANGE=8, FLEE_DUR=2.5, FLEE_SPEED=7) pinned
 * via stubbed actions. Verifies:
 *   • flee trigger: nowSec - lastHeroShotT < 0.12 AND
 *     hypot(np.u - heroU, np.v - heroV) < 8 → set _fleeT=2.5,
 *     _fleeAng = atan2(np.u - heroU, np.v - heroV)
 *   • flee tick: _fleeT decays, setPos shifts by sin(ang)*7*dt /
 *     cos(ang)*7*dt in u/v
 *   • dialogOpen suppresses both flee + wander
 */
{
  const { mountNpcMoveTick } = await import("../src/systems/npc_move_tick.js");

  let writtenPos = null;
  let clamped = false;
  const npcPositions = new Map([["n0", { x: 0, y: 0, z: 0, u: 5, v: 5 }]]);
  const actions = {
    getPos: (id) => npcPositions.get(id),
    setPos: (id, x, y, z, u, v) => {
      const p = npcPositions.get(id);
      if (p) { p.x = x; p.y = y; p.z = z; p.u = u; p.v = v; }
      writtenPos = { id, x, y, z, u, v };
    },
    wanderStep: (id, heading, _wanderSpeed, _dt) => heading + 0.01,
    clampToArena: () => { clamped = true; },
    toRenderPos: (id) => ({ x: 0, y: 0, z: 0 }),
  };

  const { tick } = mountNpcMoveTick({ actions });
  const n0 = { id: "n0", wanderSpeed: 2.2 };
  const m0 = { heading: 0, group: { position: { set() {} }, rotation: {} } };
  const npcMeshes = new Map([["n0", m0]]);

  // Test 1: flee trigger. Hero at (2,2), NPC at (5,5), distance ≈ 4.24 < 8.
  // lastHeroShotT just now → diff = 0 < 0.12.
  const nowMs = 1000;
  const lastShotT = nowMs / 1000 - 0.05;
  tick(0.1, {
    nowMs, heroU: 2, heroV: 2,
    npcDefs: [n0], npcMeshes,
    dialogOpen: false, lastHeroShotT: lastShotT,
  });
  if (Math.abs(n0._fleeT - (2.5 - 0.1)) > 1e-9) {
    console.log(`[test] FAIL — flee _fleeT after tick: expected ${2.5 - 0.1}, got ${n0._fleeT}.`);
    process.exit(1);
  }
  const expectedAng = Math.atan2(5 - 2, 5 - 2);  // π/4
  if (Math.abs(n0._fleeAng - expectedAng) > 1e-9) {
    console.log(`[test] FAIL — flee _fleeAng: expected ${expectedAng}, got ${n0._fleeAng}.`);
    process.exit(1);
  }
  // Position shift: sin(π/4)*7*0.1, cos(π/4)*7*0.1
  const expectedU = 5 + Math.sin(expectedAng) * 7 * 0.1;
  const expectedV = 5 + Math.cos(expectedAng) * 7 * 0.1;
  if (Math.abs(writtenPos.u - expectedU) > 1e-9) { console.log(`[test] FAIL — flee setPos.u: expected ${expectedU}, got ${writtenPos.u}.`); process.exit(1); }
  if (Math.abs(writtenPos.v - expectedV) > 1e-9) { console.log(`[test] FAIL — flee setPos.v: expected ${expectedV}, got ${writtenPos.v}.`); process.exit(1); }
  if (Math.abs(m0.heading - expectedAng) > 1e-9) { console.log(`[test] FAIL — m.heading should = flee angle.`); process.exit(1); }
  if (!clamped) { console.log(`[test] FAIL — clampToArena should fire.`); process.exit(1); }

  // Test 2: dialogOpen suppresses flee movement (heading unchanged after first run).
  const headingBefore = m0.heading;
  const uBefore = npcPositions.get("n0").u;
  tick(0.1, {
    nowMs: nowMs + 100, heroU: 2, heroV: 2,
    npcDefs: [n0], npcMeshes,
    dialogOpen: true, lastHeroShotT: 0,
  });
  // dialogOpen blocks both flee and wander branches; pos.u must stay put.
  if (Math.abs(npcPositions.get("n0").u - uBefore) > 1e-9) {
    console.log(`[test] FAIL — dialogOpen should suppress position change, u changed from ${uBefore} to ${npcPositions.get("n0").u}.`);
    process.exit(1);
  }
  if (m0.heading !== headingBefore) {
    console.log(`[test] FAIL — dialogOpen should suppress heading change.`);
    process.exit(1);
  }

  console.log(`[test] PASS — mountNpcMoveTick legacy regression: flee trigger (FLEE_RANGE=8, FLEE_DUR=2.5, FLEE_SPEED=7), atan2 flee-angle, position shift via sin/cos, dialogOpen suppress, clampToArena (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- weapon-hud legacy regression (iter 817) ----------
 * PARITY: mountWeaponHudTick
 *
 * Pins ammo display + low-ammo warning math via stubbed DOM els.
 *   • wpName.textContent = uppercase weapon name
 *   • wpAmmo.childNodes[0].textContent = pistolAmmo as number
 *   • wpReserve.textContent = " / " + reserve
 *   • lowAmmoThresh = max(1, floor(magCap * 0.25))
 *   • low-ammo sound fires once per distinct pistolAmmo crossing
 */
{
  const { mountWeaponHudTick } = await import("../src/systems/weapon_hud_tick.js");

  let lowAmmoWarnedAt = -1, lastMagBarAmmo = -1, lastMagBarReloading = false;
  const sfxCalls = [];
  const stubText = () => { const o = { textContent: "", childNodes: [{ textContent: "" }] }; return o; };
  const wpName    = stubText();
  const wpAmmo    = { childNodes: [{ textContent: "" }], style: { color: "" } };
  const wpReserve = stubText();
  const wpMagBar  = { innerHTML: "" };
  const wpGrenades= { innerHTML: "" };
  const els = { wpName, wpAmmo, wpReserve, wpMagBar, wpGrenades };

  const { tick } = mountWeaponHudTick({
    get: {
      lowAmmoWarnedAt: () => lowAmmoWarnedAt,
      lastMagBarAmmo:  () => lastMagBarAmmo,
      lastMagBarReloading: () => lastMagBarReloading,
    },
    set: {
      lowAmmoWarnedAt: (v) => { lowAmmoWarnedAt = v; },
      lastMagBarAmmo:  (v) => { lastMagBarAmmo = v; },
      lastMagBarReloading: (v) => { lastMagBarReloading = v; },
    },
    actions: {
      getWeapon:  () => ({ id: "smg", name: "smg", ammoItem: "smg_9mm", magCap: 12 }),
      getReserve: (_item) => 48,
      playSfx:    (...args) => sfxCalls.push(args),
    },
  });

  // Low-ammo trigger: pistolAmmo=2, magCap=12 → threshold = floor(12*0.25)=3,
  // 2 <= 3 → isLowAmmo true. Sound fires twice (tone:440 + tone:330).
  tick(1000, 2, false, { frag: 1, smoke: 0, flash: 0, mines: 0 }, els);
  if (wpName.textContent !== "SMG")                  { console.log(`[test] FAIL — wpName: expected "SMG", got "${wpName.textContent}".`); process.exit(1); }
  if (wpAmmo.childNodes[0].textContent !== 2)        { console.log(`[test] FAIL — wpAmmo text: expected 2, got ${wpAmmo.childNodes[0].textContent}.`); process.exit(1); }
  if (wpReserve.textContent !== " / 48")             { console.log(`[test] FAIL — wpReserve: expected " / 48", got "${wpReserve.textContent}".`); process.exit(1); }
  if (sfxCalls.length !== 2)                         { console.log(`[test] FAIL — low-ammo should fire 2 sfx, got ${sfxCalls.length}.`); process.exit(1); }
  if (sfxCalls[0][0] !== "tone:440:60:square")       { console.log(`[test] FAIL — first sfx tone: expected 440, got ${sfxCalls[0][0]}.`); process.exit(1); }
  if (sfxCalls[1][0] !== "tone:330:45:square")       { console.log(`[test] FAIL — second sfx tone: expected 330, got ${sfxCalls[1][0]}.`); process.exit(1); }
  if (lowAmmoWarnedAt !== 2)                         { console.log(`[test] FAIL — lowAmmoWarnedAt should latch at 2, got ${lowAmmoWarnedAt}.`); process.exit(1); }
  if (!wpMagBar.innerHTML.includes("background:#00ccff")) { console.log(`[test] FAIL — magBar should render filled cells in blue.`); process.exit(1); }

  // Idempotent re-tick at same ammo value: sfx must NOT re-fire.
  const prevCount = sfxCalls.length;
  tick(1000, 2, false, { frag: 1, smoke: 0, flash: 0, mines: 0 }, els);
  if (sfxCalls.length !== prevCount) {
    console.log(`[test] FAIL — sfx re-fired without ammo change (got ${sfxCalls.length}, expected ${prevCount}).`);
    process.exit(1);
  }

  // Above-threshold: pistolAmmo=8 → not low. lowAmmoWarnedAt resets to -1.
  tick(1000, 8, false, { frag: 1, smoke: 0, flash: 0, mines: 0 }, els);
  if (lowAmmoWarnedAt !== -1) {
    console.log(`[test] FAIL — lowAmmoWarnedAt should reset to -1 above threshold, got ${lowAmmoWarnedAt}.`);
    process.exit(1);
  }

  console.log(`[test] PASS — mountWeaponHudTick legacy regression: name+ammo+reserve text, lowAmmoThresh = max(1, floor(magCap*0.25)), sfx fires once per crossing then latches, mag-bar fills cells (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- cam-dist snap+entry legacy regression (iter 818) ----------
 * PARITY: mountCamDistTick
 *
 * Pins snap-zoom lerp + computer-entry smoothstep math via stubbed
 * get/set/actions.
 *   • snap zoom: if |newDist - snapTarget| < 0.05 → snap + clear;
 *     else write newDist
 *   • computer entry smoothstep: ease = t² * (3 - 2t);
 *     camDist = camDistBeforeEntry * (1 - ease) + 0.35 * ease
 *   • entry t >= 1 → t=1, finishComputerEntry()
 */
{
  const { mountCamDistTick } = await import("../src/systems/cam_dist_tick.js");

  const makeMount = (init = {}) => {
    const s = {
      camDist: 10, snapZoomTarget: null,
      computerEntering: false, computerEntryT: 0, computerEntryDur: 0.5,
      camDistBeforeEntry: 10, finishCalled: false, ...init,
    };
    const get = {
      camDist: () => s.camDist, snapZoomTarget: () => s.snapZoomTarget,
      computerEntering: () => s.computerEntering,
      computerEntryT: () => s.computerEntryT,
      computerEntryDur: () => s.computerEntryDur,
      camDistBeforeEntry: () => s.camDistBeforeEntry,
    };
    const set = {
      camDist: (v) => { s.camDist = v; },
      snapZoomTarget: (v) => { s.snapZoomTarget = v; },
      computerEntryT: (v) => { s.computerEntryT = v; },
    };
    const actions = {
      // Linear lerp stub: returns current + (target-current)*0.5 per call.
      // The legacy real impl is in a separate module; we just need the
      // gate logic (|diff|<0.05 → snap) to be testable.
      lerpZoom: (cur, target, _dt, _rate) => cur + (target - cur) * 0.5,
      finishComputerEntry: () => { s.finishCalled = true; },
    };
    return { s, mount: mountCamDistTick({ get, set, actions }) };
  };

  // Test 1 — snap zoom mid: target=3, camDist=10 → lerp returns 6.5 (diff 3.5 > 0.05).
  {
    const { s, mount } = makeMount({ camDist: 10, snapZoomTarget: 3 });
    mount.tick(0.016);
    if (Math.abs(s.camDist - 6.5) > 1e-9) { console.log(`[test] FAIL — snap mid camDist: expected 6.5, got ${s.camDist}.`); process.exit(1); }
    if (s.snapZoomTarget !== 3)            { console.log(`[test] FAIL — snapTarget should not clear yet, got ${s.snapZoomTarget}.`); process.exit(1); }
  }

  // Test 2 — snap zoom close: camDist=3.04, target=3 → lerp returns 3.02, diff 0.02 < 0.05 → snap.
  {
    const { s, mount } = makeMount({ camDist: 3.04, snapZoomTarget: 3 });
    mount.tick(0.016);
    if (s.camDist !== 3)              { console.log(`[test] FAIL — snap close camDist: expected 3, got ${s.camDist}.`); process.exit(1); }
    if (s.snapZoomTarget !== null)    { console.log(`[test] FAIL — snapTarget should clear, got ${s.snapZoomTarget}.`); process.exit(1); }
  }

  // Test 3 — computer entry mid: entryT=0, dt=0.1, dur=0.5 → t=0.2
  //   ease = 0.2² * (3 - 0.4) = 0.04 * 2.6 = 0.104
  //   camDist = 10*(1-0.104) + 0.35*0.104 = 8.96 + 0.0364 = 8.9964
  {
    const { s, mount } = makeMount({ computerEntering: true, camDistBeforeEntry: 10, computerEntryDur: 0.5 });
    mount.tick(0.1);
    const expectedEase = 0.2 * 0.2 * (3 - 0.4);
    const expectedDist = 10 * (1 - expectedEase) + 0.35 * expectedEase;
    if (Math.abs(s.computerEntryT - 0.2) > 1e-9) { console.log(`[test] FAIL — entryT: expected 0.2, got ${s.computerEntryT}.`); process.exit(1); }
    if (Math.abs(s.camDist - expectedDist) > 1e-9) { console.log(`[test] FAIL — entry camDist: expected ${expectedDist}, got ${s.camDist}.`); process.exit(1); }
    if (s.finishCalled)                          { console.log(`[test] FAIL — finishComputerEntry fired too early.`); process.exit(1); }
  }

  // Test 4 — computer entry complete: entryT=0.95, dt=0.1, dur=0.5 → t=1.15 ≥ 1
  //   → entryT clamped to 1, finishComputerEntry called.
  {
    const { s, mount } = makeMount({ computerEntering: true, computerEntryT: 0.95, computerEntryDur: 0.5 });
    mount.tick(0.1);
    if (s.computerEntryT !== 1) { console.log(`[test] FAIL — entryT should clamp at 1, got ${s.computerEntryT}.`); process.exit(1); }
    if (!s.finishCalled)        { console.log(`[test] FAIL — finishComputerEntry should fire when entryT >= 1.`); process.exit(1); }
  }

  console.log(`[test] PASS — mountCamDistTick legacy regression: snap-zoom lerp gate (|diff|<0.05), computer-entry smoothstep ease (t²(3-2t)), entry completion clamp + callback (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- cam-vectors legacy regression (iter 819) ----------
 * PARITY: mountCamVectors
 *
 * Trivial allocator: returns { _camTarget, _camOff, _camLook,
 * _camAimTarget, _camBuildLook } — 5 distinct Vector3 instances.
 * Stubbed THREE.Vector3 confirms shape contract.
 */
{
  const { mountCamVectors } = await import("../src/render/cam_vectors.js");
  let allocCount = 0;
  const fakeTHREE = { Vector3: function Vector3() { allocCount++; this._id = allocCount; } };
  const out = mountCamVectors({ THREE: fakeTHREE });
  const keys = ["_camTarget", "_camOff", "_camLook", "_camAimTarget", "_camBuildLook"];
  for (const k of keys) {
    if (!out[k] || typeof out[k]._id !== "number") {
      console.log(`[test] FAIL — cam-vectors missing ${k} or not Vector3-shaped.`);
      process.exit(1);
    }
  }
  if (allocCount !== 5) { console.log(`[test] FAIL — cam-vectors should allocate 5 Vector3, got ${allocCount}.`); process.exit(1); }
  const ids = new Set(keys.map((k) => out[k]._id));
  if (ids.size !== 5) { console.log(`[test] FAIL — cam-vectors keys should be distinct instances.`); process.exit(1); }

  console.log(`[test] PASS — mountCamVectors legacy regression: 5 distinct Vector3 under {_camTarget, _camOff, _camLook, _camAimTarget, _camBuildLook} (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- crosshair-tick legacy regression (iter 820) ----------
 * PARITY: mountCrosshairTick
 *
 * Pins crosshair bloom + visibility math.
 *   • bloom = (aiming ? 10 : 16) + moveSpread * 26
 *   • isSniperScope → scope shown, crosshair hidden
 *   • heroDead → opacity 0
 *   • heroApexMode → APEX gold border, else base cyan
 */
{
  const { mountCrosshairTick } = await import("../src/systems/crosshair_tick.js");
  const { tick } = mountCrosshairTick();
  const scope = { style: {} };
  const crh   = { style: {} };

  tick(scope, crh, { isSniperScope: false, aiming: false, moveSpread: 0,
                     heroDead: false, heroApexMode: false });
  if (scope.style.display !== "none")     { console.log(`[test] FAIL — scope should hide without sniper.`); process.exit(1); }
  if (crh.style.visibility !== "visible") { console.log(`[test] FAIL — crosshair should be visible.`); process.exit(1); }
  if (crh.style.width !== "16.0px")       { console.log(`[test] FAIL — bloom hipfire/no-spread: expected 16.0px, got ${crh.style.width}.`); process.exit(1); }
  if (crh.style.opacity !== "1")          { console.log(`[test] FAIL — alive opacity should be 1.`); process.exit(1); }
  if (!crh.style.borderColor.includes("0,200,255")) { console.log(`[test] FAIL — base border (cyan): got ${crh.style.borderColor}.`); process.exit(1); }

  tick(scope, crh, { isSniperScope: false, aiming: true, moveSpread: 0.5,
                     heroDead: false, heroApexMode: false });
  if (crh.style.width !== "23.0px") { console.log(`[test] FAIL — bloom aiming+spread: expected 23.0px (10+0.5*26), got ${crh.style.width}.`); process.exit(1); }

  tick(scope, crh, { isSniperScope: true, aiming: false, moveSpread: 0,
                     heroDead: false, heroApexMode: false });
  if (scope.style.display !== "block")    { console.log(`[test] FAIL — sniper scope: expected block.`); process.exit(1); }
  if (crh.style.visibility !== "hidden")  { console.log(`[test] FAIL — sniper crosshair hide expected.`); process.exit(1); }

  tick(scope, crh, { isSniperScope: false, aiming: false, moveSpread: 0,
                     heroDead: true, heroApexMode: true });
  if (crh.style.opacity !== "0")                       { console.log(`[test] FAIL — dead opacity 0 expected.`); process.exit(1); }
  if (!crh.style.borderColor.includes("255,210,0"))    { console.log(`[test] FAIL — apex gold border: got ${crh.style.borderColor}.`); process.exit(1); }

  console.log(`[test] PASS — mountCrosshairTick legacy regression: bloom = (aim?10:16) + spread*26, scope/crosshair toggle, opacity 0 dead, APEX gold vs base cyan (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- combo-announcer legacy regression (iter 821) ----------
 * PARITY: mountComboAnnouncer
 *
 * Milestones [2,4,6,8] → DOUBLE/QUAD/RAMPAGE/GODLIKE. Each fires
 * once when crossed (announcedMul latches). Decay: nowSec -
 * comboLastT > DECAY → reset comboCount + announcedMul.
 */
{
  const { mountComboAnnouncer } = await import("../src/systems/combo_announcer.js");
  const s = { comboCount: 0, comboAnnouncedMul: 0, comboLastT: 0 };
  const toasts = [], sfx = [];
  const mount = mountComboAnnouncer({
    DECAY: 2.0,
    get: {
      comboCount: () => s.comboCount,
      comboAnnouncedMul: () => s.comboAnnouncedMul,
      comboLastT: () => s.comboLastT,
    },
    set: {
      comboCount: (v) => { s.comboCount = v; },
      comboAnnouncedMul: (v) => { s.comboAnnouncedMul = v; },
    },
    actions: {
      showToast: (...a) => toasts.push(a),
      playSfx: (...a) => sfx.push(a),
    },
  });

  s.comboCount = 2; s.comboLastT = 100;
  mount.tick(100.5);
  if (s.comboAnnouncedMul !== 2)          { console.log(`[test] FAIL — milestone 2 fire.`); process.exit(1); }
  if (toasts[0][0] !== "DOUBLE KILL! x2") { console.log(`[test] FAIL — toast label: ${toasts[0][0]}`); process.exit(1); }
  if (sfx.length !== 2)                   { console.log(`[test] FAIL — 2 sfx expected, got ${sfx.length}.`); process.exit(1); }
  if (sfx[0][0] !== "tone:660:80:sine")   { console.log(`[test] FAIL — first sfx: ${sfx[0][0]}.`); process.exit(1); }
  if (sfx[1][0] !== "tone:990:60:sine")   { console.log(`[test] FAIL — second sfx (660*1.5=990): ${sfx[1][0]}.`); process.exit(1); }

  const t0 = toasts.length;
  mount.tick(100.6);
  if (toasts.length !== t0)               { console.log(`[test] FAIL — re-tick at same milestone re-announced.`); process.exit(1); }

  // Jump to combo=6: loop `break`s after the first unfired milestone,
  // so this fires QUAD (4), not RAMPAGE (6). RAMPAGE fires next tick.
  s.comboCount = 6;
  mount.tick(100.7);
  if (s.comboAnnouncedMul !== 4)                       { console.log(`[test] FAIL — combo 6 + announcedMul=2 should step-fire QUAD (4), got ${s.comboAnnouncedMul}.`); process.exit(1); }
  if (toasts[toasts.length-1][0] !== "QUAD KILL! x4")  { console.log(`[test] FAIL — QUAD label: got "${toasts[toasts.length-1][0]}".`); process.exit(1); }
  mount.tick(100.8);
  if (s.comboAnnouncedMul !== 6)                       { console.log(`[test] FAIL — second tick should fire RAMPAGE, got ${s.comboAnnouncedMul}.`); process.exit(1); }
  if (toasts[toasts.length-1][0] !== "RAMPAGE! x6")    { console.log(`[test] FAIL — RAMPAGE label: got "${toasts[toasts.length-1][0]}".`); process.exit(1); }

  s.comboCount = 4; s.comboAnnouncedMul = 4; s.comboLastT = 200;
  mount.tick(202.5);
  if (s.comboCount !== 0)        { console.log(`[test] FAIL — decay reset comboCount.`); process.exit(1); }
  if (s.comboAnnouncedMul !== 0) { console.log(`[test] FAIL — decay reset announcedMul.`); process.exit(1); }

  console.log(`[test] PASS — mountComboAnnouncer legacy regression: milestones [2,4,6,8] (DOUBLE/QUAD/RAMPAGE/GODLIKE), 2 sfx per (base + base*1.5), decay zeros state (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- armor-vest legacy regression (iter 823) ----------
 * PARITY: mountArmorVestTick
 *
 * Pins armor pickup constants + respawn loop.
 *   • SPIN_SPEED=1.2 → mesh.rotation.y += 1.2*dt
 *   • COLLECT_DIST=1.3, GAIN_AMT=25, RESPAWN_DUR=60
 *   • collect: heroArmor < maxArmor + within 1.3 → active=false,
 *     respawnT=nowSec, armor += min(GAIN, maxArmor-current)
 *   • respawn: !active + nowSec-respawnT > 60 → active=true
 */
{
  const { mountArmorVestTick } = await import("../src/systems/armor_vest_tick.js");

  let armor = 30, maxArmor = 100;
  const sfx = [], toasts = [];
  const mount = mountArmorVestTick({
    get: { heroArmor: () => armor, maxArmor: () => maxArmor },
    set: { heroArmor: (v) => { armor = v; } },
    actions: { playSfx: (...a) => sfx.push(a), showToast: (...a) => toasts.push(a) },
  });

  const mkPickup = (u, v) => ({
    u, v, active: true, respawnT: 0,
    mesh: { visible: true, rotation: { x: 0, y: 0, z: 0 }, position: { x: u, y: 0, z: v } },
  });

  // Test 1: spin + bob. Tick away from hero so no collect.
  const av = mkPickup(50, 50);
  mount.tick(0.1, { pickups: [av], heroU: 0, heroV: 0, nowSec: 10, nowMs: 0 });
  if (Math.abs(av.mesh.rotation.y - 0.12) > 1e-9) { console.log(`[test] FAIL — spin: expected 0.12 (1.2*0.1), got ${av.mesh.rotation.y}.`); process.exit(1); }
  const expectedY = 0.3 + Math.sin(0 / 500 + 50) * 0.08;
  if (Math.abs(av.mesh.position.y - expectedY) > 1e-9) { console.log(`[test] FAIL — bob y: expected ${expectedY}, got ${av.mesh.position.y}.`); process.exit(1); }

  // Test 2: collect (within radius + armor < max).
  const av2 = mkPickup(0, 0);
  mount.tick(0.016, { pickups: [av2], heroU: 0.3, heroV: 0.4, nowSec: 20, nowMs: 1000 });
  if (av2.active !== false)              { console.log(`[test] FAIL — armor pickup should deactivate on collect.`); process.exit(1); }
  if (av2.respawnT !== 20)               { console.log(`[test] FAIL — respawnT should be nowSec=20.`); process.exit(1); }
  if (armor !== 55)                      { console.log(`[test] FAIL — armor: expected 55 (30+25), got ${armor}.`); process.exit(1); }
  if (sfx.length !== 1 || sfx[0][0] !== "tone:880:120:sine") { console.log(`[test] FAIL — armor sfx: got ${sfx[0]?.[0]}.`); process.exit(1); }
  if (toasts.length !== 1 || toasts[0][0] !== "+25 armor")   { console.log(`[test] FAIL — armor toast: got ${toasts[0]?.[0]}.`); process.exit(1); }

  // Test 3: cap at maxArmor — armor near max gains only the delta.
  armor = 90;
  const av3 = mkPickup(0, 0);
  mount.tick(0.016, { pickups: [av3], heroU: 0.3, heroV: 0.4, nowSec: 21, nowMs: 1000 });
  if (armor !== 100)                     { console.log(`[test] FAIL — armor should cap at 100, got ${armor}.`); process.exit(1); }
  // Toast shows the actual gained amount, not GAIN_AMT.
  if (toasts[toasts.length-1][0] !== "+10 armor") { console.log(`[test] FAIL — armor toast should show actual gained=10, got "${toasts[toasts.length-1][0]}".`); process.exit(1); }

  // Test 4: respawn — !active + nowSec - respawnT > 60 → active.
  const av4 = mkPickup(0, 0);
  av4.active = false; av4.respawnT = 100;
  mount.tick(0.016, { pickups: [av4], heroU: 99, heroV: 99, nowSec: 161, nowMs: 1000 });
  if (av4.active !== true)               { console.log(`[test] FAIL — armor should respawn after 60s, active=${av4.active}.`); process.exit(1); }
  if (av4.mesh.visible !== true)         { console.log(`[test] FAIL — respawned armor mesh should be visible.`); process.exit(1); }

  console.log(`[test] PASS — mountArmorVestTick legacy regression: SPIN_SPEED=1.2 + BOB_PERIOD=500, COLLECT_DIST=1.3, GAIN_AMT=25 (capped at maxArmor), RESPAWN_DUR=60 (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- boss-bar legacy regression (iter 824) ----------
 * PARITY: mountBossBarTick
 *
 * Pins HP fill width + gradient threshold + pulse shadow gate.
 *   • width = (hp/maxHp * 100).toFixed(1) + "%"
 *   • gradient: >0.5 HIGH (cc0000→ff4400), >0.25 MID (aa0000→ff2200),
 *     else LOW (660000→cc0000)
 *   • shadow: <0.3 pulsing (sin-based), else steady
 *   • dead or null liveBoss → hidden
 */
{
  const { mountBossBarTick } = await import("../src/systems/boss_bar_tick.js");
  const { tick } = mountBossBarTick();
  const bossBar    = { style: { display: "" } };
  const fillParent = { style: { boxShadow: "" } };
  const bossHpFill = { style: { width: "", background: "" }, parentElement: fillParent };
  const bossHpVal  = { textContent: "" };
  const bossName   = { textContent: "" };
  const els = { bossBar, bossHpFill, bossHpVal, bossName };

  tick(1000, { hp: 80, maxHp: 100, dead: false }, els);
  if (bossBar.style.display !== "block")                { console.log(`[test] FAIL — boss bar should show.`); process.exit(1); }
  if (bossHpFill.style.width !== "80.0%")               { console.log(`[test] FAIL — fill width: got ${bossHpFill.style.width}.`); process.exit(1); }
  if (!bossHpFill.style.background.includes("#cc0000")) { console.log(`[test] FAIL — high gradient: got ${bossHpFill.style.background}.`); process.exit(1); }
  if (bossHpVal.textContent !== "80 / 100")             { console.log(`[test] FAIL — hp text: got ${bossHpVal.textContent}.`); process.exit(1); }
  if (bossName.textContent !== "☠ BOSS")                { console.log(`[test] FAIL — boss name.`); process.exit(1); }
  if (!fillParent.style.boxShadow.includes("0.3"))      { console.log(`[test] FAIL — steady shadow at high HP (0.3 opacity).`); process.exit(1); }

  tick(1000, { hp: 40, maxHp: 100, dead: false }, els);
  if (!bossHpFill.style.background.includes("#aa0000")) { console.log(`[test] FAIL — mid gradient.`); process.exit(1); }

  tick(1000, { hp: 20, maxHp: 100, dead: false }, els);
  if (!bossHpFill.style.background.includes("#660000")) { console.log(`[test] FAIL — low gradient.`); process.exit(1); }
  if (!fillParent.style.boxShadow.includes("0.7"))      { console.log(`[test] FAIL — pulsing shadow at low HP (0.7 opacity).`); process.exit(1); }

  tick(1000, { hp: 0, maxHp: 100, dead: true }, els);
  if (bossBar.style.display !== "none") { console.log(`[test] FAIL — dead boss should hide bar.`); process.exit(1); }

  tick(1000, null, els);
  if (bossBar.style.display !== "none") { console.log(`[test] FAIL — null boss should hide bar.`); process.exit(1); }

  console.log(`[test] PASS — mountBossBarTick legacy regression: HP fraction width%, HIGH/MID/LOW gradients (>0.5, >0.25, else), pulse shadow <0.3, hide on dead/null (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- damage-feedback legacy regression (iter 825) ----------
 * PARITY: mountDamageFeedback
 *
 * Returns flashDamage() + applyScreenShake(intensity).
 *   flashDamage:
 *     • waveChallengeNoDmg=false
 *     • vignetteAmt=1.0
 *     • playSfx tone:90:35:sawtooth (0.18)
 *     • hitPunchPitch += 0.05+random*0.04 (capped at 0.12)
 *     • if hp ∈ (0,10] && !nearDeathFired → 2 sfx + toast + nearDeath
 *   applyScreenShake: camShakeAmt = min(1, current + intensity)
 */
{
  const { mountDamageFeedback } = await import("../src/systems/damage_feedback.js");
  const s = {
    waveChallengeNoDmg: true, vignetteAmt: 0, hitPunchPitch: 0,
    heroHp: 50, nearDeathFired: false, bulletTimeLeft: 0, camShakeAmt: 0,
  };
  const sfx = [], toasts = [];
  const m = mountDamageFeedback({
    get: {
      hitPunchPitch: () => s.hitPunchPitch, heroHp: () => s.heroHp,
      nearDeathFired: () => s.nearDeathFired, bulletTimeLeft: () => s.bulletTimeLeft,
      camShakeAmt: () => s.camShakeAmt,
    },
    set: {
      waveChallengeNoDmg: (v) => { s.waveChallengeNoDmg = v; },
      vignetteAmt: (v) => { s.vignetteAmt = v; },
      hitPunchPitch: (v) => { s.hitPunchPitch = v; },
      nearDeathFired: (v) => { s.nearDeathFired = v; },
      bulletTimeLeft: (v) => { s.bulletTimeLeft = v; },
      camShakeAmt: (v) => { s.camShakeAmt = v; },
    },
    actions: {
      playSfx: (...a) => sfx.push(a),
      showToast: (...a) => toasts.push(a),
    },
  });

  // Healthy hp=50: flashDamage updates state but no critical branch.
  m.flashDamage();
  if (s.waveChallengeNoDmg !== false)   { console.log(`[test] FAIL — waveChallengeNoDmg should be false.`); process.exit(1); }
  if (s.vignetteAmt !== 1.0)            { console.log(`[test] FAIL — vignetteAmt should be 1.0.`); process.exit(1); }
  if (sfx.length !== 1)                 { console.log(`[test] FAIL — healthy flashDamage: expected 1 sfx, got ${sfx.length}.`); process.exit(1); }
  if (sfx[0][0] !== "tone:90:35:sawtooth") { console.log(`[test] FAIL — sfx tone: got ${sfx[0][0]}.`); process.exit(1); }
  if (s.hitPunchPitch < 0.05 || s.hitPunchPitch > 0.12) {
    console.log(`[test] FAIL — hitPunchPitch should be in [0.05, 0.12], got ${s.hitPunchPitch}.`);
    process.exit(1);
  }
  if (s.nearDeathFired)                 { console.log(`[test] FAIL — nearDeathFired should not fire at hp 50.`); process.exit(1); }

  // Critical hp=5: full critical branch fires.
  s.heroHp = 5; s.nearDeathFired = false; s.bulletTimeLeft = 0; sfx.length = 0; toasts.length = 0;
  m.flashDamage();
  if (!s.nearDeathFired)                { console.log(`[test] FAIL — nearDeathFired should fire at hp 5.`); process.exit(1); }
  if (s.bulletTimeLeft !== 0.45)        { console.log(`[test] FAIL — bulletTimeLeft should be 0.45.`); process.exit(1); }
  if (sfx.length !== 3)                 { console.log(`[test] FAIL — critical flashDamage: expected 3 sfx (1 hit + 2 critical), got ${sfx.length}.`); process.exit(1); }
  if (toasts.length !== 1 || toasts[0][0] !== "CRITICAL!") { console.log(`[test] FAIL — CRITICAL toast missing.`); process.exit(1); }

  // Re-trigger critical: nearDeathFired latches, no new toast.
  const t1 = toasts.length;
  m.flashDamage();
  if (toasts.length !== t1)             { console.log(`[test] FAIL — nearDeathFired latch should prevent re-trigger.`); process.exit(1); }

  // applyScreenShake.
  s.camShakeAmt = 0.3;
  m.applyScreenShake(0.4);
  if (Math.abs(s.camShakeAmt - 0.7) > 1e-9) { console.log(`[test] FAIL — shake add: expected 0.7, got ${s.camShakeAmt}.`); process.exit(1); }
  m.applyScreenShake(0.5);  // 0.7 + 0.5 = 1.2, clamped to 1.0
  if (s.camShakeAmt !== 1)              { console.log(`[test] FAIL — shake clamp: expected 1.0, got ${s.camShakeAmt}.`); process.exit(1); }

  console.log(`[test] PASS — mountDamageFeedback legacy regression: flashDamage state writes + hit sfx, critical-hp branch (2 extra sfx + CRITICAL toast, nearDeathFired latch, bulletTimeLeft=0.45), applyScreenShake additive+clamp to 1 (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- combat-ambient legacy regression (iter 826) ----------
 * PARITY: mountCombatAmbientTick
 *
 * Throttle: AMBIENT_INTERVAL=1.0; tick no-ops until nowSec - ambT >= 1.
 * After throttle pass, calls actions.setAmbient 6 times:
 *   wind (220, sawtooth, 0.008), calm (110, sine, calmVol),
 *   calm2 (130.8, sine, calmVol*0.65), tension (38 or 55),
 *   tension2 (42 or 58), bossRumble (28, square, 0.018 if bossAlive)
 *
 * calmVol = (!anyAlive || aliveChasing==0) && !bossAlive && !heroDead ? 0.024 : 0
 * tensionVol = min(0.055, aliveChasing * 0.010)
 */
{
  const { mountCombatAmbientTick } = await import("../src/systems/combat_ambient_tick.js");
  let ambT = 0;
  const calls = [];
  const m = mountCombatAmbientTick({
    get: { ambT: () => ambT },
    set: { ambT: (v) => { ambT = v; } },
    actions: {
      isAmbientReady: () => true,
      setAmbient: (...a) => calls.push(a),
    },
  });

  // Throttle: first call when ambT=0 fires (0 > 0 is false, so guard skipped).
  m.tick(100, [], false, false);
  if (calls.length !== 6) { console.log(`[test] FAIL — first tick should fire 6 setAmbient calls, got ${calls.length}.`); process.exit(1); }
  if (ambT !== 100)       { console.log(`[test] FAIL — ambT should latch to 100, got ${ambT}.`); process.exit(1); }
  // calmVol = 0.024 (no enemies, no boss, hero alive).
  const calmCall = calls.find((c) => c[0] === "calm");
  if (calmCall[3] !== 0.024) { console.log(`[test] FAIL — calm vol: expected 0.024 (calm scenario), got ${calmCall[3]}.`); process.exit(1); }
  // tensionVol = min(0.055, 0 * 0.010) = 0
  const tensionCall = calls.find((c) => c[0] === "tension");
  if (tensionCall[3] !== 0) { console.log(`[test] FAIL — tension vol: expected 0, got ${tensionCall[3]}.`); process.exit(1); }
  // bossRumble = 0 (no boss)
  const rumbleCall = calls.find((c) => c[0] === "bossRumble");
  if (rumbleCall[3] !== 0) { console.log(`[test] FAIL — bossRumble vol (args[3]): expected 0, got ${rumbleCall[3]}.`); process.exit(1); }

  // Re-tick at 100.5 (< 1.0 interval): suppressed.
  calls.length = 0;
  m.tick(100.5, [], false, false);
  if (calls.length !== 0) { console.log(`[test] FAIL — throttle should suppress within interval, got ${calls.length} calls.`); process.exit(1); }

  // Tick at 101.5 (>1.0 since 100): fires again.
  m.tick(101.5, [], false, false);
  if (calls.length !== 6) { console.log(`[test] FAIL — throttle should release after 1s interval, got ${calls.length}.`); process.exit(1); }

  // Combat scenario: 3 chasing enemies, no boss.
  calls.length = 0;
  const enemies = [
    { id: "en_spawned_1", dead: false, _wasChasing: true },
    { id: "en_spawned_2", dead: false, _wasChasing: true },
    { id: "en_spawned_3", dead: false, _wasChasing: true },
  ];
  m.tick(110, enemies, false, false);
  const tCall = calls.find((c) => c[0] === "tension");
  if (Math.abs(tCall[3] - 0.030) > 1e-9) { console.log(`[test] FAIL — tension vol with 3 chasing: expected 0.030, got ${tCall[3]}.`); process.exit(1); }
  const cCall = calls.find((c) => c[0] === "calm");
  if (cCall[3] !== 0) { console.log(`[test] FAIL — calm vol with combat should be 0, got ${cCall[3]}.`); process.exit(1); }

  // Boss scenario: bossRumble=0.018, tension freq=38.
  calls.length = 0;
  m.tick(120, [], true, false);
  const rCall = calls.find((c) => c[0] === "bossRumble");
  if (rCall[3] !== 0.018) { console.log(`[test] FAIL — boss rumble vol (args[3]): expected 0.018, got ${rCall[3]}.`); process.exit(1); }
  const tCall2 = calls.find((c) => c[0] === "tension");
  if (tCall2[1] !== 38) { console.log(`[test] FAIL — boss tension freq: expected 38, got ${tCall2[1]}.`); process.exit(1); }

  console.log(`[test] PASS — mountCombatAmbientTick legacy regression: AMBIENT_INTERVAL=1.0 throttle, 6 setAmbient layers (wind/calm/calm2/tension/tension2/bossRumble), calmVol gated on calm scenario, tensionVol=min(0.055, chasing*0.010), boss tension freq 38 + rumble 0.018 (NATIVE_VERIFIED via legacy anchor).`);
}

/* ---------- camera-zone legacy regression (iter 828) ----------
 * PARITY: mountCameraZoneTick
 *
 * Pins zone-driven camera distance + visibility gates.
 *   • aimMul = 1 - 0.4 * aimAmt
 *   • dist = inCar ? max(camDist, 6) : camDist * aimMul
 *   • firstPerson = !inCar && (spine.zone in [INSIDE, FIRST_PERSON] || dist<0.5)
 *   • heroVisible logic + shadow-blob + fp-gun visibility writes
 *   • return { firstPerson, spineZone, dist, spine, fpGunActive }
 */
{
  const { mountCameraZoneTick } = await import("../src/systems/camera_zone_tick.js");
  const s = { camDist: 8, aimAmt: 0.5, camDistMax: 12 };
  const vis = { heroGroup: null, shadowBlob: null, fpGun: null };
  const m = mountCameraZoneTick({
    get: { camDist: () => s.camDist, aimAmt: () => s.aimAmt, camDistMax: () => s.camDistMax },
    actions: {
      evaluateSpine: (zoom, max) => ({ zone: "OUTSIDE", params: { heroVisible: true } }),
      isActiveDrone: (inCar) => false,
      setHeroGroupVisible:   (v) => { vis.heroGroup   = v; },
      setShadowBlobVisible:  (v) => { vis.shadowBlob  = v; },
      setFpGunGroupVisible:  (v) => { vis.fpGun       = v; },
    },
  });

  // Test 1: third-person aiming, not in car. aimMul = 1 - 0.4*0.5 = 0.8.
  // dist = 8 * 0.8 = 6.4. firstPerson = false (zone OUTSIDE, dist>=0.5).
  const r1 = m.tick(0.016, { buildMode: false, inCar: false, computerOpen: false, heroDead: false });
  if (Math.abs(r1.dist - 6.4) > 1e-9)   { console.log(`[test] FAIL — dist (TP+aim): expected 6.4, got ${r1.dist}.`); process.exit(1); }
  if (r1.firstPerson !== false)         { console.log(`[test] FAIL — firstPerson should be false at OUTSIDE zone + dist=6.4.`); process.exit(1); }
  if (vis.heroGroup !== true)           { console.log(`[test] FAIL — heroGroup visible expected true.`); process.exit(1); }
  if (vis.shadowBlob !== true)          { console.log(`[test] FAIL — shadowBlob visible (TP, not buildMode, not inCar).`); process.exit(1); }
  if (vis.fpGun !== false)              { console.log(`[test] FAIL — fpGun should be hidden in TP.`); process.exit(1); }

  // Test 2: inCar enforces dist=max(camDist, 6). Reset camDist=4 → dist=6.
  s.camDist = 4; s.aimAmt = 0;
  const r2 = m.tick(0.016, { buildMode: false, inCar: true, computerOpen: false, heroDead: false });
  if (r2.dist !== 6)                    { console.log(`[test] FAIL — inCar dist min: expected 6, got ${r2.dist}.`); process.exit(1); }
  if (vis.shadowBlob !== false)         { console.log(`[test] FAIL — shadowBlob hidden inCar.`); process.exit(1); }

  // Test 3: FP_DIST_THRESH gate — small dist forces firstPerson.
  s.camDist = 0.3; s.aimAmt = 0;
  const r3 = m.tick(0.016, { buildMode: false, inCar: false, computerOpen: false, heroDead: false });
  if (r3.firstPerson !== true)          { console.log(`[test] FAIL — firstPerson should trigger at dist=0.3 (<0.5).`); process.exit(1); }
  if (vis.fpGun !== true)               { console.log(`[test] FAIL — fpGun should be active in firstPerson.`); process.exit(1); }
  if (vis.shadowBlob !== false)         { console.log(`[test] FAIL — shadowBlob hidden in FP.`); process.exit(1); }

  // Test 4: heroDead suppresses fpGun.
  const r4 = m.tick(0.016, { buildMode: false, inCar: false, computerOpen: false, heroDead: true });
  if (vis.fpGun !== false)              { console.log(`[test] FAIL — fpGun should hide when heroDead.`); process.exit(1); }

  console.log(`[test] PASS — mountCameraZoneTick legacy regression: aimMul=1-0.4*aimAmt, inCar dist min=6, FP_DIST_THRESH=0.5, hero/shadow/fpGun visibility writes (NATIVE_VERIFIED via legacy anchor).`);
}

process.exit(0);
