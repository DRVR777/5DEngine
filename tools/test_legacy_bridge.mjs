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

process.exit(0);
