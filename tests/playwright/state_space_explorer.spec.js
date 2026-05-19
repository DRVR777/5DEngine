import { test, expect } from "@playwright/test";
import { bridge, state, writeArtifact } from "./helpers.js";

test.use({
  viewport: { width: 1, height: 1 },
  screenshot: "off",
  video: "off",
  trace: "off",
});

const MAX_DEPTH = Number(process.env.PATH_DEPTH || 4);
const MAX_PATHS = Number(process.env.PATH_MAX_PATHS || 12);
const STEP_WAIT_MS = Number(process.env.PATH_STEP_WAIT_MS || 200);
const MAX_BULLETS = Number(process.env.PATH_MAX_BULLETS || 16);
const MAX_ENEMY_BULLETS = Number(process.env.PATH_MAX_ENEMY_BULLETS || 16);
const MAX_MESH_GROWTH = Number(process.env.PATH_MAX_MESH_GROWTH || 180);
const MAX_MEMORY_MB = Number(process.env.PATH_MAX_MEMORY_MB || 384);

const PERK_PLANS = [
  ["Power Shot", "Quick Hands", "Ammo Dump"],
  ["Resilient", "Battle Medic", "Sprinter"],
  ["Quick Hands", "Ammo Dump", "Power Shot"],
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

function stateKey(s) {
  const alive = (s.enemies || []).filter(e => !e.dead && (e.hp ?? 0) > 0);
  const nearest = alive
    .map(e => `${e.type}:${Math.ceil((e.hp ?? 0) / 25) * 25}`)
    .slice(0, 3)
    .join(",");
  return [
    s.wave?.number || 0,
    s.wave?.phase || "none",
    Math.min(alive.length, 9),
    s.blocked?.by || "open",
    nearest,
  ].join("|");
}

function candidateActions(s) {
  const actions = [];
  const blockedBy = s.blocked?.by || "";
  const alive = (s.enemies || []).filter(e => !e.dead && (e.hp ?? 0) > 0);

  if (s.blocked?.blocked) {
    actions.push({ type: "dismiss" });
    if (blockedBy.includes("perk")) {
      for (const plan of PERK_PLANS) actions.push({ type: "pick-perk", plan });
    }
    return actions;
  }

  if (!s.wave || ["idle", "done"].includes(s.wave.phase || "")) {
    actions.push({ type: "start-wave" });
    return actions;
  }

  if (alive.length > 0 || (s.wave.aliveCount || 0) > 0) {
    actions.push({ type: "position-shot" });
    actions.push({ type: "shoot-burst", shots: 2 });
    actions.push({ type: "wait", ms: STEP_WAIT_MS });
    return actions;
  }

  actions.push({ type: "wait", ms: STEP_WAIT_MS });
  actions.push({ type: "force-next-wave" });
  return actions;
}

async function installLowPowerGame(page, errors) {
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
  await bridge(page, "installCrashHandler");
  await bridge(page, "setLowPowerMode");
}

async function resetRoot(page) {
  await bridge(page, "clearErrors");
  await bridge(page, "hardReset");
  await bridge(page, "setLowPowerMode");
  await bridge(page, "dismissAllDialogs");
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");
}

async function applyAction(page, action) {
  await bridge(page, "ensureGodModeAndInfiniteAmmo");
  if (action.type === "dismiss") return bridge(page, "dismissAllDialogs");
  if (action.type === "pick-perk") return bridge(page, "pickPreferredPerk", action.plan);
  if (action.type === "start-wave") return bridge(page, "startWaveMode");
  if (action.type === "position-shot") return bridge(page, "fireAtEnemyByPosition");
  if (action.type === "shoot-burst") return bridge(page, "shootNearestBurst", action.shots);
  if (action.type === "force-next-wave") return bridge(page, "forceNextWave");
  if (action.type === "wait") {
    await page.waitForTimeout(action.ms);
    return { ok: true, waited: action.ms };
  }
  return { ok: false, error: `unknown action: ${action.type}` };
}

function evaluateState({ s, baselineCounts, bridgeErrors, pageErrors, before, afterAction }) {
  const errors = [];
  const meshGrowth = (s.counts?.meshes ?? 0) - (baselineCounts.meshes ?? 0);
  if (pageErrors.length) errors.push({ reason: "page-error", errors: pageErrors.slice() });
  if (bridgeErrors.length) errors.push({ reason: "bridge-error", errors: bridgeErrors.slice() });
  if (s.hero?.dead) errors.push({ reason: "hero-dead", state: compactState(s) });
  if ((s.counts?.bullets ?? 0) > MAX_BULLETS) errors.push({ reason: "bullet-budget", bullets: s.counts.bullets });
  if ((s.counts?.enemyBullets ?? 0) > MAX_ENEMY_BULLETS) errors.push({ reason: "enemy-bullet-budget", enemyBullets: s.counts.enemyBullets });
  if (meshGrowth > MAX_MESH_GROWTH) errors.push({ reason: "mesh-growth-budget", meshGrowth });
  if ((s.perf?.memoryMB ?? 0) > MAX_MEMORY_MB) errors.push({ reason: "memory-budget", memoryMB: s.perf.memoryMB });

  const beforeHp = new Map((before?.enemies || []).map(e => [e.id, e.hp]));
  const damage = (s.enemies || []).some(e => beforeHp.has(e.id) && (e.hp ?? 0) < beforeHp.get(e.id));
  if (afterAction?.type === "position-shot" && !damage && (before?.enemies || []).some(e => !e.dead)) {
    errors.push({ reason: "shot-made-no-damage", action: afterAction, before: compactState(before), after: compactState(s) });
  }

  return errors;
}

async function replayPath(page, path, pageErrors) {
  await resetRoot(page);
  let baseline = await state(page);
  const baselineCounts = { ...baseline.counts };
  const events = [];
  let before = baseline;

  for (let step = 0; step < path.length; step++) {
    const action = path[step];
    const actionResult = await applyAction(page, action);
    await page.waitForTimeout(STEP_WAIT_MS);
    const after = await state(page);
    const bridgeErrors = await bridge(page, "getErrors");
    const verdicts = evaluateState({
      s: after,
      baselineCounts,
      bridgeErrors,
      pageErrors,
      before,
      afterAction: action,
    });
    events.push({
      step,
      action,
      actionResult,
      key: stateKey(after),
      verdicts,
      state: compactState(after),
    });
    if (verdicts.length) return { ok: false, failedAt: step, path, events };
    before = after;
  }
  return { ok: true, path, events };
}

test("bounded state-space explorer branches decisions and short-circuits bad paths", async ({ page }) => {
  const pageErrors = [];
  const queue = [[]];
  const seen = new Set();
  const results = [];
  const failures = [];

  await installLowPowerGame(page, pageErrors);

  while (queue.length && results.length < MAX_PATHS) {
    const path = queue.shift();
    const result = await replayPath(page, path, pageErrors);
    results.push(result);
    if (!result.ok) {
      failures.push(result);
      continue;
    }
    if (path.length >= MAX_DEPTH) continue;

    const latestState = result.events.at(-1)?.state || await state(page);
    const key = `${path.length}:${stateKey(latestState)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    for (const action of candidateActions(latestState)) {
      queue.push([...path, action]);
      if (queue.length + results.length >= MAX_PATHS * 3) break;
    }
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    pass: failures.length === 0,
    config: {
      maxDepth: MAX_DEPTH,
      maxPaths: MAX_PATHS,
      stepWaitMs: STEP_WAIT_MS,
      budgets: {
        maxBullets: MAX_BULLETS,
        maxEnemyBullets: MAX_ENEMY_BULLETS,
        maxMeshGrowth: MAX_MESH_GROWTH,
        maxMemoryMB: MAX_MEMORY_MB,
      },
    },
    exploredPaths: results.length,
    failures,
    frontierSamples: results.slice(-10),
  };

  writeArtifact("state-space-explorer.json", artifact);
  writeArtifact("state-space-explorer.md", [
    `# State-space explorer ${artifact.generatedAt}`,
    `Result: ${artifact.pass ? "PASS" : "FAIL"}`,
    `Explored paths: ${artifact.exploredPaths}`,
    `Failures: ${failures.length}`,
    "",
    "## Config",
    "```json",
    JSON.stringify(artifact.config, null, 2),
    "```",
    "",
    "## First Failure",
    "```json",
    JSON.stringify(failures[0] || null, null, 2),
    "```",
  ].join("\n"));

  expect(failures).toEqual([]);
  expect(results.length).toBeGreaterThan(0);
});
