/**
 * shoot_no_crash.test.js
 *
 * Verify that calling _tryShoot() doesn't throw and actually spawns a bullet.
 * Uses the _5DTest bridge (only active when ?_5dtest=1 is in the URL).
 *
 * What this catches:
 *   - Sprite raycast crash (iter 422 regression)
 *   - Any future _tryShoot exception (wrong variable reference, etc.)
 *   - Ammo count change proves a bullet actually spawned
 */
"use strict";

const INIT_WAIT_MS = 4000;  // wait for full game init before calling shoot

async function run(page, screenshotDir) {
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  // Wait for game + test bridge to initialise
  await page.waitForTimeout(INIT_WAIT_MS);

  const bridgeReady = await page.evaluate(() => typeof window._5DTest !== "undefined");
  if (!bridgeReady) {
    return { pass: false, message: "window._5DTest not found — was ?_5dtest=1 in the URL?" };
  }

  // Close any overlays — computer auto-opens on first launch, shopOpen etc. block _tryShoot
  await page.evaluate(() => window._5DTest.closeOverlays());
  await page.waitForTimeout(100);

  // Snapshot ammo before shooting
  const before = await page.evaluate(() => window._5DTest.getState());

  // Call _tryShoot() directly via the bridge
  const shootResult = await page.evaluate(() => window._5DTest.shoot());

  // Small wait for any async side effects
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => window._5DTest.getState());

  const screenshot = `${screenshotDir}/shoot.png`;
  await page.screenshot({ path: screenshot });

  if (!shootResult.ok) {
    return {
      pass: false,
      message: `_tryShoot() threw: ${shootResult.error}`,
      screenshot,
    };
  }

  if (pageErrors.length > 0) {
    return {
      pass: false,
      message: `Unhandled error after shoot:\n  ${pageErrors.slice(0, 3).join("\n  ")}`,
      screenshot,
    };
  }

  const ammoDropped = after.pistolAmmo < before.pistolAmmo;
  const bulletSpawned = after.bulletCount > 0;

  if (!ammoDropped && !bulletSpawned) {
    return {
      pass: false,
      message: `shoot() returned ok but ammo didn't drop (${before.pistolAmmo} → ${after.pistolAmmo}) and no bullet in scene`,
      screenshot,
    };
  }

  return {
    pass: true,
    message: `shoot() ok — ammo ${before.pistolAmmo} → ${after.pistolAmmo}, bullets in scene: ${after.bulletCount}`,
    screenshot,
  };
}

module.exports = { run, name: "shoot_no_crash" };
