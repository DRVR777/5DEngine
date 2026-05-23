#!/usr/bin/env node
/** tools/audit_migration.mjs
 *
 *  Mechanical migration auditor. Greps the legacy game.html for
 *  every mount* call (one per game subsystem in the legacy
 *  modular pattern), cross-references against:
 *
 *    - substrate facets   (src/ankhor/facets/<name>.js)
 *    - substrate kinds    (data/kinds/<id>.json)
 *    - the inventory doc  (docs/codex/GAME_HTML_INVENTORY.md)
 *
 *  and produces a status report showing which subsystems have a
 *  substrate equivalent and which are still pending.
 *
 *  Usage:
 *    node tools/audit_migration.mjs
 *    node tools/audit_migration.mjs --update   # rewrite inventory MOUNT_TABLE
 *
 *  Exit code:
 *    0 if --update succeeded OR if every mount* call has at least
 *      one substrate hit AND a corresponding inventory row.
 *    1 if there are gaps and --update wasn't passed.
 *
 *  The auditor is intentionally simple: NAME-MATCH + DOC-MATCH. It
 *  does NOT verify semantic equivalence — only that a substrate
 *  presence exists for each legacy subsystem. Per CLAUDE.md the
 *  migration loop's shadow-run / authority-flip steps are the
 *  semantic check; this tool is the COVERAGE check. */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME = join(ROOT, "game.html");
const FACETS_DIR = join(ROOT, "src", "ankhor", "facets");
const KINDS_DIR  = join(ROOT, "data", "kinds");
const INVENTORY  = join(ROOT, "docs", "codex", "GAME_HTML_INVENTORY.md");
const LEGACY_SPAWNS = join(ROOT, "data", "spawns", "legacy_systems.json");

/** Heuristic: a mount* name maps to a likely facet or kind name. */
function mountToSlugs(mountName) {
  // strip "mount" + the trailing "Tick" / "System" / "Spawner" etc.
  const stripped = mountName.replace(/^mount/, "")
                            .replace(/(Tick|System|Spawner|Wiring|Init|Sound|Sprite)$/u, "");
  // CamelCase → kebab-case
  const kebab = stripped.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
                        .toLowerCase();
  // also snake_case for file matching
  const snake = kebab.replace(/-/g, "_");
  return { kebab, snake };
}

function listDirBaseNames(dir, suffix) {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(suffix) && !f.startsWith("MANIFEST"))
      .map((f) => f.slice(0, -suffix.length))
  );
}

function gameMountNames() {
  const src = readFileSync(GAME, "utf8");
  const re  = /\bmount[A-Z][A-Za-z0-9_]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(src))) set.add(m[0]);
  return [...set].sort();
}

function inventoryMounts() {
  if (!existsSync(INVENTORY)) return new Set();
  const txt = readFileSync(INVENTORY, "utf8");
  const re  = /\bmount[A-Z][A-Za-z0-9_]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(txt))) set.add(m[0]);
  return set;
}

/** Names of mount* exports HOSTED by the legacy-mount bridge —
 *  read from data/spawns/legacy_systems.json's children. Each child's
 *  legacy-mount facet declares the `export` name of the mount it hosts.
 *  A HOSTED mount counts as substrate coverage (per CLAUDE.md the
 *  bridge IS the substrate path until a native facet supersedes it). */
function legacyHosts() {
  if (!existsSync(LEGACY_SPAWNS)) return new Set();
  let parsed;
  try { parsed = JSON.parse(readFileSync(LEGACY_SPAWNS, "utf8")); }
  catch { return new Set(); }
  const set = new Set();
  for (const child of parsed.children || []) {
    for (const facet of child.facets || []) {
      if (facet.name !== "legacy-mount") continue;
      const name = facet.data?.export;
      if (typeof name === "string" && name) set.add(name);
    }
  }
  return set;
}

