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
import { heroRenderAdapter }   from "./hero_adapter.js";
import { enemyRenderAdapter }  from "./enemy_adapter.js";
import { envRenderAdapter }    from "./env_adapter.js";
import { requireParam as need }  from "./require_param.js";

const B = "boot-params";

export async function boot({ canvas, dataDir = "./data/", rootId = "root", onReady } = {}) {
  // Per-stage try/catch so the next failure pinpoints the broken step
  // instead of producing a generic black-screen + opaque message.
  const stage = async (name, fn) => {
    console.info(`[boot] ▶ ${name}`);
    try { const r = await fn(); console.info(`[boot] ✓ ${name}`); return r; }
    catch (e) {
      console.error(`[boot] ✗ ${name} —`, e);
      throw new Error(`stage:${name}: ${e?.message || e}`);
    }
  };

  console.info("[boot] start");
  const registry = await stage("createDefaultRegistry", () => createDefaultRegistry());
  await stage("installFacetHandlers", () => installFacetHandlers(registry));
  if (!canvas) throw new Error("[ankhor] boot: no canvas provided");
  console.info("[boot] canvas found");

  const renderer = await stage("new WebGLRenderer", () => new THREE.WebGLRenderer({ canvas, antialias: true }));
  await stage("renderer.setSize",       () => renderer.setSize(innerWidth, innerHeight));
  await stage("renderer.setClearColor", () => renderer.setClearColor(0x201826, 1));

  const loaded = await stage("composeFromRoot", () => composeFromRoot(rootId, dataDir));
  console.info(`[boot] loaded ${loaded?.length ?? "?"} Thingas`);
  if (!Array.isArray(loaded)) throw new Error(`composeFromRoot returned non-array (${typeof loaded})`);

  const root   = loaded.find(t => t.kind === "root");
  const world  = loaded.find(t => t.kind === "world");
  if (!root)  throw new Error("no kind:root Thinga loaded");
  if (!world) throw new Error("no kind:world Thinga loaded");
  const bootP  = facetMap(root)[B];
  const worldP = facetMap(world)["world-params"];
  if (!bootP)  throw new Error("root Thinga missing boot-params facet");
  if (!worldP) throw new Error("world Thinga missing world-params facet");

  await stage("setPixelRatio",         () => renderer.setPixelRatio(Math.min(devicePixelRatio || 1, need(bootP, "pixel_ratio_cap", B))));
  const scene = await stage("new Scene", () => new THREE.Scene());
  window._scene = scene;  // expose for debugging
  const cp    = await stage("applyWorldParams", () => applyWorldParams(THREE, scene, worldP));
  const cam   = await stage("new PerspectiveCamera", () => new THREE.PerspectiveCamera(cp.fov, innerWidth / innerHeight, cp.near, cp.far));
  await stage("cam.position.set", () => cam.position.set(cp.init_pos[0], cp.init_pos[1], cp.init_pos[2]));
  await stage("cam.lookAt",       () => cam.lookAt(cp.look_at[0], cp.look_at[1], cp.look_at[2]));
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  });
  await stage("installMeshHandler", () => installMeshHandler(registry, { THREE, scene }));

  // Spawn the render-context Thinga with EMPTY facet data, then
  // attach the THREE/scene/camera refs directly to the stored facet
  // data after the fact. Reason: registry.spawn() emits a spawn event
  // whose payload is JSON.parse(JSON.stringify(thing)). THREE.Scene
  // and PerspectiveCamera are Object3Ds with circular parent/child
  // refs that crash JSON.stringify — that was the iter-757 black-
  // screen culprit ("Cannot read properties of undefined (reading
  // 'length')" was thrown deep inside Three's Object3D.toJSON walk).
  // Direct mutation of facetData bypasses the clone path entirely.
  await stage("spawn render-context", () => registry.spawn({
    id: "render-context/main",
    kind: "render-context",
    name: "render_context",
    facets: [{ name: "render-context", data: {} }],
  }));
  await stage("attach render-context refs", () => {
    const ctx = registry.facetData("render-context/main", "render-context");
    ctx.THREE  = THREE;
    ctx.scene  = scene;
    ctx.camera = cam;
  });

  // PASS 1: kind-def Thingas → registry.registerKind (capture defaults too).
  const kindDefaults = new Map();
  let p1bad = 0;
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
    } catch (e) { p1bad++; console.warn(`[ankhor] registerKind("${def["for-kind"]}"):`, e.message); }
  }
  console.info(`[boot] ✓ PASS 1 (${kindDefaults.size} kinds, ${p1bad} failed)`);

  // PASS 2: spawn non-spawn-set Thingas (the world, tuning, kind-def Thingas).
  let p2ok = 0, p2bad = 0;
  for (const t of loaded) {
    if (t.kind === "spawn-set") continue;
    try { registry.spawn(t); p2ok++; }
    catch (e) { p2bad++; console.warn(`[ankhor] spawn ${t.id} (${t.kind}):`, e.message); }
  }
  console.info(`[boot] ✓ PASS 2 (${p2ok} ok, ${p2bad} failed)`);

  // PASS 3: spawn-set children become game Things; default facets injected.
  let materialized = 0, p3bad = 0;
  for (const t of loaded) {
    if (t.kind !== "spawn-set") continue;
    for (const child of t.children || []) {
      const filled = injectDefaults(child, kindDefaults.get(child.kind) || {});
      try { registry.spawn(filled); materialized++; }
      catch (e) { p3bad++; console.warn(`[ankhor] spawn ${child.id} (${child.kind}):`, e.message); }
    }
  }
  console.info(`[boot] ✓ PASS 3 (${materialized} ok, ${p3bad} failed)`);

  const maxDt = need(bootP, "max_frame_dt_seconds", B);
  let last = performance.now();
  let frameCount = 0;
  function frame(now) {
    const dt = Math.min(maxDt, (now - last) / 1000); last = now;
    // Per-frame errors must NOT kill the loop — one bad legacy mount
    // or render call would black-screen the whole engine otherwise.
    try { registry.tick(dt); }
    catch (e) { console.error("[boot] registry.tick error (non-fatal):", e); }
    try { console.log("[boot] calling envRenderAdapter..."); envRenderAdapter(scene, registry, dt); console.log("[boot] envRenderAdapter OK"); }
    catch (e) { console.error("[boot] envAdapter error (non-fatal):", e); }
    try { console.log("[boot] calling heroRenderAdapter..."); heroRenderAdapter(scene, registry, dt); console.log("[boot] heroRenderAdapter OK"); }
    catch (e) { console.error("[boot] heroAdapter error (non-fatal):", e); }
    try { enemyRenderAdapter(scene, registry, dt); }
    catch (e) { console.error("[boot] enemyAdapter error (non-fatal):", e); }
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
