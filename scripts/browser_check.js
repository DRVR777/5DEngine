import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 8080);
const URL = `http://localhost:${PORT}/?_5dtest=1`;
const ARTIFACT_DIR = "tests/browser-artifacts";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const errors = [];
  const messages = [];
  const diagnostics = {
    startedAt: new Date().toISOString(),
    url: URL,
    errors,
    messages,
    finalState: null,
  };

  const server = spawn("node", ["game_server.js", String(PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", d => messages.push({ type: "server.stdout", text: String(d) }));
  server.stderr.on("data", d => messages.push({ type: "server.stderr", text: String(d) }));

  await sleep(2500);

  const browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=swiftshader", "--enable-webgl"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("http://localhost:3001/api/**", route => {
    const url = route.request().url();
    const body = url.includes("/git/status")
      ? { ok: true, stubbed: true, head: "browser-check" }
      : { ok: true, stubbed: true };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  page.on("console", msg => {
    const item = { type: `console.${msg.type()}`, text: msg.text() };
    messages.push(item);
    if (msg.type() === "error") errors.push(item);
  });
  page.on("pageerror", err => {
    errors.push({ type: "pageerror", message: err.message, stack: err.stack });
  });
  page.on("requestfailed", req => {
    errors.push({ type: "requestfailed", url: req.url(), failure: req.failure()?.errorText || "" });
  });

  try {
    await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForFunction(() => window._5DTest, null, { timeout: 15000 });
    await page.evaluate(() => window._5DTest.installCrashHandler?.());
    await page.waitForTimeout(5000);
    diagnostics.finalState = await page.evaluate(() => {
      const api = window._5DTest;
      return api?.state?.() || api?.getState?.() || { has5DTest: !!api, title: document.title };
    });
    const bridgeErrors = await page.evaluate(() => window._5DTest?.getErrors?.() || []);
    for (const err of bridgeErrors) errors.push({ type: "bridge", ...err });
  } catch (e) {
    errors.push({ type: "navigation-or-evaluate", message: e.message, stack: e.stack });
  }

  await browser.close();
  try { server.kill(); } catch {}

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(`${ARTIFACT_DIR}/browser-check.json`, JSON.stringify(diagnostics, null, 2));

  if (errors.length === 0) {
    console.log("BROWSER OK");
    process.exit(0);
  }

  console.log("BROWSER FAILED");
  console.log(JSON.stringify(errors, null, 2));
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
