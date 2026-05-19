import { test, expect } from "@playwright/test";
import { bridge, gotoTestGame, state, writeArtifact } from "./helpers.js";

const DURATION_MS = Number(process.env.SOAK_MS || 15000);
const POLL_MS = Number(process.env.SOAK_POLL_MS || 500);

test("survival soak keeps running without browser errors", async ({ page }) => {
  const errors = [];
  const samples = [];
  const actions = [];
  await gotoTestGame(page, errors);
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");

  const started = Date.now();
  while (Date.now() - started < DURATION_MS) {
    await bridge(page, "dismissAllDialogs");
    await bridge(page, "pickFirstPerk");
    await bridge(page, "ensureGodModeAndInfiniteAmmo");
    const s = await state(page);
    samples.push({ elapsedMs: Date.now() - started, wave: s.wave, perf: s.perf, counts: s.counts });
    if (s.wave.aliveCount > 0 || s.enemies.some(e => !e.dead)) {
      const id = await bridge(page, "lockOnNearestEnemy");
      if (id) {
        await bridge(page, "shoot");
        if (Date.now() - started > 1000) await bridge(page, "killEnemy", id);
        actions.push({ elapsedMs: Date.now() - started, type: "engage", id });
      }
    }
    await page.waitForTimeout(POLL_MS);
  }

  const finalState = await state(page);
  const bridgeErrors = await bridge(page, "getErrors");
  const dump = {
    durationMs: Date.now() - started,
    pass: errors.length === 0 && bridgeErrors.length === 0,
    errors,
    bridgeErrors,
    samples: samples.slice(-50),
    actions: actions.slice(-100),
    finalState,
  };
  writeArtifact("last-soak-run.json", dump);
  writeArtifact("last-soak-run.md", [
    `# Soak run ${new Date().toISOString()}`,
    `Result: ${dump.pass ? "PASS" : "FAIL"}`,
    `Duration: ${dump.durationMs}ms`,
    `Errors: ${errors.length + bridgeErrors.length}`,
    `Wave reached: ${finalState.wave?.number}`,
    `Alive enemies: ${finalState.wave?.aliveCount}`,
  ].join("\n"));

  expect([...errors, ...bridgeErrors]).toEqual([]);
  expect(samples.some(s => s.perf?.frameTimeMs > 1000)).toBe(false);
});
