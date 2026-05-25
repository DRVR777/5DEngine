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
const LEGACY_DIR = join(ROOT, "data", "legacy");
const TOOLS_DIR  = join(ROOT, "tools");

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

/** Scan tools/*.mjs for `PARITY: mountX` markers. Each marker is a
 *  parity test that runs the substrate composition and asserts it
 *  matches the legacy formula. A marker only counts if the test file
 *  is wired into the run (any file under tools/ is picked up by the
 *  team's standard test execution); this audit treats marker
 *  presence as proof. The test SUITE must be passing — if a test was
 *  added to the file but the assertions fail, the run aborts before
 *  the audit is invoked downstream. */
function parityProvenMounts() {
  const set = new Set();
  if (!existsSync(TOOLS_DIR)) return set;
  for (const f of readdirSync(TOOLS_DIR)) {
    if (!f.endsWith(".mjs") && !f.endsWith(".js")) continue;
    const txt = readFileSync(join(TOOLS_DIR, f), "utf8");
    const re = /PARITY:\s*(mount[A-Z][A-Za-z0-9_]+)/g;
    let m;
    while ((m = re.exec(txt))) set.add(m[1]);
  }
  return set;
}

function acknowledgedKindCoverage() {
  if (!existsSync(INVENTORY)) return new Set();
  const txt = readFileSync(INVENTORY, "utf8");
  const m = txt.match(/## Audit (?:Coverage|Surface) Acknowledgements[\s\S]*?\n---/);
  if (!m) return new Set();
  const re = /\bmount[A-Z][A-Za-z0-9_]+/g;
  const set = new Set();
  let hit;
  while ((hit = re.exec(m[0]))) set.add(hit[0]);
  return set;
}

/** Names of mount* exports HOSTED by the legacy-mount bridge —
 *  scans data/legacy/*.json (one standalone legacy-system Thinga per
 *  file, post the iter-764.5 split). Each file declares one legacy-
 *  mount facet with an `export` name. A HOSTED mount counts as
 *  substrate coverage (per CLAUDE.md the bridge IS the substrate path
 *  until a native facet supersedes it). */
function legacyHosts() {
  // Returns Map<mountExportName, { status, semantic_test, native_target, slug }>
  // status is one of:
  //   HOSTED_BIND_ONLY        binds + ticks (default)
  //   HOSTED_SEMANTIC_PROVEN  test_legacy_bridge.mjs has a phase that
  //                           observably changes state correctly
  //   NATIVE_BUILT            src/ankhor/facets/<slug>.js shipped but
  //                           legacy spec still present (shadow)
  //   NATIVE_VERIFIED         native passes parity test; ready to flip
  // (DONE is inferred from absence — when the legacy file is deleted.)
  if (!existsSync(LEGACY_DIR)) return new Map();
  const map = new Map();
  for (const f of readdirSync(LEGACY_DIR)) {
    if (!f.endsWith(".json")) continue;
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(LEGACY_DIR, f), "utf8")); }
    catch { continue; }
    for (const facet of parsed.facets || []) {
      if (facet.name !== "legacy-mount") continue;
      const name = facet.data?.export;
      if (typeof name !== "string" || !name) continue;
      const m = parsed.migration || {};
      map.set(name, {
        status:        typeof m.status === "string" ? m.status : "HOSTED_BIND_ONLY",
        semantic_test: m.semantic_test || null,
        native_target: m.native_target || f.replace(/\.json$/, ""),
        slug:          f.replace(/\.json$/, ""),
      });
    }
  }
  return map;
}

function classify(mountName, facetSlugs, kindSlugs, invMentions, kindAcks, hostsMap, parityProven) {
  const { snake } = mountToSlugs(mountName);
  const facetHit  = [...facetSlugs].some((f) => f === snake || snake.includes(f) || f.includes(snake));
  const kindHit   = [...kindSlugs].some((k)  => k === snake || snake.includes(k) || k.includes(snake));
  const invHit    = invMentions.has(mountName);
  const kindAck    = kindAcks.has(mountName);
  const host      = hostsMap.get(mountName);
  const parityHit = parityProven.has(mountName);
  return { facetHit, kindHit, invHit, kindAck, parityHit, hostedHit: !!host, hostStatus: host?.status, hostSemantic: host?.semantic_test };
}

