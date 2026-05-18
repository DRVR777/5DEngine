/**
 * sniper_scope_is_first_person.test.js
 *
 * Verify that activating the sniper scope snaps the camera to first-person
 * (camDist < 0.1) and shows the scope overlay, NOT the third-person shoulder view.
 *
 * What this catches:
 *   - Scope showing from 3rd-person (iter 420 regression)
 *   - Scope lerp passing through INSIDE zone and freezing
 *   - scopeOverlay element not becoming visible
 */
"use strict";

const { grade } = require("./grader");

const INIT_WAIT_MS = 4000;
const SCOPE_SETTLE_MS = 300;  // after snap, give one rAF cycle to update DOM

async function run(page, screenshotDir) {
  const pageErrors = [];
  page.on("pageerror", err => pageErrors.push(err.message));

  await page.waitForTimeout(INIT_WAIT_MS);

  const bridgeReady = await page.evaluate(() => typeof window._5DTest !== "undefined");
  if (!bridgeReady) {
    return { pass: false, message: "window._5DTest not found — was ?_5dtest=1 in the URL?" };
  }

  // Equip sniper and enable aiming
  await page.evaluate(() => {
    window._5DTest.setWeapon("sniper");
    window._5DTest.setAiming(true);
  });

  // Give the tick loop one or two frames to apply camDist snap + show overlay
  await page.waitForTimeout(SCOPE_SETTLE_MS);

  const state = await page.evaluate(() => window._5DTest.getState());

  const screenshot = `${screenshotDir}/sniper_scope.png`;
  await page.screenshot({ path: screenshot });

  const failures = [];

  if (state.camDist >= 0.1) {
    failures.push(`camDist is ${state.camDist.toFixed(3)} — expected < 0.1 (FP zone) after scope snap`);
  }

  if (!state.scopeVisible) {
    failures.push(`#scopeOverlay is not visible — scope UI did not show after sniper aim`);
  }

  if (pageErrors.length > 0) {
    failures.push(`Runtime error during scope: ${pageErrors[0]}`);
  }

  // Optional visual grade
  const gradeResult = await grade(
    screenshot,
    "Is this image showing a first-person sniper scope overlay (circular scope reticle visible, no third-person character visible)?"
  );

  const visual = gradeResult.skipped
    ? `  visual grade: SKIPPED (${gradeResult.reason})`
    : `  visual grade: ${gradeResult.pass ? "PASS" : "FAIL"} — model said "${gradeResult.raw}"`;

  if (!gradeResult.skipped && !gradeResult.pass) {
    failures.push(`Visual grade failed: model said "${gradeResult.raw}"`);
  }

  if (failures.length > 0) {
    return {
      pass: false,
      message: failures.join("\n  ") + "\n" + visual,
      screenshot,
    };
  }

  return {
    pass: true,
    message: `camDist=${state.camDist.toFixed(3)}, scopeVisible=true\n${visual}`,
    screenshot,
  };
}

module.exports = { run, name: "sniper_scope_is_first_person" };
