import { test, expect } from "@playwright/test";
import { assertNoRuntimeErrors, gotoTestGame } from "./helpers.js";

test("test mode boot has no TDZ/runtime regression", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  await page.waitForTimeout(5000);
  await assertNoRuntimeErrors(page, errors);
  expect(await page.evaluate(() => !!window._5DTest)).toBe(true);
});
