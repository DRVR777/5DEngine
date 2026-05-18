/**
 * runner.js — 5DEngine visual test harness
 *
 * Usage:
 *   node tests/visual/runner.js
 *
 * Requires:
 *   - Game server running at https://localhost:5050 (start with: node server.js --https)
 *   - Playwright installed (npm install)
 *   - Chromium browser (npx playwright install chromium)
 *
 * Optional:
 *   - Ollama running at localhost:11434 with a vision model for visual grading
 *     (gemma3:4b, llava:7b, moondream, etc.)
 *
 * Exit code: 0 = all passed, 1 = any failed or server unreachable
 */
"use strict";

const { chromium } = require("playwright");
const https  = require("https");
const http   = require("http");
const fs     = require("fs");
const path   = require("path");

const GAME_URL      = "https://localhost:5050";
const TEST_URL      = `${GAME_URL}/?_5dtest=1`;
const SCREENSHOT_DIR = path.join(__dirname, "screenshots");
const TESTS = [
  "./no_runtime_errors_at_boot.test.js",
  "./shoot_no_crash.test.js",
  "./sniper_scope_is_first_person.test.js",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function _checkServer(url) {
  return new Promise(resolve => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.request(url, { method: "HEAD", rejectUnauthorized: false, timeout: 3000 }, res => {
      resolve(res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function _pad(s, n) { return String(s).padEnd(n); }

function _fmt(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n5DEngine Visual Test Harness");
  console.log("─".repeat(52));

  // 1. Check server
  const serverUp = await _checkServer(GAME_URL);
  if (!serverUp) {
    console.error(`\n  ERROR: Game server not reachable at ${GAME_URL}`);
    console.error("  Start it with:  node server.js  (or the HTTPS variant)\n");
    process.exit(1);
  }
  console.log(`  Game server: UP at ${GAME_URL}`);

  // 2. Ensure screenshot dir
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // 3. Launch browser — ignoreHTTPSErrors for self-signed cert on localhost
  const browser = await chromium.launch({
    headless: true,
    args: ["--ignore-certificate-errors", "--disable-web-security"],
  });

  const results = [];
  let passed = 0, failed = 0;

  for (const testFile of TESTS) {
    const testMod = require(path.resolve(__dirname, testFile));
    const name    = testMod.name || path.basename(testFile, ".test.js");

    // Fresh page per test — clean state, no bleed
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page    = await context.newPage();

    // Silence expected Three.js asset-404 noise that isn't a test concern
    page.on("requestfailed", () => {});

    await page.goto(TEST_URL, { waitUntil: "domcontentloaded", timeout: 15000 });

    const t0 = Date.now();
    let result;
    try {
      result = await testMod.run(page, SCREENSHOT_DIR);
    } catch (e) {
      result = { pass: false, message: `Test threw: ${e.message}` };
    }
    const elapsed = Date.now() - t0;

    await context.close();

    const icon = result.pass ? "✓" : "✗";
    const status = result.pass ? "PASS" : "FAIL";
    console.log(`\n  ${icon} ${_pad(name, 38)} ${status}  (${_fmt(elapsed)})`);
    if (result.message) {
      const lines = result.message.split("\n");
      for (const line of lines) console.log(`      ${line}`);
    }
    if (result.screenshot) {
      console.log(`      screenshot: ${path.relative(process.cwd(), result.screenshot)}`);
    }

    results.push({ name, ...result, elapsed });
    if (result.pass) passed++; else failed++;
  }

  await browser.close();

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(52));
  console.log(`  ${passed} passed, ${failed} failed  (${results.length} total)\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("Runner crashed:", e);
  process.exit(1);
});
