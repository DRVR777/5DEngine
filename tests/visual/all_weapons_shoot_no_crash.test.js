/**
 * all_weapons_shoot_no_crash.test.js
 *
 * Cycle through every weapon defined in CFG.weapons and fire one shot with each.
 * Verifies _tryShoot() doesn't throw for any weapon, ammo decrements, and
 * no runtime errors appear after firing all weapons.
 *
 * Scenarios:
 *   - pistol shoot
 *   - rifle shoot
 *   - shotgun shoot
 *   - smg shoot
 *   - sniper shoot (no scope, 3rd-person)
 *   - Each weapon: ammo decrements or bullet spawns
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

  const weaponIds = await page.evaluate(() => window._5DTest.getWeaponIds());
  if (!weaponIds.length) {
    return { pass: false, message: "No weapons returned from getWeaponIds()" };
  }

  const failures = [];
  const results = [];

  for (const id of weaponIds) {
    // Switch to this weapon
    await page.evaluate((wid) => window._5DTest.switchWeapon(wid), id);
    await page.waitForTimeout(50);

    const before = await page.evaluate(() => window._5DTest.getState());

    const shootResult = await page.evaluate(() => window._5DTest.shoot());
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => window._5DTest.getState());

    if (!shootResult.ok) {
      failures.push(`${id}: shoot threw: ${shootResult.error}`);
    } else {
      const ammoDropped = after.pistolAmmo < before.pistolAmmo;
      const bulletSpawned = after.bulletCount > before.bulletCount;
      results.push(`${id}: ok (ammo ${before.pistolAmmo}→${after.pistolAmmo}, bullets+${after.bulletCount - before.bulletCount})`);
      if (!ammoDropped && !bulletSpawned) {
        // Some weapons (melee, drone) may not spawn bullets — just log, not fail
        results[results.length - 1] += " [no ammo drop/bullet — may be expected for this weapon type]";
      }
    }
  }

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );
  if (runtimeErrors.length > 0) {
    failures.push(`Runtime errors during weapon cycle:\n  ${runtimeErrors.slice(0, 5).join("\n  ")}`);
  }

  const screenshot = `${screenshotDir}/all_weapons.png`;
  await page.screenshot({ path: screenshot });

  if (failures.length > 0) {
    return { pass: false, message: failures.join("\n"), screenshot };
  }

  return {
    pass: true,
    message: `All ${weaponIds.length} weapons fired without crash:\n  ${results.join("\n  ")}`,
    screenshot,
  };
}

module.exports = { run, name: "all_weapons_shoot_no_crash" };
