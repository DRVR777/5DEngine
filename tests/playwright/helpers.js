import fs from "node:fs";
import { expect } from "@playwright/test";

export async function gotoTestGame(page, errors = []) {
  await page.route("http://localhost:3001/api/**", route => {
    const url = route.request().url();
    const body = url.includes("/git/status")
      ? { ok: true, stubbed: true, head: "playwright" }
      : { ok: true, stubbed: true };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  page.on("console", msg => {
    if (msg.type() === "error") errors.push({ type: "console.error", text: msg.text() });
  });
  page.on("pageerror", err => {
    errors.push({ type: "pageerror", message: err.message, stack: err.stack });
  });
  page.on("requestfailed", req => {
    errors.push({ type: "requestfailed", url: req.url(), failure: req.failure()?.errorText || "" });
  });
  await page.goto("/?_5dtest=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window._5DTest, null, { timeout: 15000 });
  await page.evaluate(() => window._5DTest.installCrashHandler());
  await page.evaluate(() => window._5DTest.dismissAllDialogs());
  return errors;
}

export async function bridge(page, method, ...args) {
  return page.evaluate(([name, params]) => window._5DTest[name](...params), [method, args]);
}

export async function state(page) {
  return bridge(page, "state");
}

export async function assertNoRuntimeErrors(page, errors) {
  const bridgeErrors = await bridge(page, "getErrors");
  expect([...errors, ...bridgeErrors]).toEqual([]);
}

export async function waitForEnemy(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await state(page);
    const alive = s.enemies?.filter(e => !e.dead) || [];
    if (alive.length > 0) return alive[0];
    await bridge(page, "startWaveMode");
    await page.waitForTimeout(250);
  }
  throw new Error("No living enemy appeared before timeout");
}

export async function killNearest(page, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await bridge(page, "dismissAllDialogs");
    await bridge(page, "ensureGodModeAndInfiniteAmmo");
    const id = await bridge(page, "lockOnNearestEnemy");
    if (id) {
      await bridge(page, "shoot");
      const killed = await bridge(page, "killEnemy", id);
      if (killed?.ok !== false) return id;
    }
    await page.waitForTimeout(100);
  }
  throw new Error("Could not kill nearest enemy before timeout");
}

export function writeArtifact(name, data) {
  fs.mkdirSync("tests/browser-artifacts", { recursive: true });
  fs.writeFileSync(`tests/browser-artifacts/${name}`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
}
