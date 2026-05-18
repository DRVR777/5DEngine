/**
 * no_runtime_errors_at_boot.test.js
 *
 * Load the game, wait 5 seconds, fail if any unhandled JS error fires.
 * Catches: TDZ crashes (crouching bug), init-time TypeErrors, missing variables.
 * This test alone would have caught every regression from this session at commit time.
 */
"use strict";

const BOOT_WAIT_MS = 5000;

async function run(page, screenshotDir) {
  const errors = [];

  page.on("pageerror", err => {
    errors.push(err.message);
  });
  page.on("console", msg => {
    if (msg.type() === "error") {
      const t = msg.text();
      if (/Uncaught|ReferenceError|TypeError|SyntaxError/.test(t)) {
        errors.push(`console.error: ${t}`);
      }
    }
  });

  await page.waitForTimeout(BOOT_WAIT_MS);

  const screenshot = `${screenshotDir}/boot.png`;
  await page.screenshot({ path: screenshot, fullPage: false });

  if (errors.length > 0) {
    return {
      pass: false,
      message: `${errors.length} runtime error(s) at boot:\n  ${errors.slice(0, 5).join("\n  ")}`,
      screenshot,
    };
  }

  return {
    pass: true,
    message: `No runtime errors in first ${BOOT_WAIT_MS / 1000}s`,
    screenshot,
  };
}

module.exports = { run, name: "no_runtime_errors_at_boot" };
