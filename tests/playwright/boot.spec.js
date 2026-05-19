import { test, expect } from "@playwright/test";
import { assertNoRuntimeErrors, gotoTestGame, state } from "./helpers.js";

test("loads with test bridge and no boot errors", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  await page.waitForTimeout(5000);
  const s = await state(page);
  expect(s.hero).toBeTruthy();
  expect(s.wave).toBeTruthy();
  expect(s.perf).toBeTruthy();
  await assertNoRuntimeErrors(page, errors);
});

test("test bridge exposes playable state shape", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  const s = await state(page);
  expect(s.hero.hp).toBeGreaterThan(0);
  expect(s.hero.weaponId).toBeTruthy();
  expect(s.wave.number).toBeGreaterThanOrEqual(1);
  expect(["fp", "tp", "build"]).toContain(s.camera.mode);
  await assertNoRuntimeErrors(page, errors);
});

test("sixty frames pass without runtime errors", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    function step() {
      frames++;
      if (frames >= 60) resolve();
      else requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }));
  await assertNoRuntimeErrors(page, errors);
});
