#!/usr/bin/env node
/** tools/split_legacy_specs.mjs
 *
 *  One-shot. Reads data/spawns/legacy_systems.json's children array,
 *  writes each child Thinga to its own file at data/legacy/<slug>.json,
 *  then truncates the original spawn-set to an empty stub. After this
 *  script, worlds/default.json should reference each per-spec file via
 *  {ref: "legacy/<slug>"} instead of the lone spawns/legacy_systems
 *  reference.
 *
 *  Run: node tools/split_legacy_specs.mjs
 *
 *  Idempotent — files that already exist are overwritten. Useful for
 *  re-splitting after manual edits to the original spawn-set during
 *  development. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC  = join(ROOT, "data", "spawns", "legacy_systems.json");
const OUT  = join(ROOT, "data", "legacy");

if (!existsSync(SRC)) { console.error(`[split] source not found: ${SRC}`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const parsed = JSON.parse(readFileSync(SRC, "utf8"));
const children = parsed.children || [];
if (children.length === 0) { console.log(`[split] no children to split.`); process.exit(0); }

const writtenRefs = [];
for (const child of children) {
  // expected child shape:
  //   { id: "legacy/hero-regen", kind: "legacy-system", name: "...",
  //     facets: [ {name:"legacy-mount", data: {...}} ] }
  if (!child.id || !child.kind) { console.warn(`[split] skipping child with missing id/kind`); continue; }
  const slug = child.id.replace(/^legacy\//, "");
  const outPath = join(OUT, `${slug}.json`);
  const refId = `legacy/${slug}`;
  // Standalone Thinga — same shape, just as its own top-level row.
  const thinga = {
    id:    child.id,
    kind:  child.kind,
    name:  child.name || child.id,
    facets: child.facets || [],
  };
  writeFileSync(outPath, JSON.stringify(thinga, null, 2) + "\n", "utf8");
  writtenRefs.push(refId);
  console.log(`[split] wrote ${outPath}`);
}

// Truncate the spawn-set: keep it as a doc stub explaining what happened.
const stub = {
  id: "spawns/legacy_systems",
  kind: "spawn-set",
  name: "Legacy mount* subsystems (now per-spec files at data/legacy/)",
  facets: [
    { name: "for-kind", data: "legacy-system" },
    { name: "comment",  data: "Per the no-monolith rule (CLAUDE.md refusals), each legacy-system spec moved to its own file at data/legacy/<slug>.json. The world references them directly via {ref}. This file remains as a documentation breadcrumb for anyone grepping for `legacy_systems`; the audit tool and test runner now scan data/legacy/*.json directly. To add a new hosted legacy mount: drop a new <name>.json under data/legacy/, then add `{ref: \"legacy/<name>\"}` to data/worlds/default.json children." },
  ],
  children: [],
};
writeFileSync(SRC, JSON.stringify(stub, null, 2) + "\n", "utf8");
console.log(`[split] truncated ${SRC} to empty stub.`);
console.log(`[split] add these refs to data/worlds/default.json children:`);
for (const r of writtenRefs) console.log(`  { "ref": "${r}" },`);
