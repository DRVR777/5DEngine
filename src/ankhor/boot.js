/** src/ankhor/boot.js — assembles the Ankhor substrate from a single root Thinga.
 *  Recursively walks {ref} children, then registers kinds, spawns Thingas, and
 *  materializes spawn-set children with kind-def defaults auto-injected. */
import * as THREE                from "three";
import { createDefaultRegistry } from "registry";
import { MESH_FACTORIES }        from "./factories/index.js";
import { installFacetHandlers }  from "./facets/index.js";
import { installMeshHandler }    from "./install_mesh_handler.js";
import { composeFromRoot, facetMap } from "./compose.js";
import { applyWorldParams }      from "./world_params.js";

export async function boot({ canvas, dataDir = "./data/", rootId = "root", onReady } = {}) {
  const registry = createDefaultRegistry();
  installFacetHandlers(registry);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.GridHelper(60, 60, 0x223344, 0x131820));
  const cam = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1000);
  cam.position.set(0, 14, 28); cam.lookAt(0, 0, 0);
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  });
  installMeshHandler(registry, { THREE, scene, factories: MESH_FACTORIES });

  const loaded = await composeFromRoot(rootId, dataDir);

  // PASS 1: kind-def Thingas → registry.registerKind
  const kindDefaults = new Map();          // kind name → defaults map
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
    } catch (e) { console.warn(`[ankhor] registerKind("${def["for-kind"]}"):`, e.message); }
  }

  // PASS 2: spawn non-spawn-set Thingas. Capture the world Thinga.
  let world = null;
  for (const t of loaded) {
    if (t.kind === "spawn-set") continue;
    try { registry.spawn(t); } catch (e) { console.warn(`[ankhor] spawn ${t.id}:`, e.message); }
    if (t.kind === "world") world = t;
  }
  const camParams = applyWorldParams(THREE, scene, world ? facetMap(world)["world-params"] : null);

  // PASS 3: spawn-set children become game Things. Inject kind-def defaults
  // for any optional facets that the instance omitted (the feel-preserving
  // compactness contract — instances only declare their unique fields).
  let materialized = 0;
  for (const t of loaded) {
    if (t.kind !== "spawn-set") continue;
    for (const child of t.children || []) {
      const filled = injectDefaults(child, kindDefaults.get(child.kind) || {});
      try { registry.spawn(filled); materialized++; }
      catch (e) { console.warn(`[ankhor] spawn ${child.id}:`, e.message); }
    }
  }

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

  if (onReady) onReady({ registry, world, stats: {
    loaded:    loaded.length,
    kindDefs:  loaded.filter(t => t.kind === "kind-def").length,
    tuning:    loaded.filter(t => t.kind === "tuning").length,
    spawnSets: loaded.filter(t => t.kind === "spawn-set").length,
    materialized,
    handlers:  registry.handlerRegistry.size,
  }});
  return registry;
}

/** Merge defaults into a spawn instance. The instance's facets win; defaults
 *  fill in any facet the instance didn't declare. Defaults are deep-copied so
 *  shared default objects don't get mutated by the registry. */
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
