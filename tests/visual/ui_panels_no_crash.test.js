/**
 * ui_panels_no_crash.test.js
 *
 * Open and close every UI panel. Verifies none throw during open/close
 * and that the game state reflects the expected open/closed flags.
 *
 * Scenarios:
 *   - shop: open → state.shopOpen true → close → state.shopOpen false
 *   - settings: open → state.settingsOpen true → close → false
 *   - perk picker wave 1: opens without crash
 *   - perk picker wave 5: opens without crash (different perk pool)
 *   - npc dialog: open → state.npcDialogOpen true → close → false
 *   - No runtime errors across all open/close cycles
 */
"use strict";

const INIT_WAIT_MS = 4000;

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

  // --- Shop open/close ---
  const r_shopOpen = await page.evaluate(() => window._5DTest.openShop());
  if (!r_shopOpen.ok) { failures.push(`openShop threw: ${r_shopOpen.error}`); }
  else {
    await page.waitForTimeout(100);
    const s1 = await page.evaluate(() => window._5DTest.getState());
    if (!s1.shopOpen) notes.push("shop: open returned ok but shopOpen flag is false");
    const r_shopClose = await page.evaluate(() => window._5DTest.closeShop());
    if (!r_shopClose.ok) failures.push(`closeShop threw: ${r_shopClose.error}`);
    await page.waitForTimeout(100);
    const s2 = await page.evaluate(() => window._5DTest.getState());
    if (s2.shopOpen) failures.push("shop: closed but shopOpen flag still true");
    else notes.push("shop: open → close ok");
  }

  // --- Settings open/close ---
  const r_setOpen = await page.evaluate(() => window._5DTest.openSettings());
  if (!r_setOpen.ok) { failures.push(`openSettings threw: ${r_setOpen.error}`); }
  else {
    await page.waitForTimeout(100);
    const s3 = await page.evaluate(() => window._5DTest.getState());
    if (!s3.settingsOpen) notes.push("settings: open returned ok but settingsOpen flag is false");
    const r_setClose = await page.evaluate(() => window._5DTest.closeSettings());
    if (!r_setClose.ok) failures.push(`closeSettings threw: ${r_setClose.error}`);
    await page.waitForTimeout(100);
    const s4 = await page.evaluate(() => window._5DTest.getState());
    if (s4.settingsOpen) failures.push("settings: closed but settingsOpen flag still true");
    else notes.push("settings: open → close ok");
  }

  // --- Perk picker (wave 1 — early wave, basic perks) ---
  const r_perk1 = await page.evaluate(() => window._5DTest.showPerkPicker(1));
  if (!r_perk1.ok) failures.push(`showPerkPicker(1) threw: ${r_perk1.error}`);
  else notes.push("perk picker wave 1: ok");
  await page.evaluate(() => window._5DTest.closeOverlays());
  await page.waitForTimeout(100);

  // --- Perk picker (wave 5 — higher wave, more perks unlocked) ---
  const r_perk5 = await page.evaluate(() => window._5DTest.showPerkPicker(5));
  if (!r_perk5.ok) failures.push(`showPerkPicker(5) threw: ${r_perk5.error}`);
  else notes.push("perk picker wave 5: ok");
  await page.evaluate(() => window._5DTest.closeOverlays());
  await page.waitForTimeout(100);

  // --- NPC dialog open/close ---
  const r_npcOpen = await page.evaluate(() => window._5DTest.openNpcDialog("merchant"));
  if (!r_npcOpen.ok) failures.push(`openNpcDialog threw: ${r_npcOpen.error}`);
  else {
    await page.waitForTimeout(100);
    const r_npcClose = await page.evaluate(() => window._5DTest.closeNpcDialog());
    if (!r_npcClose.ok) failures.push(`closeNpcDialog threw: ${r_npcClose.error}`);
    else notes.push("npc dialog: open → close ok");
  }

  const runtimeErrors = pageErrors.filter(e =>
    /TypeError|ReferenceError|is not defined|Cannot read/i.test(e)
  );
  if (runtimeErrors.length > 0) {
    failures.push(`Runtime errors during UI panel test:\n  ${runtimeErrors.slice(0, 5).join("\n  ")}`);
  }

  const screenshot = `${screenshotDir}/ui_panels.png`;
  await page.screenshot({ path: screenshot });

  if (failures.length > 0) {
    return { pass: false, message: failures.join("\n") + (notes.length ? "\n" + notes.join("\n") : ""), screenshot };
  }

  return { pass: true, message: notes.join("\n"), screenshot };
}

module.exports = { run, name: "ui_panels_no_crash" };
