// Run on your machine after confirming tests pass to record the current commit as
// the last known-good fallback that friends' machines will check out if the latest breaks.
// Also tags HEAD as the git 'working' tag so the in-game "Pull Working" button works.
//
// Usage: npm run mark-good

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function run(cmd, silent = false) {
  return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
}

// Tests must pass before we mark anything as good
console.log("[mark-good] Running unit tests...");
run("npm test");

// Write the current SHA to the tracking file
const sha = run("git rev-parse HEAD", true).trim();
writeFileSync("docs/LAST_GOOD_COMMIT", sha + "\n");
const shortSha = sha.slice(0, 8);
console.log(`[mark-good] Marked ${shortSha} as last known-good commit.`);

// Also tag HEAD as 'working' so in-game "Pull Working" button can use it
run("git tag -f working HEAD");

// Commit LAST_GOOD_COMMIT and push everything
run("git add docs/LAST_GOOD_COMMIT");
try {
  run(`git commit -m "chore: mark ${shortSha} as last known-good commit"`);
  run("git push origin HEAD");
  run("git push origin working --force");
  console.log("[mark-good] Pushed to remote.");
} catch {
  console.log("[mark-good] Nothing new to commit (already up to date).");
}
