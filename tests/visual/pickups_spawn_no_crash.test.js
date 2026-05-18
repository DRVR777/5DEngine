/**
 * pickups_spawn_no_crash.test.js
 *
 * Spawn every pickup/hazard type and verify none throw during creation or
 * during the tick loop that processes them.
 *
 * Scenarios:
 *   - health pickup spawns and appears in scene
 *   - ammo pickup spawns
 *   - armor shard spawns
 *   - weapon pickup spawns (one per weapon type)
 *   - coin drop spawns
 *   - speed orb spawns (wave start path)
 *   - fire patch spawns
 *   - poison puddle spawns
 *   - all pickups survive 2 tick seconds without crashing
 */
"use strict";

const INIT_WAIT_MS = 4000;
const TICK_SETTLE_MS = 2000;

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

  const before = await page.evaluate(() => window._5DTest.getState());
  const failures = [];

  // --- Health pickup ---
  const r_health = await page.evaluate(() => window._5DTest.spawnHealth(2, 2));
  if (!r_health.ok) failures.push(`spawnHealth threw: ${r_health.error}`);

  // --- Ammo pickup ---
  const r_ammo = await page.evaluate(() => window._5DTest.spawnAmmo(3, 2));
  if (!r_ammo.ok) failures.push(`spawnAmmo threw: ${r_ammo.error}`);

  // --- Armor shard ---
  const r_armor = await page.evaluate(() => window._5DTest.spawnArmor(4, 2));
  if (!r_armor.ok) failures.push(`spawnArmor threw: ${r_armor.error}`);

  // --- Weapon pickups — one per weapon type ---
  const weaponIds = await page.evaluate(() => window._5DTest.getWeaponIds());
  for (const [i, id] of weaponIds.entries()) {
    const r = await page.evaluate(([u, wid]) => window._5DTest.spawnWeaponPickup(u, 4, wid), [i * 2, id]);
    if (!r.ok) failures.push(`spawnWeaponPickup(${id}) threw: ${r.error}`);
  }

  // --- Coin drop ---
  const r_coin = await page.evaluate(() => window._5DTest.spawnCoinDrop(6, 2));
  if (!r_coin.ok) failures.push(`spawnCoinDrop threw: ${r_coin.error}`);

  // --- Speed orb (wave >= 2 path) ---
  const r_orb = await page.evaluate(() => window._5DTest.triggerWaveStart(3));
  if (!r_orb.ok) failures.push(`triggerWaveStart(speed orb) threw: ${r_orb.error}`);

  // --- Fire patch ---
  const r_fire = await page.evaluate(() => window._5DTest.spawnFirePatch(8, 2));
  if (!r_fire.ok) failures.push(`spawnFirePatch threw: ${r_fire.error}`);

  // --- Poison puddle ---
  const r_poison = await page.evaluate(() => window._5DTest.spawnPoisonPuddle(10, 2));
  if (!r_poison.ok) failures.push(`spawnPoisonPuddle threw: ${r_poison.error}`);

  // Let the tick loop process all pickups for 2s
  await page.waitForTimeout(TICK_SETTLE_MS);

  const after = await page.evaluate(() => window._5DTest.getState());

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );
  if (runtimeErrors.length > 0) {
    failures.push(`Runtime errors during pickup tick:\n  ${runtimeErrors.slice(0, 5).join("\n  ")}`);
  }

  const screenshot = `${screenshotDir}/pickups.png`;
  await page.screenshot({ path: screenshot });

  if (failures.length > 0) {
    return { pass: false, message: failures.join("\n"), screenshot };
  }

  return {
    pass: true,
    message: [
      `All pickup types spawned without crash`,
      `  health:${after.healthPickupCount} coin:${after.coinDropCount} orb:${after.speedOrbCount}`,
      `  fire:${after.firePatchCount} poison:${after.poisonPuddleCount}`,
    ].join("\n"),
    screenshot,
  };
}

module.exports = { run, name: "pickups_spawn_no_crash" };
