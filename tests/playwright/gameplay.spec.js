import { test, expect } from "@playwright/test";
import { assertNoRuntimeErrors, bridge, gotoTestGame, killNearest, state, waitForEnemy } from "./helpers.js";

test("can start wave mode and kill one enemy", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");
  await waitForEnemy(page);
  const killedId = await killNearest(page);
  expect(killedId).toBeTruthy();
  const s = await state(page);
  expect(s.enemies.find(e => e.id === killedId)?.dead ?? true).toBeTruthy();
  await assertNoRuntimeErrors(page, errors);
});

test("can clear the current wave through the bridge", async ({ page }) => {
  const errors = [];
  await gotoTestGame(page, errors);
  await bridge(page, "startWaveMode");
  await bridge(page, "ensureGodModeAndInfiniteAmmo");
  await waitForEnemy(page);

  const start = Date.now();
  while (Date.now() - start < 45000) {
    const s = await state(page);
    if ((s.wave.aliveCount || 0) <= 0 && !s.enemies.some(e => !e.dead)) break;
    await killNearest(page, 5000);
    await page.waitForTimeout(250);
  }

  const finalState = await state(page);
  expect(finalState.enemies.filter(e => !e.dead).length).toBe(0);
  await assertNoRuntimeErrors(page, errors);
});
