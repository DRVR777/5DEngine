#!/usr/bin/env node
/** tools/clone_legacy_source.mjs
 *
 *  Snapshot the complete legacy game source — every file game.html
 *  depends on — into docs/codex/legacy/source/ preserving the
 *  directory layout. Computes a sha256 manifest at
 *  docs/codex/legacy/source/MANIFEST.sha256 so future runs can detect
 *  legacy drift.
 *
 *  Scope:
 *    src/          — every .js module game.html script-tags or
 *                    transitively depends on (we copy the whole tree;
 *                    over-inclusion is fine, under-inclusion would
 *                    lose authority).
 *    assets/       — any static asset.
 *    game.html     — the legacy entry HTML.
 *    index.html    — the substrate entry (also snapshotted for diff
 *                    against future rewrites).
 *    package.json + package-lock.json — dependency pinning.
 *
 *  Idempotent: a file is rewritten only if its sha256 changed since
 *  the manifest's recorded hash, so re-running is fast and only
 *  surfaces real drift.
 *
 *  Per CLAUDE.md "shadow-run / authority-flip" — the legacy authority
 *  must remain readable until substrate kinds prove equivalent
 *  behavior. This tool guarantees that authority is preserved
 *  regardless of what substrate work happens upstream of it. */

import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, statSync, copyFileSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "docs", "codex", "legacy", "source");
const MANIFEST_PATH = join(DEST, "MANIFEST.sha256");
const README_PATH   = join(DEST, "README.md");

const TREES = ["src", "assets"];
const FILES = ["game.html", "index.html", "package.json", "package-lock.json"];

/** Recursively yield absolute paths of every file under `dir`. */
function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) yield* walk(abs);
    else if (st.isFile()) yield abs;
  }
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

mkdirSync(DEST, { recursive: true });
const oldManifest = new Map();
if (existsSync(MANIFEST_PATH)) {
  for (const line of readFileSync(MANIFEST_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([a-f0-9]{64})\s{2}(.+)$/);
    if (m) oldManifest.set(m[2], m[1]);
  }
}

const newManifest = new Map();
let copied = 0, unchanged = 0, totalBytes = 0;

function processFile(absSrc) {
  const rel = relative(ROOT, absSrc).replace(/\\/g, "/");
  const buf = readFileSync(absSrc);
  const hash = sha256(buf);
  newManifest.set(rel, hash);
  totalBytes += buf.length;
  if (oldManifest.get(rel) === hash) { unchanged++; return; }
  const dest = join(DEST, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  copied++;
}

for (const tree of TREES) {
  const absTree = join(ROOT, tree);
  for (const file of walk(absTree)) processFile(file);
}
for (const file of FILES) {
  const abs = join(ROOT, file);
  if (existsSync(abs)) processFile(abs);
}

const manifestText = [...newManifest.entries()]
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .map(([path, hash]) => `${hash}  ${path}`)
  .join("\n") + "\n";
writeFileSync(MANIFEST_PATH, manifestText, "utf8");

if (!existsSync(README_PATH)) {
  const readme = [
    "# Legacy Source Clone",
    "",
    "Byte-for-byte snapshot of the legacy game source — every file",
    "`game.html` depends on — preserved here so substrate migration",
    "work can diff against an untouched reference at any time.",
    "",
    "Per `CLAUDE.md`, the legacy authority must remain readable until",
    "the substrate proves equivalent behavior (shadow-run / authority-",
    "flip discipline from `docs/SECOND_ABSTRACTION_PHASE.md`).",
    "",
    "## Contents",
    "",
    "- `src/`              — every .js module the legacy includes",
    "- `assets/`           — static assets",
    "- `game.html`         — legacy entry HTML",
    "- `index.html`        — substrate entry HTML (also snapshotted",
    "                        for diff against future rewrites)",
    "- `package.json` /    — pinned dependency versions",
    "  `package-lock.json`",
    "- `MANIFEST.sha256`   — sha256 of every file, used by",
    "                        `tools/clone_legacy_source.mjs` to detect",
    "                        legacy drift on each re-run",
    "",
    "## Refresh",
    "",
    "```bash",
    "node tools/clone_legacy_source.mjs",
    "```",
    "",
    "Idempotent: only files whose hash has changed since the last run",
    "are rewritten. The manifest is always regenerated.",
    "",
    "## Per-mount call-site clones",
    "",
    "For mechanical extraction at the subsystem level, see",
    "`../mount_calls/` (cloned by `tools/clone_legacy_mounts.mjs`).",
  ].join("\n") + "\n";
  writeFileSync(README_PATH, readme, "utf8");
}

const dropped = [...oldManifest.keys()].filter((k) => !newManifest.has(k));
console.log(`[clone-source] tracked ${newManifest.size} files (${(totalBytes/1024).toFixed(1)} KB).`);
console.log(`[clone-source] copied ${copied}, unchanged ${unchanged}, removed-from-tree ${dropped.length}.`);
if (dropped.length > 0) console.log(`[clone-source] dropped:\n  ${dropped.join("\n  ")}`);
