/** boot.js — assembles the Ankhor substrate from a single root Thinga.
 *  Loads root, walks {ref} children recursively, runs three passes:
 *  registerKind from kind-defs, spawn other Thingas, materialize spawn-set
 *  children with kind-def defaults injected. All numeric params come from
 *  Thingas (root.boot-params, world.world-params, tuning.*). No `??` here. */
import * as THREE                from "three";
import { createDefaultRegistry } from "registry";
import { installFacetHandlers }  from "./facets/index.js";
import { installMeshHandler }    from "./install_mesh_handler.js";
import { composeFromRoot, facetMap } from "./compose.js";
import { applyWorldParams }      from "./world_params.js";
import { requireParam as need }  from "./require_param.js";

const B = "boot-params";

export async function boot({ canvas, dataDir = "./data/", rootId = "root", onReady } = {}) {
  const registry = createDefaultRegistry();
  installFacetHandlers(registry);

  // Compose the Thinga graph first — we need root.boot-params and world.world-params
  // before we can construct renderer + camera with no hardcoded fallbacks.
  const loaded = await composeFromRoot(rootId, dataDir);
  const root   = loaded.find(t => t.kind === "root");
  const world  = loaded.find(t => t.kind === "world");
  if (!root)  throw new Error("[ankhor] boot: no kind:root Thinga loaded");
  if (!world) throw new Error("[ankhor] boot: no kind:world Thinga loaded");
  const bootP  = facetMap(root)[B];
  const worldP = facetMap(world)["world-params"];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, need(bootP, "pixel_ratio_cap", B)));

  const scene = new THREE.Scene();
  const cp = applyWorldParams(THREE, scene, worldP);   // bg, fog, lights, grid
  const cam = new THREE.PerspectiveCamera(cp.fov, innerWidth / innerHeight, cp.near, cp.far);
  cam.position.set(cp.init_pos[0], cp.init_pos[1], cp.init_pos[2]);
  cam.lookAt(cp.look_at[0], cp.look_at[1], cp.look_at[2]);
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  });
  installMeshHandler(registry, { THREE, scene });

  // PASS 1: kind-def Thingas → registry.registerKind (capture defaults too).
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
    } catch (e) { console.warn(`[ankhor] registerKind("${def["for-kind"]}"):`, e.message); }
  }

  // PASS 2: spawn non-spawn-set Thingas (the world, tuning, kind-def Thingas).
  for (const t of loaded) {
    if (t.kind === "spawn-set") continue;
    try { registry.spawn(t); } catch (e) { console.warn(`[ankhor] spawn ${t.id}:`, e.message); }
  }

  // PASS 3: spawn-set children become game Things; default facets injected.
  let materialized = 0;
  for (const t of loaded) {
    if (t.kind !== "spawn-set") continue;
    for (const child of t.children || []) {
      const filled = injectDefaults(child, kindDefaults.get(child.kind) || {});
      try { registry.spawn(filled); materialized++; }
      catch (e) { console.warn(`[ankhor] spawn ${child.id}:`, e.message); }
    }
  }

  const maxDt = need(bootP, "max_frame_dt_seconds", B);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(maxDt, (now - last) / 1000); last = now;
    registry.tick(dt);
    const tt = now * cp.speed;
    cam.position.set(Math.sin(tt) * cp.orbit, cp.height, Math.cos(tt) * cp.orbit);
    cam.lookAt(cp.look_at[0], cp.look_at[1], cp.look_at[2]);
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

/** Merge kind-def defaults into a spawn instance. The instance's facets win;
 *  defaults fill in any facet the instance didn't declare. Defaults are
 *  deep-copied so shared default objects don't get mutated by the registry. */
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
