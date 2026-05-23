/**
 * src/ankhor/boot.js — the only wiring module index.html needs.
 *
 * Ankhor architecture: everything is a Thinga. boot starts from a single
 * root Thinga (data/root.json), recursively resolves {ref: '<id>'} children
 * by fetching data/<id>.json, then processes the loaded Thinga graph in
 * three passes:
 *
 *   1. Bootstrap — kind-def Thingas → registry.registerKind() so all kinds
 *      are known before any other Thinga's spawn() is validated.
 *   2. Spawn — every non-spawn-set Thinga is spawned into the registry
 *      (world, tuning, kind-def, root all become first-class registry rows).
 *   3. Materialize — spawn-set Thingas have their children spawned as
 *      actual game Things. world Thingas have their world-params facet
 *      applied to the Three.js scene.
 *
 * Adding a new world / kind / set: write a Thinga JSON file under data/,
 * reference it from a parent Thinga (or directly from root.json). No
 * manifest indirection — the parent IS the manifest.
 *
 * Specs: docs/codex/specs/{registry-runtime,facet-catalog,migration-sequence}.md
 */

import * as THREE                                   from "three";
import { createDefaultRegistry }                    from "registry";
import { installDefaultHandlers }                   from "handlers";
import { MESH_FACTORIES }                           from "./mesh_factories.js";
import { installMeshHandler }                       from "./install_mesh_handler.js";

export async function boot({ canvas, dataDir = "./data/", rootId = "root", onReady } = {}) {
  const registry = createDefaultRegistry();
  installDefaultHandlers(registry);

  // Render surface — scene params are applied once a world Thinga is resolved.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.GridHelper(60, 60, 0x223344, 0x131820));
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  cam.position.set(0, 14, 28); cam.lookAt(0, 0, 0);
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  });
  installMeshHandler(registry, { THREE, scene, factories: MESH_FACTORIES });

  // ── COMPOSE: resolve root + all {ref} children recursively. ─────────────
  const loaded = await composeFromRoot(rootId, dataDir);

  // ── PASS 1: register kinds from kind-def Thingas. ───────────────────────
  for (const t of loaded) {
    if (t.kind !== "kind-def") continue;
    const def = facetMap(t);
    try {
      registry.registerKind(def["for-kind"], {
        requiredFacets: def["required-facets"] || [],
        optionalFacets: def["optional-facets"] || [],
        defaults:       def["defaults"]        || {},
        absorbs:        def["absorbs"]         || [],
      });
    } catch (e) { console.warn(`[ankhor] registerKind("${def["for-kind"]}"):`, e.message); }
  }

  // ── PASS 2: spawn all non-spawn-set Thingas as first-class registry rows. ──
  let world = null;
  const camParams = { orbit: 28, height: 14, speed: 0.00008 };
  for (const t of loaded) {
    if (t.kind === "spawn-set") continue;     // spawn-set children handled below
    try { registry.spawn(t); }
    catch (e) { console.warn(`[ankhor] spawn ${t.id}:`, e.message); }
    if (t.kind === "world") world = t;
  }

  // Apply world-params if a world was loaded.
  if (world) {
    const p = facetMap(world)["world-params"] || {};
    scene.background = new THREE.Color(p.background_color ?? 0x0b0d12);
    scene.fog        = new THREE.FogExp2(p.background_color ?? 0x0b0d12, p.fog_density ?? 0.018);
    scene.add(new THREE.AmbientLight(0xffffff, p.ambient_intensity ?? 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, p.sun_intensity ?? 0.85);
    sun.position.set(5, 10, 5); scene.add(sun);
    camParams.orbit  = p.camera_orbit_radius ?? camParams.orbit;
    camParams.height = p.camera_height       ?? camParams.height;
    camParams.speed  = p.camera_orbit_speed  ?? camParams.speed;
  }

  // ── PASS 3: spawn-set children become actual game Things. ──────────────
  let materialized = 0;
  for (const t of loaded) {
    if (t.kind !== "spawn-set") continue;
    for (const child of t.children || []) {
      try { registry.spawn(child); materialized++; }
      catch (e) { console.warn(`[ankhor] spawn ${child.id}:`, e.message); }
    }
  }

  // ── Tick + render loop. ─────────────────────────────────────────────────
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    registry.tick(dt);
    const t = now * camParams.speed;
    cam.position.set(Math.sin(t) * camParams.orbit, camParams.height, Math.cos(t) * camParams.orbit);
    cam.lookAt(0, 0, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (onReady) onReady({
    registry, world,
    stats: {
      loaded:       loaded.length,
      kindDefs:     loaded.filter(t => t.kind === "kind-def").length,
      tuning:       loaded.filter(t => t.kind === "tuning").length,
      spawnSets:    loaded.filter(t => t.kind === "spawn-set").length,
      materialized,
      handlers:     registry.handlerRegistry.size,
    }
  });
  return registry;
}

// ── Helpers ────────────────────────────────────────────────────────────────

// Recursive ref resolver: load data/<id>.json then recurse into children.
// Returns a flat array of every Thinga reachable from rootId (depth-first).
async function composeFromRoot(rootId, dataDir) {
  const cache = new Map();    // id → Thinga
  const order = [];           // load order

  async function visit(id) {
    if (cache.has(id)) return;
    const thinga = await loadJson(`${dataDir}${id}.json`);
    if (!thinga) { console.warn(`[ankhor] missing Thinga ${id}`); return; }
    cache.set(id, thinga);
    order.push(thinga);
    for (const child of thinga.children || []) {
      if (child && child.ref) await visit(child.ref);
    }
  }

  await visit(rootId);
  return order;
}

// Convert a Thinga's facets[] into a name→data object for ergonomic access.
function facetMap(thinga) {
  const out = {};
  for (const f of thinga.facets || []) out[f.name] = f.data;
  return out;
}

async function loadJson(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch (e) { console.warn(`[ankhor] fetch ${url}:`, e); return null; }
}
