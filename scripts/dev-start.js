// Run this script to auto-update and verify the repo before starting the game server.
// On first run (or when stale), pulls latest git, runs unit tests, and falls back to
// the last known-good commit if the latest breaks tests.
//
// Usage: node scripts/dev-start.js
//        npm run dev:start

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { parseLastGoodCommit, isCommitStale, buildFallbackMessage } from "./update_logic.js";

function run(cmd, silent = false) {
  return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
}

function runTests() {
  try { run("npm test"); return true; }
  catch { return false; }
}

// 1. Fetch remote state (no merge yet)
run("git fetch origin");

// 2. Compare local HEAD vs remote main
const local  = run("git rev-parse HEAD", true).trim();
const remote = run("git rev-parse origin/main", true).trim();

// 3. Pull if stale
if (isCommitStale(local, remote)) {
  console.log("[dev-start] Local is behind remote. Pulling latest...");
  run("git pull origin main");
  run("npm ci --prefer-offline");
} else {
  console.log("[dev-start] Already up to date.");
}

// 4. Run lightweight tests (vitest, no browser required)
console.log("[dev-start] Running unit tests...");
if (runTests()) {
  console.log("[dev-start] Tests passed. Run: npm start");
  process.exit(0);
}

// 5. Tests failed — attempt fallback to last known-good commit
console.warn("[dev-start] Tests failed on latest commit.");
const lgcPath = "docs/LAST_GOOD_COMMIT";
if (!existsSync(lgcPath)) {
  console.error("[dev-start] No docs/LAST_GOOD_COMMIT found. Cannot recover — fix the tests or ask the repo owner to run: npm run mark-good");
  process.exit(1);
}

const lgcSha = parseLastGoodCommit(readFileSync(lgcPath, "utf8"));
if (!lgcSha) {
  console.error("[dev-start] docs/LAST_GOOD_COMMIT is empty. Cannot recover.");
  process.exit(1);
}

console.warn(`[dev-start] ${buildFallbackMessage(lgcSha)}`);
run(`git checkout ${lgcSha}`);
run("npm ci --prefer-offline");

console.log("[dev-start] Running unit tests on fallback commit...");
if (runTests()) {
  console.log("[dev-start] Fallback OK. Run: npm start");
  process.exit(0);
}

console.error("[dev-start] Fallback commit also fails tests. The repo is in a broken state at both the latest and last-known-good commits. Contact the repo owner.");
process.exit(1);
