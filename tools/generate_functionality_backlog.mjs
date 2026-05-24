#!/usr/bin/env node
/** Generate the migration backlog directly from game.html mount* calls.
 *
 * Outputs:
 *   docs/codex/GAME_HTML_FUNCTIONALITY_BACKLOG.md
 *   docs/codex/ONE_SHOT_MIGRATION_PROMPT.md
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME = join(ROOT, "game.html");
const FACETS_DIR = join(ROOT, "src", "ankhor", "facets");
const KINDS_DIR = join(ROOT, "data", "kinds");
const LEGACY_DIR = join(ROOT, "data", "legacy");
const MOUNT_CALLS_DIR = join(ROOT, "docs", "codex", "legacy", "mount_calls");
const OUT = join(ROOT, "docs", "codex", "GAME_HTML_FUNCTIONALITY_BACKLOG.md");
const PROMPT_OUT = join(ROOT, "docs", "codex", "ONE_SHOT_MIGRATION_PROMPT.md");

function mountToSlugs(mountName) {
  const stripped = mountName.replace(/^mount/, "")
    .replace(/(Tick|System|Spawner|Wiring|Init|Sound|Sprite)$/u, "");
  const kebab = stripped.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return { kebab, snake: kebab.replace(/-/g, "_") };
}

function listDirBaseNames(dir, suffix) {
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir)
    .filter((f) => f.endsWith(suffix) && !f.startsWith("MANIFEST"))
    .map((f) => f.slice(0, -suffix.length)));
}

function gameMountNames() {
  const src = readFileSync(GAME, "utf8");
  const re = /\bmount[A-Z][A-Za-z0-9_]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(src))) set.add(m[0]);
  return [...set].sort();
}

function legacyHosts() {
  const map = new Map();
  if (!existsSync(LEGACY_DIR)) return map;
  for (const f of readdirSync(LEGACY_DIR)) {
    if (!f.endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(join(LEGACY_DIR, f), "utf8"));
    for (const facet of parsed.facets || []) {
      if (facet.name !== "legacy-mount") continue;
      const name = facet.data?.export;
      if (typeof name !== "string") continue;
      map.set(name, {
        file: `data/legacy/${f}`,
        status: parsed.migration?.status || "HOSTED_BIND_ONLY",
        semantic_test: parsed.migration?.semantic_test || "",
        native_target: parsed.migration?.native_target || f.replace(/\.json$/, ""),
      });
    }
  }
  return map;
}

function mountSummary(mountName) {
  const path = join(MOUNT_CALLS_DIR, `${mountName}.js`);
  if (!existsSync(path)) return "No cloned mount file found; inspect game.html directly.";
  const src = readFileSync(path, "utf8").split(/\r?\n/);
  const body = src.filter((line) => line.trim() && !line.trim().startsWith("//")).slice(0, 12);
  return body.join(" ").replace(/\s+/g, " ").slice(0, 360);
}

function classify(mount, facets, kinds, hosts) {
  const { snake, kebab } = mountToSlugs(mount);
  const facetHit = [...facets].some((f) => f === snake || snake.includes(f) || f.includes(snake));
  const kindHit = [...kinds].some((k) => k === snake || k === kebab || snake.includes(k) || k.includes(snake));
  const host = hosts.get(mount);
  let status;
  if (host) status = host.status;
  else if (facetHit) status = "DONE";
  else if (kindHit) status = "FACET_OR_KIND";
  else status = "UNHOSTED";
  return { status, facetHit, kindHit, host, snake, kebab };
}

function actionFor(row) {
  if (row.status === "DONE") return "Keep as native; only add stronger parity tests if behavior is suspect.";
  if (row.status === "NATIVE_VERIFIED") return "Delete legacy JSON and world ref after bridge/native tests pass.";
  if (row.status === "HOSTED_SEMANTIC_PROVEN") return "Build native facet, add native parity test, then flip authority.";
  if (row.status === "HOSTED_BIND_ONLY") return "Add a semantic bridge test first; then build native if the behavior is small.";
  if (row.status === "FACET_OR_KIND") return "Verify whether existing facet/kind is complete; add parity test or mark gaps explicitly.";
  return "Create data/legacy spec or native facet from cloned mount source; add semantic proof.";
}

const facets = listDirBaseNames(FACETS_DIR, ".js");
const kinds = listDirBaseNames(KINDS_DIR, ".json");
const hosts = legacyHosts();
const rows = gameMountNames().map((mount) => {
  const cls = classify(mount, facets, kinds, hosts);
  return { mount, ...cls, summary: mountSummary(mount), action: actionFor(cls) };
});

const tally = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] || 0) + 1;
  return acc;
}, {});

const covered = (tally.DONE || 0)
  + (tally.NATIVE_VERIFIED || 0)
  + (tally.HOSTED_SEMANTIC_PROVEN || 0)
  + (tally.HOSTED_BIND_ONLY || 0);

const stamp = new Date().toISOString();
const lines = [
  "# game.html Functionality Migration Backlog",
  "",
  `Generated: ${stamp}`,
  "",
  "This is the source-of-truth backlog for moving behavior out of `game.html`.",
  "It is generated from live repo state, not hand-maintained impressions.",
  "",
  `Total game.html mount* subsystems: ${rows.length}`,
  `Coverage counted by current audit semantics: ${covered}/${rows.length}`,
  "",
  "Important: `data/legacy/*.json` only counts bridge-hosted specs. It is not the full backlog.",
  "",
  "## Tally",
  "",
  ...Object.entries(tally).sort().map(([k, v]) => `- ${k}: ${v}`),
  "",
  "## Full Mount Backlog",
  "",
  "| Mount | Status | Native target | Current bridge file | Required next action | Functionality summary |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => `| \`${r.mount}\` | ${r.status} | \`${r.host?.native_target || r.kebab}\` | ${r.host ? `\`${r.host.file}\`` : ""} | ${r.action} | ${r.summary.replace(/\|/g, "\\|")} |`),
  "",
];
writeFileSync(OUT, lines.join("\n"), "utf8");

const priority = rows.filter((r) => r.status !== "DONE").slice(0, 40);
const prompt = [
  "# One-Shot Migration Prompt",
  "",
  `Generated: ${stamp}`,
  "",
  "You are continuing the 5DEngine migration. Do not use `data/legacy` file count as success.",
  "Success is increasing true `game.html` mount coverage and preserving behavior.",
  "",
  "Read first:",
  "- `CLAUDE.md`",
  "- `docs/codex/GAME_HTML_FUNCTIONALITY_BACKLOG.md`",
  "- `tools/audit_migration.mjs`",
  "- `tools/test_legacy_bridge.mjs`",
  "",
  "Execution rules:",
  "1. Pick the next highest-leverage non-DONE mount from the backlog.",
  "2. If it is `HOSTED_BIND_ONLY`, add a deterministic semantic bridge test first and update its `migration.status` to `HOSTED_SEMANTIC_PROVEN`.",
  "3. If it is `HOSTED_SEMANTIC_PROVEN`, build the native Ankhor facet/kind, move constants into tuning, wire it into kind/spawn data, add a native parity phase, and mark `NATIVE_VERIFIED`.",
  "4. Only after native parity passes, delete the legacy JSON and remove its world ref in a separate commit.",
  "5. After the batch, run `node tools/test_legacy_bridge.mjs`, `node tools/test_boot_full.mjs`, and `node tools/audit_migration.mjs`.",
  "6. Regenerate this backlog and prompt with `node tools/generate_functionality_backlog.mjs`.",
  "",
  "Current top non-DONE rows:",
  "",
  ...priority.map((r, i) => `${i + 1}. ${r.mount} [${r.status}] -> ${r.action}`),
  "",
];
writeFileSync(PROMPT_OUT, prompt.join("\n"), "utf8");

console.log(`[backlog] wrote ${OUT}`);
console.log(`[backlog] wrote ${PROMPT_OUT}`);
console.log(`[backlog] ${covered}/${rows.length} covered by audit semantics`);
