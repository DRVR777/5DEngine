/**
 * wave_start_no_crash.test.js
 *
 * Verify that triggering a wave-start (which calls _spawnSpeedOrb) does not
 * throw a ReferenceError or any other crash.
 *
 * What this catches:
 *   - `now is not defined` in _spawnSpeedOrb (iter 429 regression)
 *   - Any future wave-start callback crash
 *   - Speed orb not actually appearing in scene after spawn
 */
"use strict";

const INIT_WAIT_MS = 4000;

async function run(page, screenshotDir) {
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.waitForTimeout(INIT_WAIT_MS);

  const bridgeReady = await page.evaluate(() => typeof window._5DTest !== "undefined");
  if (!bridgeReady) {
    return { pass: false, message: "window._5DTest not found — was ?_5dtest=1 in the URL?" };
  }

  await page.evaluate(() => window._5DTest.closeOverlays());
  await page.waitForTimeout(100);

  const before = await page.evaluate(() => window._5DTest.getState());

  // Simulate wave 3 start — waveNum >= 2 triggers _spawnSpeedOrb
  const result = await page.evaluate(() => window._5DTest.triggerWaveStart(3));

  await page.waitForTimeout(200);

  const after = await page.evaluate(() => window._5DTest.getState());

  const screenshot = `${screenshotDir}/wave_start.png`;
  await page.screenshot({ path: screenshot });

  if (!result.ok) {
    return { pass: false, message: `triggerWaveStart threw: ${result.error}`, screenshot };
  }

  if (pageErrors.length > 0) {
    return {
      pass: false,
      message: `Runtime error during wave start:\n  ${pageErrors.slice(0, 3).join("\n  ")}`,
      screenshot,
    };
  }

  const orbSpawned = after.speedOrbCount > before.speedOrbCount;
  if (!orbSpawned) {
    return {
      pass: false,
      message: `triggerWaveStart returned ok but no speed orb in scene (before=${before.speedOrbCount}, after=${after.speedOrbCount})`,
      screenshot,
    };
  }

  return {
    pass: true,
    message: `wave start ok — speed orbs: ${before.speedOrbCount} → ${after.speedOrbCount}`,
    screenshot,
  };
}

module.exports = { run, name: "wave_start_no_crash" };
