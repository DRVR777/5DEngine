/**
 * explosives_no_crash.test.js
 *
 * Throw/drop every explosive and gadget type, verify no crash during
 * throw and during tick processing (explosion, smoke, flash, mine arming).
 *
 * Scenarios:
 *   - throwGrenade() — spawns grenade, explodes after fuse
 *   - throwSmoke() — smoke cloud patch appears
 *   - throwFlashbang() — flashbang goes off
 *   - dropMine() — mine placed and armed after 1.2s
 *   - all of the above survive 3 tick seconds without runtime errors
 */
"use strict";

const INIT_WAIT_MS = 4000;
const FUSE_SETTLE_MS = 3500;  // grenades + mines need time to arm/explode

async function run(page, screenshotDir) {
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.waitForTimeout(INIT_WAIT_MS);

  const bridgeReady = await page.evaluate(() => typeof window._5DTest !== "undefined");
  if (!bridgeReady) {
    return { pass: false, message: "window._5DTest not found" };
  }

  await page.evaluate(() => window._5DTest.closeOverlays());
  await page.waitForTimeout(100);

  const failures = [];

  // --- Grenade (0s cook = immediate fuse) ---
  const r_gren = await page.evaluate(() => window._5DTest.throwGrenade());
  if (!r_gren.ok) failures.push(`throwGrenade threw: ${r_gren.error}`);

  // --- Smoke grenade ---
  const r_smoke = await page.evaluate(() => window._5DTest.throwSmoke());
  if (!r_smoke.ok) failures.push(`throwSmoke threw: ${r_smoke.error}`);

  // --- Flashbang ---
  const r_flash = await page.evaluate(() => window._5DTest.throwFlashbang());
  if (!r_flash.ok) failures.push(`throwFlashbang threw: ${r_flash.error}`);

  // --- Mine ---
  const r_mine = await page.evaluate(() => window._5DTest.dropMine());
  if (!r_mine.ok) failures.push(`dropMine threw: ${r_mine.error}`);

  // Let tick process: grenade explode, mine arm, smoke dissipate
  await page.waitForTimeout(FUSE_SETTLE_MS);

  const after = await page.evaluate(() => window._5DTest.getState());

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );
  if (runtimeErrors.length > 0) {
    failures.push(`Runtime errors during explosive tick:\n  ${runtimeErrors.slice(0, 5).join("\n  ")}`);
  }

  const screenshot = `${screenshotDir}/explosives.png`;
  await page.screenshot({ path: screenshot });

  if (failures.length > 0) {
    return { pass: false, message: failures.join("\n"), screenshot };
  }

  return {
    pass: true,
    message: `grenade + smoke + flashbang + mine all threw without crash, mines remaining: ${after.mineCount}`,
    screenshot,
  };
}

module.exports = { run, name: "explosives_no_crash" };
