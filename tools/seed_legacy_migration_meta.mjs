#!/usr/bin/env node
/** tools/seed_legacy_migration_meta.mjs
 *
 *  One-shot. Adds a `migration` metadata block to every
 *  data/legacy/<slug>.json file that doesn't already have one.
 *
 *  Schema:
 *    {
 *      "migration": {
 *        "legacy_mount":   "<mountX export name>",     // from facets[].data.export
 *        "status":         "HOSTED_BIND_ONLY",          // default — bumped by hand once a semantic test exists
 *        "semantic_test":  null,                        // human-readable description; null when bind-only
 *        "native_target":  "<slug>"                     // filename slug, also the eventual native facet name
 *      }
 *    }
 *
 *  Status enum:
 *    HOSTED_BIND_ONLY        — binds + ticks without error
 *    HOSTED_SEMANTIC_PROVEN  — test_legacy_bridge.mjs has a phase
 *                              that observably changes state correctly
 *    NATIVE_BUILT            — a src/ankhor/facets/<slug>.js shipped
 *                              but legacy spec still present (shadow)
 *    NATIVE_VERIFIED         — native passes parity test; ready to flip
 *    (DONE = legacy file deleted; audit infers NATIVE from absence)
 *
 *  Idempotent: re-running won't overwrite existing migration blocks.
 *  Pass --force to overwrite. */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR  = join(ROOT, "data", "legacy");
const force = process.argv.includes("--force");

let added = 0, skipped = 0;
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".json")) continue;
  const abs = join(DIR, f);
  const t = JSON.parse(readFileSync(abs, "utf8"));
  if (t.migration && !force) { skipped++; continue; }
  const lm = (t.facets || []).find((x) => x.name === "legacy-mount")?.data;
  const exp = lm?.export || "?";
  const slug = f.replace(/\.json$/, "");
  t.migration = {
    legacy_mount:  exp,
    status:        "HOSTED_BIND_ONLY",
    semantic_test: null,
    native_target: slug,
  };
  writeFileSync(abs, JSON.stringify(t, null, 2) + "\n", "utf8");
  added++;
}
console.log(`[seed] added migration block to ${added} files (skipped ${skipped} already-tagged).`);
