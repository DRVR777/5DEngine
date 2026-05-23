/**
 * src/ankhor/boot.js — the only wiring module index.html needs.
 *
 * Assembles: ThingRegistry (one Thinga store) + facet handlers + mesh factories
 * + Three.js renderer + tick loop. Spawns initial Things from data/spawns/.
 *
 * Game content arrives as:
 *   - JSON kind definitions in data/kinds/ (registered via MANIFEST)
 *   - JSON tuning Things in data/tuning/ (loaded via MANIFEST)
 *   - JSON spawns in data/spawns/ (instances created on boot)
 *   - facet handlers in experimental/holograph-runtime/src/handlers.js
 *   - mesh factories in src/ankhor/mesh_factories.js
 *
 * Specs: docs/codex/specs/{registry-runtime,facet-catalog,migration-sequence}.md
 * Migration progress: docs/codex/MIGRATION_PROGRESS.md
 */

import * as THREE                                   from "three";
import { createDefaultRegistry }                    from "registry";
import { installDefaultHandlers }                   from "handlers";
import { MESH_FACTORIES }                           from "./mesh_factories.js";
import { installMeshHandler }                       from "./install_mesh_handler.js";

export async function boot({
  canvas,
  kindsDir   = "./data/kinds/",
  tuningDir  = "./data/tuning/",
  spawnsDir  = "./data/spawns/",
  onReady,
} = {}) {
  // ── Registry: starts with every Kind in the enum already registered.
  const registry = createDefaultRegistry();
  installDefaultHandlers(registry);

  // ── Render surface ───────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);
  scene.fog        = new THREE.FogExp2(0x0b0d12, 0.018);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(5, 10, 5); scene.add(sun);

  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  cam.position.set(0, 14, 28); cam.lookAt(0, 0, 0);

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  });

  scene.add(new THREE.GridHelper(60, 60, 0x223344, 0x131820));

  // ── Install render-class facet handler (closes over THREE+scene+factories) ──
  installMeshHandler(registry, { THREE, scene, factories: MESH_FACTORIES });

  // ── Load kind catalog (definitions: required/optional facets, defaults) ──
  const kindsLoaded = await loadJsonCatalog(kindsDir, async (def) => {
    try {
      registry.registerKind(def.kind, {
        requiredFacets: def.required_facets || [],
        optionalFacets: def.optional_facets || [],
        defaults:       def.defaults        || {},
        absorbs:        def.absorbs         || [],
      });
      return def.kind;
    } catch (e) {
      console.warn(`[ankhor] registerKind("${def.kind}"):`, e.message);
      return null;
    }
  });

  // ── Load tuning Things (magic numbers with provenance) before spawns,
  //    so factories can pick them up. ──
  const tuningLoaded = await loadJsonCatalog(tuningDir, async (thing) => {
    try { registry.spawn(thing); return thing.id; }
    catch (e) { console.warn(`[ankhor] spawn tuning ${thing?.id}:`, e.message); return null; }
  });

  // ── Spawn the default world (initial Thing instances). ──
  const spawned = await loadSpawnSets(spawnsDir, (thingDef) => {
    try { registry.spawn(thingDef); return thingDef.id; }
    catch (e) { console.warn(`[ankhor] spawn ${thingDef?.id}:`, e.message); return null; }
  });

  // ── One loop. tick(dt) walks every registered facet handler in priority order.
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    registry.tick(dt);
    // Slow camera orbit for substrate aliveness check (no game content yet).
    const t = now * 0.00008;
    cam.position.x = Math.sin(t) * 28;
    cam.position.z = Math.cos(t) * 28;
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (onReady) onReady({
    registry,
    stats: {
      live:         registry.toJSON().filter(t => !t.deleted_at).length,
      kindsLoaded:  kindsLoaded.filter(Boolean).length,
      tuningLoaded: tuningLoaded.filter(Boolean).length,
      spawned:      spawned.filter(Boolean).length,
      handlers:     registry.handlerRegistry.size,
    }
  });
  return registry;
}

// ── Catalog loader: fetch dir/MANIFEST.json then process each listed file ──
async function loadJsonCatalog(dir, onItem) {
  const results = [];
  let manifest;
  try {
    const r = await fetch(`${dir}MANIFEST.json`);
    if (!r.ok) { console.warn(`[ankhor] no MANIFEST at ${dir}`); return results; }
    manifest = await r.json();
  } catch (e) { console.warn(`[ankhor] manifest fetch ${dir}:`, e); return results; }

  await Promise.all((manifest.files || []).map(async (name) => {
    try {
      const f = await fetch(`${dir}${name}`);
      if (!f.ok) return;
      const def = await f.json();
      const out = await onItem(def);
      results.push(out);
    } catch (e) { console.warn(`[ankhor] load ${dir}${name}:`, e); }
  }));
  return results;
}

// ── Spawns loader: a spawn file may contain { spawns: [Thing, Thing, ...] } ──
async function loadSpawnSets(dir, onSpawn) {
  const results = [];
  let manifest;
  try {
    const r = await fetch(`${dir}MANIFEST.json`);
    if (!r.ok) { console.warn(`[ankhor] no MANIFEST at ${dir}`); return results; }
    manifest = await r.json();
  } catch (e) { console.warn(`[ankhor] spawns manifest fetch ${dir}:`, e); return results; }

  for (const name of manifest.files || []) {
    try {
      const f = await fetch(`${dir}${name}`);
      if (!f.ok) continue;
      const set = await f.json();
      for (const thingDef of (set.spawns || [])) {
        results.push(onSpawn(thingDef));
      }
    } catch (e) { console.warn(`[ankhor] spawn set ${name}:`, e); }
  }
  return results;
}