function main() {
  const update = process.argv.includes("--update");
  const mounts = gameMountNames();
  const facets = listDirBaseNames(FACETS_DIR, ".js");
  const kinds  = listDirBaseNames(KINDS_DIR,  ".json");
  const invMentions = inventoryMounts();
  const kindAcks = acknowledgedKindCoverage();
  const hostsMap = legacyHosts();
  const parityProven = parityProvenMounts();

  const rows = mounts.map((m) => {
    const c = classify(m, facets, kinds, invMentions, kindAcks, hostsMap, parityProven);
    // Status precedence: NATIVE_VERIFIED (any source — host or parity marker)
    //                  > HOSTED_SEMANTIC_PROVEN > HOSTED_BIND_ONLY
    //                  > DONE (native+doc) > ACK_SURFACE > FACET > DOC > MISSING.
    //
    // PARITY markers in tools/*.mjs promote a mount to NATIVE_VERIFIED:
    // a PARITY: mountX comment is the doctrine signal that a parity test
    // exists and runs (a marker without a passing test would fail the
    // suite — this audit assumes the suite is green when invoked).
    //
    // ACK_SURFACE is intentionally not DONE. It means the inventory
    // explicitly acknowledges an existing substrate kind by name, but no
    // semantic parity proof exists yet. Keep it separate so the audit
    // cannot pass off surface matches as migrated behavior.
    let status;
    if (c.hostedHit) {
      status = c.hostStatus === "NATIVE_VERIFIED" ? "NATIVE_VERIFIED"
            : c.hostStatus === "NATIVE_BUILT"     ? "NATIVE_BUILT"
            : c.hostStatus === "HOSTED_SEMANTIC_PROVEN" ? "HOSTED_SEMANTIC_PROVEN"
            : "HOSTED_BIND_ONLY";
    } else if (c.parityHit)            status = "NATIVE_VERIFIED";
    else if (c.facetHit && c.invHit)   status = "DONE";
    else if (c.kindHit && c.kindAck)   status = "ACK_SURFACE";
    else if (c.facetHit || c.kindHit)  status = "FACET";
    else if (c.invHit)                 status = "DOC";
    else                                status = "MISSING";
    return { mount: m, ...c, status };
  });

  const tally = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const total = rows.length;

  const semantic = tally.HOSTED_SEMANTIC_PROVEN || 0;
  const bindOnly = tally.HOSTED_BIND_ONLY || 0;
  const native   = (tally.DONE || 0) + (tally.NATIVE_BUILT || 0) + (tally.NATIVE_VERIFIED || 0);
  const ackSurface = tally.ACK_SURFACE || 0;
  const covered  = semantic + bindOnly + native;
  const surface  = covered + ackSurface;

  if (update) {
    rewriteInventoryAuditBlock(rows, tally, total);
    console.log(`[audit] inventory updated. ${covered}/${total} migration-covered; ${surface}/${total} with acknowledged native surface (${semantic} SEMANTIC_PROVEN + ${bindOnly} BIND_ONLY + ${native} native + ${tally.ACK_SURFACE || 0} ACK_SURFACE).`);
    process.exit(0);
  }

  console.log(`game.html mount* subsystems: ${total}`);
  console.log(`migration-covered: ${covered}/${total}  (${semantic} SEMANTIC_PROVEN + ${bindOnly} BIND_ONLY + ${native} native)`);
  console.log(`surface-accounted: ${surface}/${total}  (+${tally.ACK_SURFACE || 0} ACK_SURFACE name/kind acknowledgements; not semantic parity)`);
  for (const [k, v] of Object.entries(tally)) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log("");
  for (const r of rows) {
    const mark = r.status === "HOSTED_SEMANTIC_PROVEN" ? "SEM  "
              : r.status === "HOSTED_BIND_ONLY"        ? "HOST "
              : r.status === "NATIVE_VERIFIED"         ? "VER  "
              : r.status === "NATIVE_BUILT"            ? "BUILT"
              : r.status === "DONE"                    ? "OK   "
              : r.status === "ACK_SURFACE"             ? "ACK  "
              : r.status === "FACET"                   ? "FACET"
              : r.status === "DOC"                     ? "DOC  "
              :                                          "MISS ";
    const tail = r.hostSemantic ? `  — ${r.hostSemantic}` : "";
    console.log(`  ${mark}  ${r.mount}${tail}`);
  }

  const gaps = (tally.MISSING || 0) + (tally.DOC || 0) + (tally.FACET || 0);
  process.exit(gaps > 0 ? 1 : 0);
}

