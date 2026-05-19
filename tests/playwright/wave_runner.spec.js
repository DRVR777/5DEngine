import { test, expect } from "@playwright/test";
import { bridge, state, writeArtifact } from "./helpers.js";

test.use({
  viewport: { width: 1, height: 1 },
  screenshot: "off",
  video: "off",
  trace: "off",
});

const REQUESTED_DURATION_MS = Number(process.env.WAVE_RUN_MS || 3000);
const DURATION_MS = process.env.WAVE_RUN_ALLOW_LONG === "1"
  ? REQUESTED_DURATION_MS
  : Math.min(REQUESTED_DURATION_MS, 5000);
const POLL_MS = Number(process.env.WAVE_RUN_POLL_MS || 2000);
const SHOTS_PER_POLL = Number(process.env.WAVE_RUN_SHOTS || 1);
const MAX_WAVE_NUMBER = Number(process.env.WAVE_RUN_MAX_WAVE || 1);
const MAX_POLLS = Number(process.env.WAVE_RUN_MAX_POLLS || 4);
const MAX_BULLETS = Number(process.env.WAVE_RUN_MAX_BULLETS || 12);
const MAX_ENEMY_BULLETS = Number(process.env.WAVE_RUN_MAX_ENEMY_BULLETS || 12);
const MAX_MESH_GROWTH = Number(process.env.WAVE_RUN_MAX_MESH_GROWTH || 150);
const MAX_MEMORY_MB = Number(process.env.WAVE_RUN_MAX_MEMORY_MB || 384);
const PERK_PRIORITY = [
  "Power Shot",
  "Quick Hands",
  "Ammo Dump",
  "Resilient",
  "Battle Medic",
  "Sprinter",
];

function compactState(s) {
  return {
    hero: s.hero,
    wave: s.wave,
    enemies: s.enemies.map(e => ({
      id: e.id,
      type: e.type,
      hp: e.hp,
      dead: e.dead,
      distance: e.distance,
    })),
    perf: s.perf,
    counts: s.counts,
    blocked: s.blocked,
  };
}

