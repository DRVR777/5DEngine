// test_script_paths.js — verifies every <script src> in index.html resolves to a real file
// Run: node tests/test_script_paths.js
// Pass: exits 0 with "ALL PASS"
// Fail: exits 1 listing every missing path

const fs   = require("fs");
const path = require("path");

const ROOT      = path.resolve(__dirname, "..");
const HTML_PATH = path.join(ROOT, "index.html");

if (!fs.existsSync(HTML_PATH)) {
  console.error("FAIL: index.html not found at", HTML_PATH);
  process.exit(1);
}

const html   = fs.readFileSync(HTML_PATH, "utf8");
const tagRx  = /src="([^"]+\.js)"/g;
const srcs   = [];
let m;
while ((m = tagRx.exec(html)) !== null) srcs.push(m[1]);

if (srcs.length === 0) {
  console.error("FAIL: no <script src> tags found in index.html");
  process.exit(1);
}

let pass = 0, fail = 0;
const failures = [];

for (const src of srcs) {
  const resolved = path.resolve(ROOT, src.replace(/^\.\//, ""));
  if (fs.existsSync(resolved)) {
    pass++;
  } else {
    fail++;
    failures.push(src);
  }
}

console.log(`Script path check: ${pass} pass, ${fail} fail (${srcs.length} total tags)`);

if (failures.length) {
  console.error("MISSING FILES:");
  failures.forEach(f => console.error("  " + f));
  process.exit(1);
}

// Check that no script still uses the old flat-root pattern
const flatRx = /src="\.\/((?!src\/)[A-Za-z0-9_]+\.js)"/g;
const flatHits = [];
let fm;
while ((fm = flatRx.exec(html)) !== null) flatHits.push(fm[1]);

if (flatHits.length) {
  console.error("FAIL: scripts still using flat root path (not moved to src/):");
  flatHits.forEach(f => console.error("  ./" + f));
  process.exit(1);
}

console.log("ALL PASS — no missing files, no flat-root script paths");
process.exit(0);
