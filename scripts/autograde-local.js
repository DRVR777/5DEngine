// Local autograde runner.
// Starts game_server.js if needed, runs the Playwright wave campaign,
// reads all console errors, and either:
//   PASS → runs mark-good.js to update LAST_GOOD_COMMIT
//   FAIL → writes AUTOGRADE_ERRORS.md so the Claude loop can read + fix it
//
// Usage:
//   node scripts/autograde-local.js              (3 waves, fast)
//   CAMPAIGN_WAVES=10 node scripts/autograde-local.js   (all waves)

import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const ARTIFACT_DIR = "tests/browser-artifacts";
const CAMPAIGN_JSON = `${ARTIFACT_DIR}/text-wave-campaign.json`;
const RUNTIME_ERRORS = `${ARTIFACT_DIR}/runtime-errors.json`;
const AUTOGRADE_ERRORS_MD = `${ARTIFACT_DIR}/AUTOGRADE_ERRORS.md`;
const WAVES = process.env.CAMPAIGN_WAVES || "3";

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: opts.silent ? "pipe" : "inherit", ...opts });
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

// ── 1. Check if game_server is already running ──────────────────────────────
async function ensureServerRunning() {
  try {
    const r = await fetch("http://localhost:8080/");
    if (r.ok || r.status < 500) return null; // already up
  } catch {}

  console.log("[autograde] Starting game_server.js on :8080...");
  const proc = spawn("node", ["game_server.js", "8080"], {
    detached: true,
    stdio: "ignore",
  });
  proc.unref();
  // Wait for it to come up
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    try {
      const r = await fetch("http://localhost:8080/");
      if (r.ok || r.status < 500) return proc;
    } catch {}
  }
  throw new Error("game_server.js failed to start within 15s");
}

// ── 2. Run the Playwright campaign ──────────────────────────────────────────
function runCampaign() {
  try {
    run(
      `npx playwright test tests/playwright/text_wave_campaign.spec.js`,
      {
        env: {
          ...process.env,
          CAMPAIGN_WAVES: WAVES,
          CAMPAIGN_MAX_MS: "120000",
          CAMPAIGN_SHOT_WAIT_MS: "80",
          CAMPAIGN_WAVE_WAIT_MS: "150",
        },
      }
    );
    return true;
  } catch {
    return false;
  }
}

// ── 3. Collect all errors ───────────────────────────────────────────────────
function collectErrors() {
  const campaign = readJson(CAMPAIGN_JSON) || {};
  const runtime = readJson(RUNTIME_ERRORS) || [];
  return {
    pageErrors: campaign.pageErrors || [],
    bridgeErrors: campaign.bridgeErrors || [],
    runtimeErrors: runtime,
    wavesCleared: campaign.wavesCleared || 0,
    pass: campaign.pass || false,
    durationMs: campaign.durationMs || 0,
  };
}

// ── 4. Write AUTOGRADE_ERRORS.md for the Claude loop ───────────────────────
function writeErrorReport(info, sha) {
  const allErrors = [...info.pageErrors, ...info.bridgeErrors, ...info.runtimeErrors];
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const lines = [
    `# Autograde Failure — ${new Date().toISOString()} — ${sha.slice(0, 8)}`,
    ``,
    `Waves cleared: ${info.wavesCleared} / ${WAVES}`,
    `Duration: ${info.durationMs}ms`,
    `Total errors: ${allErrors.length}`,
    ``,
    `## Console / Page Errors`,
    ...info.pageErrors.map(e => `- **${e.type}**: ${e.text || e.message || JSON.stringify(e)}`),
    ``,
    `## Bridge Errors`,
    ...info.bridgeErrors.map(e => `- **${e.type}**: ${e.message || JSON.stringify(e)}`),
    ``,
    `## In-Game Runtime Errors (wave ${info.runtimeErrors[0]?.wave ?? "?"})`,
    ...info.runtimeErrors.map(e => [
      `- **${e.type}** (wave ${e.wave || "?"}) @ ${e.timestamp || ""}`,
      `  - message: ${e.message || ""}`,
      e.stack ? `  - stack: \`${e.stack.split("\n")[0]}\`` : "",
    ].filter(Boolean).join("\n")),
    ``,
    `## What to Fix`,
    `Read the errors above. Find the root cause in the source. Fix it, run npm test, commit, push.`,
    `Delete this file when the fix is pushed. The next autograde run will re-create it if still broken.`,
  ];
  writeFileSync(AUTOGRADE_ERRORS_MD, lines.join("\n"));
  console.log(`[autograde] Error report written to ${AUTOGRADE_ERRORS_MD}`);
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const sha = run("git rev-parse HEAD", { silent: true }).trim();
  console.log(`[autograde] Grading ${sha.slice(0, 8)} — ${WAVES} waves`);

  await ensureServerRunning();

  // Clear previous runtime errors so we start fresh
  if (existsSync(RUNTIME_ERRORS)) {
    try { await fetch("http://localhost:3001/api/errors", { method: "DELETE" }); } catch {}
  }

  const campaignPassed = runCampaign();
  const info = collectErrors();
  const totalErrors = info.pageErrors.length + info.bridgeErrors.length + info.runtimeErrors.length;

  if (campaignPassed && totalErrors === 0) {
    console.log(`[autograde] PASS — ${info.wavesCleared} waves, 0 errors`);
    // Delete stale error report if any
    try { run(`del /f "${AUTOGRADE_ERRORS_MD}" 2>nul || rm -f "${AUTOGRADE_ERRORS_MD}"`, { silent: true }); } catch {}
    // Mark this commit as good
    run("node scripts/mark-good.js");
  } else {
    console.warn(`[autograde] FAIL — ${info.wavesCleared} waves, ${totalErrors} errors`);
    writeErrorReport(info, sha);
    process.exit(1);
  }
})();