test("headless wave runner plays waves until duration or first runtime error", async ({ page }) => {
  const errors = [];
  const samples = [];
  const events = [];
  const killedByBullet = new Set();
  let damageEvents = 0;
  let lastHpByEnemy = new Map();
  let lastWave = null;
  let baselineCounts = null;
  let stopReason = null;

  await page.setViewportSize({ width: 1, height: 1 });
  await page.route("http://localhost:3001/api/**", route => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stubbed: true }) });
  });
  page.on("console", msg => {
    if (msg.type() === "error") errors.push({ type: "console.error", text: msg.text() });
  });
  page.on("pageerror", err => {
    errors.push({ type: "pageerror", message: err.message, stack: err.stack });
  });
  page.on("requestfailed", req => {
    errors.push({ type: "requestfailed", url: req.url(), failure: req.failure()?.errorText || "" });
  });
  await page.goto("/?_5dtest=1&_5dnorender=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window._5DTest, null, { timeout: 15000 });
  await page.evaluate(() => window._5DTest.installCrashHandler());
  await bridge(page, "clearErrors");
  await bridge(page, "setLowPowerMode");
  await bridge(page, "dismissAllDialogs");
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");

  const started = Date.now();
  for (let poll = 0; poll < MAX_POLLS && Date.now() - started < DURATION_MS; poll++) {
    const elapsedMs = Date.now() - started;

    await bridge(page, "ensureGodModeAndInfiniteAmmo");
    await bridge(page, "dismissAllDialogs");
    const perk = await bridge(page, "pickPreferredPerk", PERK_PRIORITY);
    if (perk?.picked) events.push({ elapsedMs, type: "perk", picked: perk.picked });

    let s = await state(page);
    if (!baselineCounts) baselineCounts = { ...s.counts };
    const meshGrowth = (s.counts.meshes ?? 0) - (baselineCounts.meshes ?? 0);
    if ((s.counts.bullets ?? 0) > MAX_BULLETS) {
      stopReason = `bullet budget exceeded: ${s.counts.bullets}`;
      events.push({ elapsedMs, type: "safety-stop", reason: stopReason, state: compactState(s) });
      break;
    }
    if ((s.counts.enemyBullets ?? 0) > MAX_ENEMY_BULLETS) {
      stopReason = `enemy bullet budget exceeded: ${s.counts.enemyBullets}`;
      events.push({ elapsedMs, type: "safety-stop", reason: stopReason, state: compactState(s) });
      break;
    }
    if (meshGrowth > MAX_MESH_GROWTH) {
      stopReason = `mesh growth budget exceeded: ${meshGrowth}`;
      events.push({ elapsedMs, type: "safety-stop", reason: stopReason, state: compactState(s) });
      break;
    }
    if ((s.perf.memoryMB ?? 0) > MAX_MEMORY_MB) {
      stopReason = `memory budget exceeded: ${s.perf.memoryMB}MB`;
      events.push({ elapsedMs, type: "safety-stop", reason: stopReason, state: compactState(s) });
      break;
    }
    if (s.wave.number !== lastWave) {
      lastWave = s.wave.number;
      events.push({ elapsedMs, type: "wave", wave: s.wave });
      if (lastWave && lastWave > MAX_WAVE_NUMBER) {
        events.push({ elapsedMs, type: "stop", reason: "max wave reached", maxWave: MAX_WAVE_NUMBER });
        break;
      }
    }

    for (const en of s.enemies) {
      const prevHp = lastHpByEnemy.get(en.id);
      if (prevHp != null && en.hp < prevHp) {
        damageEvents++;
        events.push({ elapsedMs, type: "bullet-damage", id: en.id, from: prevHp, to: en.hp });
      }
      if (prevHp != null && prevHp > 0 && en.dead) {
        killedByBullet.add(en.id);
        events.push({ elapsedMs, type: "enemy-dead", id: en.id, wave: s.wave.number });
      }
      lastHpByEnemy.set(en.id, en.hp);
    }

    const alive = s.enemies.filter(e => !e.dead);
    if (alive.length === 0 && ["idle", "done"].includes(s.wave.phase || "")) {
      await bridge(page, "startWaveMode");
    }
    if (alive.length > 0 || s.wave.aliveCount > 0) {
      for (let i = 0; i < SHOTS_PER_POLL; i++) {
        const shot = await bridge(page, "fireAtEnemyByPosition");
        if (shot?.ok) events.push({ elapsedMs, type: "position-shot", id: shot.id, distance: shot.distance });
      }
    }

    if (samples.length === 0 || elapsedMs - samples[samples.length - 1].elapsedMs >= 2000) {
      samples.push({ elapsedMs, ...compactState(s) });
    }

    const bridgeErrors = await bridge(page, "getErrors");
    if (errors.length || bridgeErrors.length) {
      events.push({ elapsedMs, type: "runtime-error", errors, bridgeErrors });
      break;
    }

    await page.waitForTimeout(POLL_MS);
  }

  const finalState = await state(page);
  const bridgeErrors = await bridge(page, "getErrors");
  const result = {
    durationMs: Date.now() - started,
    plannedDurationMs: DURATION_MS,
    pass: errors.length === 0 && bridgeErrors.length === 0,
    stopReason,
    safetyBudgets: {
      durationMs: DURATION_MS,
      requestedDurationMs: REQUESTED_DURATION_MS,
      allowLong: process.env.WAVE_RUN_ALLOW_LONG === "1",
      maxPolls: MAX_POLLS,
      maxBullets: MAX_BULLETS,
      maxEnemyBullets: MAX_ENEMY_BULLETS,
      maxMeshGrowth: MAX_MESH_GROWTH,
      maxMemoryMB: MAX_MEMORY_MB,
    },
    errors,
    bridgeErrors,
    waveReached: finalState.wave?.number,
    finalState: compactState(finalState),
    killedByBullet: [...killedByBullet],
    damageEvents,
    events: events.slice(-500),
    samples: samples.slice(-120),
  };

  writeArtifact("wave-runner.json", result);
  writeArtifact("wave-runner.md", [
    `# Wave runner ${new Date().toISOString()}`,
    `Result: ${result.pass ? "PASS" : "FAIL"}`,
    `Duration: ${result.durationMs} / ${result.plannedDurationMs} ms`,
    `Stop reason: ${result.stopReason || "completed budget"}`,
    `Wave reached: ${result.waveReached}`,
    `Enemies killed after bullet damage tracking: ${result.killedByBullet.length}`,
    `Position-shot damage events: ${result.damageEvents}`,
    `Errors: ${errors.length + bridgeErrors.length}`,
    "",
    "## Last Events",
    "```json",
    JSON.stringify(result.events.slice(-30), null, 2),
    "```",
  ].join("\n"));

  expect([...errors, ...bridgeErrors]).toEqual([]);
  expect(stopReason).toBe(null);
  expect(result.damageEvents).toBeGreaterThan(0);
});
