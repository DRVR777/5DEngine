/**
 * Render Adapter — materializes facet data into Three.js meshes.
 * Hooks between registry.tick() and renderer.render() in boot.js.
 * 
 * Reads authoritative state from facets, creates/updates meshes.
 * No direct window/document/THREE globals in facets — only in adapters.
 */

/**
 * @param {THREE.Scene} scene
 * @param {object} registry - Ankhor registry with byKind/facetData
 * @param {number} dt - frame delta
 */
export function renderAdapter(scene, registry, dt) {
  try {
    renderHeroes(scene, registry, dt);
    renderEnemies(scene, registry, dt);
    renderBullets(scene, registry, dt);
    renderPickups(scene, registry, dt);
    renderWorld(scene, registry);
  } catch (e) {
    console.warn("[adapter] render error (non-fatal):", e);
  }
}

// ---- HERO ----
function renderHeroes(scene, registry, dt) {
  for (const t of registry.byKind("hero")) {
    const pos = registry.facetData(t.id, "position");
    if (!pos) continue;
    ensureMesh(scene, registry, t, "hero", pos, 0xcccccc);
  }
}

// ---- ENEMIES ----
function renderEnemies(scene, registry, dt) {
  for (const t of registry.byKind("enemy")) {
    const pos = { x: registry.facetData(t.id, "position")?.x ?? t._u ?? 0, y: 1, z: t._v ?? 0 };
    const hp = registry.facetData(t.id, "health-display");
    const color = hp ? hpColor(hp.fraction) : 0xcc2222;
    ensureMesh(scene, registry, t, "enemy", pos, color);
  }
}

function hpColor(frac) {
  return frac > 0.6 ? 0x00cc44 : frac > 0.3 ? 0xff8800 : 0xff2222;
}

// ---- BULLETS ----
function renderBullets(scene, registry, dt) {
  for (const t of registry.byKind("bullet")) {
    const pos = { x: t._u ?? 0, y: t._y ?? 1.5, z: t._v ?? 0 };
    ensureMesh(scene, registry, t, "bullet", pos, 0xffff44, 0.08);
  }
}

// ---- PICKUPS ----
function renderPickups(scene, registry, dt) {
  for (const t of registry.byKind("pickup")) {
    const pos = { x: t._u ?? 0, y: t._bobY ?? 0.5, z: t._v ?? 0 };
    ensureMesh(scene, registry, t, "pickup", pos, 0xffaa00, 0.2);
  }
}

// ---- WORLD ----
function renderWorld(scene, registry) {
  // Lighting
  for (const t of registry.byKind("world-params")) {
    const l = registry.facetData(t.id, "lighting");
    if (l && !scene._lit) {
      scene._lit = true;
      const amb = new THREE.AmbientLight(l.ambColor ?? 0xffffff, l.ambInt ?? 0.9);
      scene.add(amb);
      const sun = new THREE.DirectionalLight(l.sunColor ?? 0xffffff, l.sunInt ?? 1.1);
      sun.position.set(l.sunPos?.x ?? 20, l.sunPos?.y ?? 30, l.sunPos?.z ?? 10);
      scene.add(sun);
    }
  }
  // Skybox/Day-night
  for (const t of registry.byKind("world-params")) {
    const dn = registry.facetData(t.id, "day-night");
    if (dn && scene.background !== undefined && scene.fog !== undefined) {
      scene.background = new THREE.Color(dn.sky ?? 0x87ceeb);
      scene.fog = new THREE.Fog(dn.fog ?? 0x87ceeb, 40, 140);
    }
  }
}

// ---- Mesh pool ----
const _meshes = new Map();
import * as THREE from "three";

function ensureMesh(scene, registry, thing, kind, pos, color, radius = 0.3) {
  const key = `${kind}_${thing.id}`;
  let m = _meshes.get(key);
  if (!m) {
    // Find or create mesh
    const existing = registry._meshes?.get(key);
    if (existing) {
      m = existing;
    } else {
      const geo = kind === "bullet" 
        ? new THREE.SphereGeometry(radius || 0.08, 6, 6)
        : kind === "pickup"
        ? new THREE.BoxGeometry(radius, radius, radius)
        : new THREE.CapsuleGeometry(radius, 0.6, 4, 8);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      m = new THREE.Mesh(geo, mat);
      scene.add(m);
    }
    _meshes.set(key, m);
    if (!registry._meshes) registry._meshes = new Map();
    registry._meshes.set(key, m);
  }
  m.position.set(pos.x, pos.y, pos.z);
  m.visible = true;
}

/** Dispose all meshes on teardown */
export function disposeAll() {
  for (const [key, m] of _meshes) {
    m.geometry?.dispose();
    m.material?.dispose();
  }
  _meshes.clear();
}
