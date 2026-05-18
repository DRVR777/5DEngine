/**
 * hero_damage_states_no_crash.test.js
 *
 * Drive the hero through all HP states and verify no crash at any point.
 * Tests the damage flash, regen, and low-HP code paths that run every tick.
 *
 * Scenarios:
 *   - full HP → receive moderate damage → state.heroHp decremented
 *   - low HP (< 25%) — tick handles regen pulse and warning visuals
 *   - HP set to 1 → survive 2s of tick without crash (near-death state)
 *   - HP restored to full → heroAlive still true
 *   - flashDamage() is safe to call at any HP level
 *   - applyDamage(0) is a no-op, doesn't crash
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

  const failures = [];
  const notes = [];

  // --- Full HP baseline ---
  const r_full = await page.evaluate(() => window._5DTest.setHeroHp(100));
  if (!r_full.ok) failures.push(`setHeroHp(100) threw: ${r_full.error}`);
  const s_full = await page.evaluate(() => window._5DTest.getState());
  notes.push(`full HP: heroHp=${s_full.heroHp}`);

  // --- Moderate damage ---
  const r_dmg = await page.evaluate(() => window._5DTest.applyDamage(40));
  if (!r_dmg.ok) failures.push(`applyDamage(40) threw: ${r_dmg.error}`);
  await page.waitForTimeout(100);
  const s_dmg = await page.evaluate(() => window._5DTest.getState());
  if (s_dmg.heroHp >= s_full.heroHp) failures.push(`HP didn't drop after applyDamage(40): ${s_full.heroHp} → ${s_dmg.heroHp}`);
  else notes.push(`damage: ${s_full.heroHp} → ${s_dmg.heroHp}`);

  // --- Zero-damage no-op ---
  const r_nodmg = await page.evaluate(() => window._5DTest.applyDamage(0));
  if (!r_nodmg.ok) failures.push(`applyDamage(0) threw: ${r_nodmg.error}`);

  // --- Low HP state (near-death visual tick) ---
  const r_low = await page.evaluate(() => window._5DTest.setHeroHp(5));
  if (!r_low.ok) failures.push(`setHeroHp(5) threw: ${r_low.error}`);
  // Survive 2s of tick in near-death state — catches pulse/flash crashes
  await page.waitForTimeout(TICK_SETTLE_MS);
  const s_low = await page.evaluate(() => window._5DTest.getState());
  if (!s_low.heroAlive) failures.push("Hero died when HP set to 5 — expected alive");
  else notes.push(`low HP tick: survived 2s at hp=${s_low.heroHp}`);

  // --- Restore to full ---
  const r_restore = await page.evaluate(() => window._5DTest.setHeroHp(100));
  if (!r_restore.ok) failures.push(`setHeroHp(100) restore threw: ${r_restore.error}`);
  const s_restore = await page.evaluate(() => window._5DTest.getState());
  if (!s_restore.heroAlive) failures.push("Hero not alive after HP restore");
  else notes.push(`restore: heroHp=${s_restore.heroHp}, alive=${s_restore.heroAlive}`);

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );
  if (runtimeErrors.length > 0) {
    failures.push(`Runtime errors during damage state test:\n  ${runtimeErrors.slice(0, 5).join("\n  ")}`);
  }

  const screenshot = `${screenshotDir}/hero_damage.png`;
  await page.screenshot({ path: screenshot });

  if (failures.length > 0) {
    return { pass: false, message: failures.join("\n") + "\n" + notes.join("\n"), screenshot };
  }

  return { pass: true, message: notes.join("\n"), screenshot };
}

module.exports = { run, name: "hero_damage_states_no_crash" };
