// Run on your machine (or in CI) after confirming tests pass to record the
// current commit as the last known-good fallback.
// Also tags HEAD as the git 'working' tag so in-game "Pull Working" button works.
//
// Local usage:  npm run mark-good
// CI usage:     node scripts/mark-good.js --ci
//   --ci skips vitest (already ran in CI), sets bot git identity,
//   and adds [skip ci] to the commit message to prevent an autograde loop.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const isCI = process.argv.includes("--ci");

function run(cmd, silent = false) {
  return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
}

// In CI, the unit tests and Playwright already ran. Skip locally.
if (!isCI) {
  console.log("[mark-good] Running unit tests...");
  run("npm test");
}

// Write the current SHA to the tracking file
const sha = run("git rev-parse HEAD", true).trim();
writeFileSync("docs/LAST_GOOD_COMMIT", sha + "\n");
const shortSha = sha.slice(0, 8);
console.log(`[mark-good] Marked ${shortSha} as last known-good commit.`);

// Also tag HEAD as 'working' so in-game "Pull Working" button can use it
try {
  run("git tag -f working HEAD");
} catch {
  console.log("[mark-good] Could not create working tag (may not have local repo access).");
}

// Commit LAST_GOOD_COMMIT and push
run("git add docs/LAST_GOOD_COMMIT");

// [skip ci] prevents GitHub Actions from re-running autograde on this metadata commit
const ciSuffix = isCI ? " [skip ci]" : "";
try {
  run(`git commit -m "chore: mark ${shortSha} as last known-good commit${ciSuffix}"`);
  // Use HEAD:main so this works even when CI checks out a detached HEAD
  run("git push origin HEAD:main");
  if (!isCI) run("git push origin working --force");
  console.log("[mark-good] Pushed to remote.");
} catch {
  console.log("[mark-good] Nothing new to commit (already up to date).");
}
