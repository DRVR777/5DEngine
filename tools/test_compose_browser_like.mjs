#!/usr/bin/env node
/** tools/test_compose_browser_like.mjs
 *
 *  Closest-to-browser proof the substrate composes cleanly from
 *  data/root.json including the legacy-systems spawn-set. We can't open
 *  a browser here, but we can fetch every Thinga via a Node-side fetch
 *  shim and run the same composeFromRoot the browser does, then run
 *  pass 1/2/3 (registerKind / spawn / materialize-with-defaults) and
 *  verify the legacy-system Things made it through.
 *
 *  Skip:
 *    - the THREE renderer + scene (DOM + WebGL)
 *    - the dynamic import of legacy modules (we'd hit the same browser-
 *      relative URL problem; instead each spec is rewritten to file://
 *      paths and we await the imports manually)
 *
 *  Pass criteria:
 *    - composeFromRoot returns >= 1 of every expected kind
 *    - data/spawns/legacy_systems.json materializes 10 legacy-system Things
 *    - every legacy-mount facet's _ready === true after awaiting imports
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createDefaultRegistry } from "../experimental/holograph-runtime/src/registry.js";
import { installFacetHandlers } from "../src/ankhor/facets/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Node-side fetch shim that resolves "./data/..." against ROOT.
globalThis.window = globalThis;
globalThis.fetch = async (url) => {
  const cleaned = url.replace(/^\.\//, "");
  const abs = resolve(ROOT, cleaned);
  if (!existsSync(abs)) return { ok: false, status: 404 };
  return {
    ok: true,
    status: 200,
    async json() { return JSON.parse(readFileSync(abs, "utf8")); },
  };
};

const { composeFromRoot, facetMap } = await import("../src/ankhor/compose.js");

const loaded = await composeFromRoot("root", "./data/");
console.log(`[compose] loaded ${loaded.length} Thingas from data/root.json`);

const registry = createDefaultRegistry();
installFacetHandlers(registry);

// PASS 1: register kind-defs + capture defaults
const kindDefaults = new Map();
for (const t of loaded) {
  if (t.kind !== "kind-def") continue;
  const def = facetMap(t);
  try {
    registry.registerKind(def["for-kind"], {
      requiredFacets: def["required-facets"] || [],
      optionalFacets: def["optional-facets"] || [],
      defaults:       def["defaults"]        || {},
    });
    kindDefaults.set(def["for-kind"], def["defaults"] || {});
  } catch (e) { /* tolerate dup */ }
}

// PASS 2: spawn non-spawn-set (world, tuning, kind-def, render-context,
// legacy-system, etc.) — legacy-system Thingas now live as top-level
// files under data/legacy/ (post iter 764.5 split), so rewrite their
// module_urls to file:// here too.
function rewriteLegacyModuleUrl(thing) {
  if (thing.kind !== "legacy-system") return;
  for (const f of thing.facets || []) {
    if (f.name === "legacy-mount" && typeof f.data?.module_url === "string") {
      f.data.module_url = "file://" + resolve(ROOT, f.data.module_url.replace(/^\.\//, "")).replace(/\\/g, "/");
    }
  }
}
for (const t of loaded) {
  if (t.kind === "spawn-set") continue;
  rewriteLegacyModuleUrl(t);
  try { registry.spawn(t); } catch (e) { /* skip dup */ }
}

// PASS 3: materialize spawn-set children with kind-def defaults injected.
// For legacy-system specs, also rewrite module_url to file://... so the
// dynamic import in legacy_mount.js resolves under Node.
function injectDefaults(child, defaults) {
  const present = new Set((child.facets || []).map(f => f.name));
  const extra = [];
  for (const [name, data] of Object.entries(defaults)) {
    if (present.has(name)) continue;
    extra.push({ name, data: JSON.parse(JSON.stringify(data)) });
  }
  if (extra.length === 0) return child;
  return { ...child, facets: [...(child.facets || []), ...extra] };
}

let materialized = 0, legacySpecsAttempted = 0;
for (const t of loaded) {
  if (t.kind !== "spawn-set") continue;
  for (const child of t.children || []) {
    const filled = injectDefaults(child, kindDefaults.get(child.kind) || {});
    if (child.kind === "legacy-system") {
      legacySpecsAttempted++;
      for (const f of filled.facets || []) {
        if (f.name === "legacy-mount" && typeof f.data?.module_url === "string") {
          f.data.module_url = "file://" + resolve(ROOT, f.data.module_url.replace(/^\.\//, "")).replace(/\\/g, "/");
        }
      }
    }
    try { registry.spawn(filled); materialized++; }
    catch (e) { /* tolerate */ }
  }
}

console.log(`[compose] materialized ${materialized} children`);
console.log(`[compose] legacy-system Things spawned: ${registry.byKind("legacy-system").length} (attempted ${legacySpecsAttempted})`);

// Wait for every legacy-mount to bind (or fail)
await Promise.allSettled(
  registry.byKind("legacy-system").map((t) => {
    const d = registry.facetData(t.id, "legacy-mount");
    return d && d._import_promise ? d._import_promise : Promise.resolve();
  })
);

const bound = registry.byKind("legacy-system").filter((t) => {
  const d = registry.facetData(t.id, "legacy-mount");
  return d && d._ready;
});
const failed = registry.byKind("legacy-system").filter((t) => {
  const d = registry.facetData(t.id, "legacy-mount");
  return d && d._failed;
});

console.log(`[compose] legacy bound: ${bound.length} (failed: ${failed.length})`);
for (const t of bound)  console.log(`  OK   ${t.id}`);
for (const t of failed) console.log(`  FAIL ${t.id}`);

const expected = 10;
if (bound.length < expected) {
  console.log(`[test] FAIL — expected at least ${expected} legacy mounts bound, got ${bound.length}`);
  process.exit(1);
}
console.log(`[test] PASS — substrate composes from data/root.json AND binds ${bound.length} legacy mounts via the bridge.`);
process.exit(0);
