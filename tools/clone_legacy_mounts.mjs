#!/usr/bin/env node
/** tools/clone_legacy_mounts.mjs
 *
 *  Snapshot every mount* call site from game.html into its own file
 *  under docs/codex/legacy/mount_calls/. Preserves the call EXACTLY
 *  as it appears in the legacy source, plus a few lines of context
 *  before and after, plus the file's full bytewise hash, so future
 *  migration work can diff against an untouched reference.
 *
 *  Also writes a full snapshot of game.html itself at
 *  docs/codex/legacy/game.html.snapshot — once, only if not present
 *  (idempotent — re-running won't clobber the first snapshot).
 *
 *  Usage:
 *    node tools/clone_legacy_mounts.mjs
 *
 *  Idempotent: each mount file is overwritten with the current
 *  game.html content on every run, BUT only the call extraction
 *  changes. The bytewise snapshot of game.html is written only once.
 *  Per CLAUDE.md "shadow-run / authority-flip" discipline — the
 *  legacy authority must be readable until the substrate proves
 *  equivalent behavior. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT      = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME      = join(ROOT, "game.html");
const LEGACY    = join(ROOT, "docs", "codex", "legacy");
const CALLS_DIR = join(LEGACY, "mount_calls");
const SNAPSHOT  = join(LEGACY, "game.html.snapshot");
const INDEX_MD  = join(LEGACY, "MOUNT_INDEX.md");
const CONTEXT_LINES = 4;

mkdirSync(CALLS_DIR, { recursive: true });

const src = readFileSync(GAME, "utf8");
const srcHash = createHash("sha256").update(src).digest("hex");
const lines = src.split(/\r?\n/);

if (!existsSync(SNAPSHOT)) {
  writeFileSync(SNAPSHOT, src, "utf8");
}

/** Find all mount* CALL sites and DEFINITION sites in game.html. Most
 *  mount* are defined in external modules (imported), so game.html
 *  contains call sites only — we capture each call's full argument
 *  expression by walking balanced parens. */
function findMountCalls(text) {
  const out = [];
  const re = /\bmount[A-Z][A-Za-z0-9_]+\b\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const name      = m[0].replace(/\s*\($/, "");
    const callStart = m.index;          // position of "mount" identifier
    const parenOpen = m.index + m[0].length - 1;
    const end = matchParen(text, parenOpen);
    if (end === -1) continue;
    const callText = text.slice(callStart, end + 1);
    out.push({ name, start: callStart, end, callText });
  }
  return out;
}

function matchParen(text, openIdx) {
  let depth = 0;
  let inString = null;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLineComment) { if (c === "\n") inLineComment = false; continue; }
    if (inBlockComment) { if (c === "*" && n === "/") { inBlockComment = false; i++; } continue; }
    if (inString) {
      if (c === "\\") { i++; continue; }
      if (c === inString) inString = null;
      continue;
    }
    if (inTemplate) {
      if (c === "\\") { i++; continue; }
      if (c === "`")  inTemplate = false;
      continue;
    }
    if (c === "/" && n === "/") { inLineComment  = true; i++; continue; }
    if (c === "/" && n === "*") { inBlockComment = true; i++; continue; }
    if (c === '"' || c === "'") { inString = c; continue; }
    if (c === "`")               { inTemplate = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function lineNumberAt(offset) {
  // 1-based
  let n = 1;
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === "\n") n++;
  return n;
}

function sliceLines(startLine, endLine) {
  const a = Math.max(1, startLine - CONTEXT_LINES);
  const b = Math.min(lines.length, endLine + CONTEXT_LINES);
  return { a, b, text: lines.slice(a - 1, b).join("\n") };
}

const calls = findMountCalls(src);

// Multiple call sites per mount? Group by name.
const byName = new Map();
for (const c of calls) {
  if (!byName.has(c.name)) byName.set(c.name, []);
  byName.get(c.name).push(c);
}

const indexRows = [];
for (const [name, occurrences] of [...byName.entries()].sort()) {
  const blocks = occurrences.map((c, i) => {
    const startLine = lineNumberAt(c.start);
    const endLine   = lineNumberAt(c.end);
    const ctx = sliceLines(startLine, endLine);
    return [
      `// occurrence ${i + 1} of ${occurrences.length}`,
      `// game.html lines ${startLine}..${endLine}`,
      `// (context lines ${ctx.a}..${ctx.b})`,
      "",
      ctx.text,
      "",
    ].join("\n");
  }).join("\n\n");
  const body = [
    `// Legacy clone of ${name} call site(s).`,
    `// Source: game.html @ sha256:${srcHash.slice(0, 16)}`,
    `// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.`,
    `// Purpose: preserve the exact legacy invocation so substrate work`,
    `// can diff against it. Per CLAUDE.md the legacy authority is`,
    `// readable until the substrate equivalent proves identical behavior.`,
    "",
    blocks,
  ].join("\n");
  writeFileSync(join(CALLS_DIR, `${name}.js`), body, "utf8");
  indexRows.push({ name, n: occurrences.length });
}

const idxLines = [
  "# Mount-Call Legacy Clones",
  "",
  `_Generated by \`tools/clone_legacy_mounts.mjs\` from game.html @ sha256:\`${srcHash.slice(0, 16)}\`._`,
  "",
  `Snapshot of game.html preserved at \`game.html.snapshot\` (first-run, idempotent).`,
  "",
  `Total distinct mount* call names: **${indexRows.length}**.`,
  "",
  "| Mount call | call sites in game.html |",
  "|---|---|",
  ...indexRows.map((r) => `| [\`${r.name}\`](mount_calls/${r.name}.js) | ${r.n} |`),
];
writeFileSync(INDEX_MD, idxLines.join("\n") + "\n", "utf8");

console.log(`[clone] ${indexRows.length} mount* names cloned (${calls.length} call sites total).`);
console.log(`[clone] snapshot ${existsSync(SNAPSHOT) ? "present" : "MISSING"} at ${SNAPSHOT}`);
console.log(`[clone] index at ${INDEX_MD}`);