function classify(mountName, facetSlugs, kindSlugs, invMentions, hosts) {
  const { snake } = mountToSlugs(mountName);
  const facetHit  = [...facetSlugs].some((f) => f === snake || snake.includes(f) || f.includes(snake));
  const kindHit   = [...kindSlugs].some((k)  => k === snake || snake.includes(k) || k.includes(snake));
  const invHit    = invMentions.has(mountName);
  const hostedHit = hosts.has(mountName);
  return { facetHit, kindHit, invHit, hostedHit };
}

function main() {
  const update = process.argv.includes("--update");
  const mounts = gameMountNames();
  const facets = listDirBaseNames(FACETS_DIR, ".js");
  const kinds  = listDirBaseNames(KINDS_DIR,  ".json");
  const invMentions = inventoryMounts();
  const hosts  = legacyHosts();

  const rows = mounts.map((m) => {
    const c = classify(m, facets, kinds, invMentions, hosts);
    let status;
    if (c.hostedHit) status = "HOSTED";
    else if (c.facetHit && c.invHit) status = "DONE";
    else if (c.facetHit || c.kindHit) status = "FACET";
    else if (c.invHit) status = "DOC";
    else status = "MISSING";
    return { mount: m, ...c, status };
  });

  const tally = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const total = rows.length;

  const covered = (tally.HOSTED || 0) + (tally.DONE || 0);

  if (update) {
    rewriteInventoryAuditBlock(rows, tally, total);
    console.log(`[audit] inventory updated. ${covered}/${total} subsystems covered (${tally.HOSTED || 0} HOSTED + ${tally.DONE || 0} DONE).`);
    process.exit(0);
  }

  console.log(`game.html mount* subsystems: ${total}`);
  console.log(`covered (HOSTED + DONE): ${covered}/${total}`);
  for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(8)} ${v}`);
  console.log("");
  for (const r of rows) {
    const mark = r.status === "HOSTED" ? "HOST " : r.status === "DONE" ? "OK   " : r.status === "FACET" ? "FACET" : r.status === "DOC" ? "DOC  " : "MISS ";
    console.log(`  ${mark}  ${r.mount}`);
  }

  const gaps = (tally.MISSING || 0) + (tally.DOC || 0) + (tally.FACET || 0);
  process.exit(gaps > 0 ? 1 : 0);
}

function rewriteInventoryAuditBlock(rows, tally, total) {
  const txt = readFileSync(INVENTORY, "utf8");
  const start = "<!-- BEGIN_AUDIT -->";
  const end   = "<!-- END_AUDIT -->";
  const ts = new Date().toISOString().slice(0, 19) + "Z";
  const covered = (tally.HOSTED || 0) + (tally.DONE || 0);
  const lines = [
    start,
    "",
    `_Generated by \`tools/audit_migration.mjs --update\` on ${ts}._`,
    "",
    `**Coverage:** ${covered}/${total} (${tally.HOSTED || 0} HOSTED via legacy-mount bridge + ${tally.DONE || 0} DONE via native facets).`,
    `Remaining: ${tally.FACET || 0} FACET-only / ${tally.DOC || 0} DOC-only / ${tally.MISSING || 0} MISSING.`,
    "",
    "Status legend:",
    "  - **HOSTED**: legacy module bound via `legacy-mount` bridge — `data/spawns/legacy_systems.json` carries a spec for it.",
    "  - **DONE**: native Ankhor facet/kind covers this AND the inventory doc names it.",
    "  - **FACET**: native facet/kind exists by name match but inventory hasn't been annotated.",
    "  - **DOC**: inventory mentions the mount but no matching facet/kind.",
    "  - **MISSING**: neither.",
    "",
    "| Mount call | facet hit | kind hit | inv hit | hosted | status |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| \`${r.mount}\` | ${r.facetHit ? "yes" : "—"} | ${r.kindHit ? "yes" : "—"} | ${r.invHit ? "yes" : "—"} | ${r.hostedHit ? "yes" : "—"} | ${r.status} |`),
    "",
    end,
  ];
  const block = lines.join("\n");
  const hasMarkers = txt.includes(start) && txt.includes(end);
  let next;
  if (hasMarkers) {
    next = txt.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  } else {
    next = txt.trimEnd() + "\n\n" + block + "\n";
  }
  writeFileSync(INVENTORY, next, "utf8");
}

main();
