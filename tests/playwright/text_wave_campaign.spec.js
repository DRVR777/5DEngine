import { test, expect } from "@playwright/test";
import { bridge, state, writeArtifact } from "./helpers.js";

test.use({
  viewport: { width: 1, height: 1 },
  screenshot: "off",
  video: "off",
  trace: "off",
});

const REQUESTED_WAVES = Number(process.env.CAMPAIGN_WAVES || 3);
const MAX_WAVES = process.env.CAMPAIGN_ALLOW_LONG === "1"
  ? REQUESTED_WAVES
  : Math.min(REQUESTED_WAVES, 5);
const MAX_TOTAL_MS = Number(process.env.CAMPAIGN_MAX_MS || 45000);
const SHOT_WAIT_MS = Number(process.env.CAMPAIGN_SHOT_WAIT_MS || 120);
const WAVE_WAIT_MS = Number(process.env.CAMPAIGN_WAVE_WAIT_MS || 250);
const MAX_SHOTS_PER_ENEMY = Number(process.env.CAMPAIGN_MAX_SHOTS_PER_ENEMY || 18);
const MAX_SHOTS_PER_WAVE = Number(process.env.CAMPAIGN_MAX_SHOTS_PER_WAVE || 260);
const MAX_BULLETS = Number(process.env.CAMPAIGN_MAX_BULLETS || 18);
const MAX_ENEMY_BULLETS = Number(process.env.CAMPAIGN_MAX_ENEMY_BULLETS || 24);
const MAX_MEMORY_MB = Number(process.env.CAMPAIGN_MAX_MEMORY_MB || 384);
const MAX_MESH_GROWTH = Number(process.env.CAMPAIGN_MAX_MESH_GROWTH || 220);

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
    enemies: (s.enemies || []).map(e => ({
      id: e.id,
      type: e.type,
      hp: e.hp,
      dead: e.dead,
      distance: e.distance,
    })),
    counts: s.counts,
    perf: s.perf,
    blocked: s.blocked,
  };
}

function livingEnemies(s) {
  return (s.enemies || []).filter(e => !e.dead && (e.hp ?? 0) > 0);
}

async function installTextCampaign(page, pageErrors) {
  await page.route("http://localhost:3001/api/**", route => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stubbed: true }) });
  });
  page.on("console", msg => {
    if (msg.type() === "error") pageErrors.push({ type: "console.error", text: msg.text() });
  });
  page.on("pageerror", err => {
    pageErrors.push({ type: "pageerror", message: err.message, stack: err.stack });
  });
  page.on("requestfailed", req => {
    pageErrors.push({ type: "requestfailed", url: req.url(), failure: req.failure()?.errorText || "" });
  });
  await page.goto("/?_5dtest=1&_5dnorender=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window._5DTest, null, { timeout: 15000 });
  await bridge(page, "installCrashHandler");
  await bridge(page, "setLowPowerMode");
  await bridge(page, "clearErrors");
  await bridge(page, "dismissAllDialogs");
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");
}

async function assertBudgets(page, pageErrors, baselineCounts, events) {
  const s = await state(page);
  const bridgeErrors = await bridge(page, "getErrors");
  const meshGrowth = (s.counts?.meshes ?? 0) - (baselineCounts.meshes ?? 0);
  const failures = [];
  if (pageErrors.length) failures.push({ reason: "page-error", errors: pageErrors.slice() });
  if (bridgeErrors.length) failures.push({ reason: "bridge-error", errors: bridgeErrors.slice() });
  if (s.hero?.dead) failures.push({ reason: "hero-dead", state: compactState(s) });
  if ((s.counts?.bullets ?? 0) > MAX_BULLETS) failures.push({ reason: "bullet-budget", bullets: s.counts.bullets });
  if ((s.counts?.enemyBullets ?? 0) > MAX_ENEMY_BULLETS) failures.push({ reason: "enemy-bullet-budget", enemyBullets: s.counts.enemyBullets });
  if ((s.perf?.memoryMB ?? 0) > MAX_MEMORY_MB) failures.push({ reason: "memory-budget", memoryMB: s.perf.memoryMB });
  if (meshGrowth > MAX_MESH_GROWTH) failures.push({ reason: "mesh-growth-budget", meshGrowth });
  if (failures.length) {
    events.push({ type: "budget-failure", failures, state: compactState(s) });
    throw new Error(`campaign budget/runtime failure: ${JSON.stringify(failures[0])}`);
  }
  return s;
}

async function shootEnemyUntilDead(page, enemy, baselineCounts, pageErrors, events) {
  let previousHp = enemy.hp;
  for (let shot = 0; shot < MAX_SHOTS_PER_ENEMY; shot++) {
    await bridge(page, "ensureGodModeAndInfiniteAmmo");
    await bridge(page, "moveHeroTowardEnemy", enemy.id, 4);
    const fired = await bridge(page, "fireAtEnemyByPosition", enemy.id, { spawnNearTarget: true });
    await page.waitForTimeout(SHOT_WAIT_MS);
    const s = await assertBudgets(page, pageErrors, baselineCounts, events);
    const current = (s.enemies || []).find(e => e.id === enemy.id);
    events.push({
      type: "text-shot",
      id: enemy.id,
      enemyType: enemy.type,
      shot,
      fired,
      from: previousHp,
      to: current?.hp,
      dead: current?.dead,
    });
    if (!current || current.dead || (current.hp ?? 0) <= 0) return { ok: true, shots: shot + 1 };
    if ((current.hp ?? previousHp) < previousHp) previousHp = current.hp;
  }
  return { ok: false, reason: "enemy survived shot budget", id: enemy.id, lastHp: previousHp };
}