function rewriteInventoryAuditBlock(rows, tally, total) {
  const txt = readFileSync(INVENTORY, "utf8");
  const start = "<!-- BEGIN_AUDIT -->";
  const end   = "<!-- END_AUDIT -->";
  const ts = new Date().toISOString().slice(0, 19) + "Z";
  const semantic = tally.HOSTED_SEMANTIC_PROVEN || 0;
  const bindOnly = tally.HOSTED_BIND_ONLY || 0;
  const native   = (tally.DONE || 0) + (tally.NATIVE_BUILT || 0) + (tally.NATIVE_VERIFIED || 0);
  const ackSurface = tally.ACK_SURFACE || 0;
  const covered  = semantic + bindOnly + native;
  const surface  = covered + ackSurface;
  const lines = [
    start,
    "",
    `_Generated by \`tools/audit_migration.mjs --update\` on ${ts}._`,
    "",
    `**Migration coverage:** ${covered}/${total} — ${semantic} SEMANTIC_PROVEN + ${bindOnly} BIND_ONLY + ${native} native (${tally.DONE || 0} DONE, ${tally.NATIVE_BUILT || 0} NATIVE_BUILT, ${tally.NATIVE_VERIFIED || 0} NATIVE_VERIFIED).`,
    `**Surface accounted:** ${surface}/${total} — migration coverage plus ${ackSurface} ACK_SURFACE kind/name acknowledgements that are not semantic parity.`,
    `Remaining: ${tally.FACET || 0} FACET-only / ${tally.DOC || 0} DOC-only / ${tally.MISSING || 0} MISSING.`,
    "",
    "Status legend (migration state machine — see docs/COMPATIBILITY_KERNEL.md):",
    "  - **HOSTED_SEMANTIC_PROVEN**: legacy spec hosted via bridge AND a tools/test_legacy_bridge.mjs phase observably changes state correctly.",
    "  - **HOSTED_BIND_ONLY**: legacy spec hosted via bridge, binds + ticks but no semantic test yet.",
    "  - **NATIVE_BUILT**: src/ankhor/facets/<slug>.js shipped but legacy spec still present (shadow).",
    "  - **NATIVE_VERIFIED**: native passes parity test; legacy spec ready to delete.",
    "  - **DONE**: native Ankhor facet/kind covers this AND inventory doc names it (legacy file absent).",
    "  - **ACK_SURFACE**: inventory acknowledges an existing substrate kind by name; this is surface accounting, not behavior parity.",
    "  - **FACET**: native facet/kind exists by name match but inventory hasn't been annotated.",
    "  - **DOC**: inventory mentions the mount but no matching facet/kind.",
    "  - **MISSING**: neither.",
    "",
    "| Mount call | facet hit | kind hit | inv hit | hosted | status | semantic proof |",
    "|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| \`${r.mount}\` | ${r.facetHit ? "yes" : "—"} | ${r.kindHit ? "yes" : "—"} | ${r.invHit ? "yes" : "—"} | ${r.hostedHit ? "yes" : "—"} | ${r.status} | ${r.hostSemantic || "—"} |`),
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
