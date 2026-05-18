/**
 * sustained_tick_no_crash.test.js
 *
 * The most important regression test — run the game tick loop for 15 seconds
 * with various game state mutations happening mid-run. Any crash that happens
 * on every frame (TDZ, undefined property, missing function) will surface here.
 *
 * Scenarios during the 15s window:
 *   - Normal idle tick (hero standing still)
 *   - Shoot once with each weapon while tick runs
 *   - Spawn one of every pickup type mid-run
 *   - Throw grenade mid-run
 *   - Open and close shop mid-run
 *   - Set hero to low HP mid-run (triggers low-HP visual code)
 *   - Trigger wave start mid-run (triggers onWaveStart callbacks)
 *   - Restore HP mid-run
 *   - Zero runtime errors across all 15s
 */
"use strict";

const INIT_WAIT_MS = 4000;
const RUN_DURATION_MS = 15000;
const STEP_MS = 1000;

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

  const weaponIds = await page.evaluate(() => window._5DTest.getWeaponIds());

  // t=1s: shoot with pistol
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("pistol"); window._5DTest.shoot(); });

  // t=2s: spawn health + coin
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.spawnHealth(1, 1); window._5DTest.spawnCoinDrop(2, 1); });

  // t=3s: shoot with rifle
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("rifle"); window._5DTest.shoot(); });

  // t=4s: throw grenade + drop mine
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.throwGrenade(); window._5DTest.dropMine(); });

  // t=5s: open shop then close
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.openShop(); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window._5DTest.closeShop(); });

  // t=6s: shoot shotgun + spawn fire patch
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("shotgun"); window._5DTest.shoot(); window._5DTest.spawnFirePatch(5, 5); });

  // t=7s: low HP stress (low-HP visual tick path)
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => window._5DTest.setHeroHp(5));

  // t=8s: wave start (speed orb spawn)
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => window._5DTest.triggerWaveStart(3));

  // t=9s: shoot sniper
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("sniper"); window._5DTest.shoot(); });

  // t=10s: restore HP + throw smoke
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setHeroHp(100); window._5DTest.throwSmoke(); });

  // t=11s: spawn armor + weapon pickup
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.spawnArmor(3, 3); window._5DTest.spawnWeaponPickup(4, 3, "pistol"); });

  // t=12s: shoot SMG
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("smg"); window._5DTest.shoot(); });

  // t=13s: poison puddle + perk picker
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.spawnPoisonPuddle(6, 6); window._5DTest.showPerkPicker(3); });
  await page.waitForTimeout(200);
  await page.evaluate(() => window._5DTest.closeOverlays());

  // t=14s: sniper scope on/off
  await page.waitForTimeout(STEP_MS);
  await page.evaluate(() => { window._5DTest.setWeapon("sniper"); window._5DTest.setAiming(true); });
  await page.waitForTimeout(300);
  await page.evaluate(() => window._5DTest.setAiming(false));

  // t=15s: final idle settle
  await page.waitForTimeout(STEP_MS);

  const finalState = await page.evaluate(() => window._5DTest.getState());

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );

  const screenshot = `${screenshotDir}/sustained_tick.png`;
  await page.screenshot({ path: screenshot });

  if (runtimeErrors.length > 0) {
    return {
      pass: false,
      message: `${runtimeErrors.length} runtime error(s) in 15s tick run:\n  ${runtimeErrors.slice(0, 10).join("\n  ")}`,
      screenshot,
    };
  }

  return {
    pass: true,
    message: [
      `15s sustained tick: zero runtime errors`,
      `  heroHp=${finalState.heroHp} alive=${finalState.heroAlive}`,
      `  bullets=${finalState.bulletCount} orbs=${finalState.speedOrbCount}`,
      `  fire=${finalState.firePatchCount} poison=${finalState.poisonPuddleCount}`,
    ].join("\n"),
    screenshot,
  };
}

module.exports = { run, name: "sustained_tick_no_crash" };
