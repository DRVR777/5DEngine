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
  console.info("[boot] start");
  const registry = createDefaultRegistry();
  installFacetHandlers(registry);
  if (!canvas) throw new Error("[ankhor] boot: no canvas provided");
  console.info("[boot] canvas found");

  // Fail-safe renderer FIRST, so even total composition failure still
  // shows a non-black frame instead of silent black-screen.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x201826, 1);  // dark concrete fallback
  console.info("[boot] renderer ready");

  // Compose the Thinga graph — we need root.boot-params and world.world-params
  // before we can construct camera with no hardcoded fallbacks.
  const loaded = await composeFromRoot(rootId, dataDir);
  console.info(`[boot] root loaded — ${loaded.length} Thingas`);
  const root   = loaded.find(t => t.kind === "root");
  const world  = loaded.find(t => t.kind === "world");
  if (!root)  throw new Error("[ankhor] boot: no kind:root Thinga loaded");
  if (!world) throw new Error("[ankhor] boot: no kind:world Thinga loaded");
  const bootP  = facetMap(root)[B];
  const worldP = facetMap(world)["world-params"];

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, need(bootP, "pixel_ratio_cap", B)));

  const scene = new THREE.Scene();
  const cp = applyWorldParams(THREE, scene, worldP);   // bg, fog, lights, grid
  console.info("[boot] world loaded");
  const cam = new THREE.PerspectiveCamera(cp.fov, innerWidth / innerHeight, cp.near, cp.far);
  cam.position.set(cp.init_pos[0], cp.init_pos[1], cp.init_pos[2]);
  cam.lookAt(cp.look_at[0], cp.look_at[1], cp.look_at[2]);
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  });
  installMeshHandler(registry, { THREE, scene });

  // Render-context Thinga — singleton carrying refs to THREE + scene +
  // camera so facets (health-display, future hp-bar/damage-number/decal
  // facets) can reach the render layer without globals.
  registry.spawn({
    id: "render-context/main",
    kind: "render-context",
    name: "render_context",
    facets: [{ name: "render-context", data: { THREE, scene, camera: cam } }],
  });

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

  console.info(`[boot] registry materialized — ${materialized} children`);

  const maxDt = need(bootP, "max_frame_dt_seconds", B);
  let last = performance.now();
  let frameCount = 0;
  function frame(now) {
    const dt = Math.min(maxDt, (now - last) / 1000); last = now;
    // Per-frame errors must NOT kill the loop — one bad legacy mount
    // or render call would black-screen the whole engine otherwise.
    try { registry.tick(dt); }
    catch (e) { console.error("[boot] registry.tick error (non-fatal):", e); }
    try { updateCamera(cam, cp, registry, now); }
    catch (e) { console.error("[boot] updateCamera error (non-fatal):", e); }
    try { renderer.render(scene, cam); }
    catch (e) { console.error("[boot] render error (non-fatal):", e); }
    if (frameCount === 0) console.info("[boot] first frame");
    frameCount++;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Wait one event-loop tick so legacy-mount facets' async init promises
  // can resolve before we report stats. The bridge's import() chain is
  // async; this lets onReady see how many legacy mounts actually bound.
  // allSettled never rejects — boot continues even if every spec fails.
  await Promise.allSettled(
    registry.byKind("legacy-system").map((t) => {
      const d = registry.facetData(t.id, "legacy-mount");
      return d && d._import_promise ? d._import_promise : Promise.resolve();
    })
  );
  console.info(`[boot] legacy bound: ${countLegacyBound(registry)}/${registry.byKind("legacy-system").length}`);

  // onReady is user-supplied; failure must not kill boot.
  if (onReady) {
    try {
      onReady({ registry, world, stats: {
        loaded:    loaded.length,
        kindDefs:  loaded.filter(t => t.kind === "kind-def").length,
        tuning:    loaded.filter(t => t.kind === "tuning").length,
        spawnSets: loaded.filter(t => t.kind === "spawn-set").length,
        materialized,
        handlers:  registry.handlerRegistry.size,
        legacyBound: countLegacyBound(registry),
        legacyTotal: registry.byKind("legacy-system").length,
      }});
    } catch (e) { console.warn("[boot] onReady threw (ignored):", e); }
  }
  return registry;
}

function countLegacyBound(registry) {
  let n = 0;
  for (const t of registry.byKind("legacy-system")) {
    const d = registry.facetData(t.id, "legacy-mount");
    if (d && d._ready) n++;
  }
  return n;
}

/** Position camera each frame. If a hero Thinga is in a vehicle,
 *  follow the vehicle from behind using the vehicle's variant tuning
 *  follow_* keys. Else follow the hero using world-params follow_*.
 *  No hero → fall back to the legacy orbit. */
function updateCamera(cam, cp, registry, now) {
  const heroes = registry.byKind("hero");
  if (heroes.length === 0) {
    const tt = now * cp.speed;
    cam.position.set(Math.sin(tt) * cp.orbit, cp.height, Math.cos(tt) * cp.orbit);
    cam.lookAt(cp.look_at[0], cp.look_at[1], cp.look_at[2]);
    return;
  }
  const hero = heroes[0];
  const heroPos = registry.facetData(hero.id, "position");
  if (!heroPos) return;
  const inv = registry.facetData(hero.id, "inventory");
  const ridingVehicleId = inv && inv.in_vehicle_id;

  if (ridingVehicleId) {
    const v = registry.byKind("vehicle").find(t => t.id === ridingVehicleId);
    const vPos = v ? registry.facetData(v.id, "position") : null;
    const vMesh = v ? registry.facetData(v.id, "mesh") : null;
    const vTuning = vehicleTuning(registry, vMesh?.tuning_ref);
    if (vPos && vTuning) {
      const yaw = typeof vPos.heading === "number" ? vPos.heading : 0;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      cam.position.set(
        vPos.x - fx * vTuning.follow_back,
        vPos.y + vTuning.follow_up,
        vPos.z - fz * vTuning.follow_back,
      );
      cam.lookAt(
        vPos.x + fx * vTuning.follow_lookahead,
        vPos.y + cp.follow_eye_height,
        vPos.z + fz * vTuning.follow_lookahead,
      );
      return;
    }
  }

  const inputs = registry.byKind("input");
  const yaw = (inputs.length && registry.facetData(inputs[0].id, "input-state")?.yaw) || heroPos.heading || 0;
  const forwardX = -Math.sin(yaw), forwardZ = -Math.cos(yaw);
  cam.position.set(
    heroPos.x - forwardX * cp.follow_back,
    heroPos.y + cp.follow_up,
    heroPos.z - forwardZ * cp.follow_back,
  );
  cam.lookAt(
    heroPos.x + forwardX * cp.follow_lookahead,
    heroPos.y + cp.follow_eye_height,
    heroPos.z + forwardZ * cp.follow_lookahead,
  );
}

function vehicleTuning(registry, tuningName) {
  if (!tuningName) return null;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== tuningName) continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.follow_back !== "number" || typeof tn.follow_up !== "number"
        || typeof tn.follow_lookahead !== "number") return null;
    return tn;
  }
  return null;
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