async function waitForWaveToAdvance(page, currentWave, baselineCounts, pageErrors, events) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await bridge(page, "dismissAllDialogs");
    const perk = await bridge(page, "pickPreferredPerk", PERK_PRIORITY);
    if (perk?.picked) events.push({ type: "perk", wave: currentWave, picked: perk.picked });
    await bridge(page, "advanceWaveClock", 4, 0.35);
    const s = await assertBudgets(page, pageErrors, baselineCounts, events);
    if ((s.wave?.number || 0) > currentWave) return s;
    if (livingEnemies(s).length > 0) return s;
    await page.waitForTimeout(WAVE_WAIT_MS);
  }
  return state(page);
}

test("text campaign clears waves by position-simulated movement and real bullet damage", async ({ page }) => {
  const pageErrors = [];
  const events = [];
  const started = Date.now();
  let wavesCleared = 0;
  let totalShots = 0;

  await installTextCampaign(page, pageErrors);
  const baseline = await state(page);
  const baselineCounts = { ...baseline.counts };

  while (wavesCleared < MAX_WAVES && Date.now() - started < MAX_TOTAL_MS) {
    let s = await assertBudgets(page, pageErrors, baselineCounts, events);
    if (!s.wave?.number || s.wave.phase === "idle") {
      await bridge(page, "startWaveMode");
      await bridge(page, "advanceWaveClock", 12, 0.35);
      s = await assertBudgets(page, pageErrors, baselineCounts, events);
    }

    const waveNumber = s.wave.number || 1;
    let shotsThisWave = 0;
    events.push({ type: "wave-start", wave: waveNumber, state: compactState(s) });

    while (Date.now() - started < MAX_TOTAL_MS) {
      await bridge(page, "ensureGodModeAndInfiniteAmmo");
      await bridge(page, "dismissAllDialogs");
      await bridge(page, "pickPreferredPerk", PERK_PRIORITY);
      await bridge(page, "advanceWaveClock", 2, 0.25);
      s = await assertBudgets(page, pageErrors, baselineCounts, events);

      const alive = livingEnemies(s).sort((a, b) => a.distance - b.distance);
      if (alive.length === 0 && (s.wave.aliveCount || 0) <= 0) break;
      if (alive.length === 0) {
        await page.waitForTimeout(WAVE_WAIT_MS);
        continue;
      }
      if (shotsThisWave >= MAX_SHOTS_PER_WAVE) {
        throw new Error(`wave ${waveNumber} exceeded shot budget`);
      }

      const target = alive[0];
      const result = await shootEnemyUntilDead(page, target, baselineCounts, pageErrors, events);
      shotsThisWave += result.shots || MAX_SHOTS_PER_ENEMY;
      totalShots += result.shots || MAX_SHOTS_PER_ENEMY;
      if (!result.ok) throw new Error(`failed to kill enemy by real bullet damage: ${JSON.stringify(result)}`);
    }

    const afterClear = await waitForWaveToAdvance(page, waveNumber, baselineCounts, pageErrors, events);
    wavesCleared++;
    events.push({
      type: "wave-cleared",
      wave: waveNumber,
      shotsThisWave,
      nextWave: afterClear.wave?.number,
      state: compactState(afterClear),
    });
  }

  const finalState = await state(page);
  const bridgeErrors = await bridge(page, "getErrors");
  const artifact = {
    generatedAt: new Date().toISOString(),
    pass: pageErrors.length === 0 && bridgeErrors.length === 0 && wavesCleared >= MAX_WAVES,
    config: {
      requestedWaves: REQUESTED_WAVES,
      maxWaves: MAX_WAVES,
      allowLong: process.env.CAMPAIGN_ALLOW_LONG === "1",
      maxTotalMs: MAX_TOTAL_MS,
      shotWaitMs: SHOT_WAIT_MS,
      waveWaitMs: WAVE_WAIT_MS,
      maxShotsPerEnemy: MAX_SHOTS_PER_ENEMY,
      maxShotsPerWave: MAX_SHOTS_PER_WAVE,
    },
    durationMs: Date.now() - started,
    wavesCleared,
    totalShots,
    pageErrors,
    bridgeErrors,
    finalState: compactState(finalState),
    events: events.slice(-1000),
  };

  writeArtifact("text-wave-campaign.json", artifact);
  writeArtifact("text-wave-campaign.md", [
    `# Text wave campaign ${artifact.generatedAt}`,
    `Result: ${artifact.pass ? "PASS" : "FAIL"}`,
    `Waves cleared: ${wavesCleared} / ${MAX_WAVES}`,
    `Duration: ${artifact.durationMs} ms`,
    `Total shots: ${totalShots}`,
    `Errors: ${pageErrors.length + bridgeErrors.length}`,
    "",
    "## Last Events",
    "```json",
    JSON.stringify(artifact.events.slice(-40), null, 2),
    "```",
  ].join("\n"));

  expect([...pageErrors, ...bridgeErrors]).toEqual([]);
  expect(wavesCleared).toBeGreaterThanOrEqual(MAX_WAVES);
});
