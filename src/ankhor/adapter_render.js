/**
 * Render Adapter — world-level effects + debug visuals.
 * Entity meshes handled by existing "mesh" facet handler.
 * This adapter handles: lighting, fog, sky color, ground plane.
 */

import * as THREE from "three";

let _ground = null;

export function renderAdapter(scene, registry, dt) {
  try {
    applyWorldEffects(scene, registry);
    ensureGround(scene);
  } catch (e) {
    console.warn("[adapter] render error (non-fatal):", e);
  }
}

function applyWorldEffects(scene, registry) {
  if (scene._worldApplied) return;

  // Find world Thing (any kind that might have world facets)
  const worlds = registry.byKind?.("world") || [];
  const rootThings = registry.byKind?.("root") || [];
  const allWp = [...worlds, ...rootThings];

  let lightingApplied = false;
  for (const wp of allWp) {
    // Lighting
    const l = registry.facetData(wp.id, "lighting");
    if (l && !lightingApplied) {
      const amb = new THREE.AmbientLight(l.ambColor ?? 0xffffff, l.ambInt ?? 0.9);
      scene.add(amb);
      const sun = new THREE.DirectionalLight(l.sunColor ?? 0xffffff, l.sunInt ?? 1.1);
      sun.position.set(l.sunPos?.x ?? 20, l.sunPos?.y ?? 30, l.sunPos?.z ?? 10);
      scene.add(sun);
      lightingApplied = true;
    }

    // Fog
    const dn = registry.facetData(wp.id, "day-night");
    if (dn && !scene.fog) {
      scene.background = new THREE.Color(dn.skyColor ?? dn.sky ?? 0x87ceeb);
      scene.fog = new THREE.Fog(dn.fogColor ?? dn.fog ?? 0x87ceeb, 40, 140);
    }
  }

  scene._worldApplied = true;
}

function ensureGround(scene) {
  if (_ground) return;
  const geo = new THREE.PlaneGeometry(60, 60);
  const mat = new THREE.MeshStandardMaterial({ color: 0x334433, roughness: 0.9 });
  _ground = new THREE.Mesh(geo, mat);
  _ground.rotation.x = -Math.PI / 2;
  _ground.position.y = 0;
  _ground.receiveShadow = true;
  scene.add(_ground);

  // Grid helper
  const grid = new THREE.GridHelper(60, 30, 0x336633, 0x224422);
  scene.add(grid);

  // Visible marker — proves renderer works
  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x331100 })
  );
  marker.position.set(0, 1, 0);
  marker.name = "ankhor-marker";
  scene.add(marker);
}
