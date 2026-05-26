/**
 * Render Adapter — world-level visuals.
 * Entity meshes: handled by existing "mesh" facet handler.
 * This adapter: skybox dome, ground, grid, lighting, fog.
 */

import * as THREE from "three";

export function renderAdapter(scene, registry, dt) {
  try {
    if (!scene.userData._adapterInit) {
      initScene(scene, registry);
      scene.userData._adapterInit = true;
    }
    updateSkybox(scene, registry);
  } catch (e) {
    console.warn("[adapter] render error (non-fatal):", e);
  }
}

function initScene(scene, registry) {
  // --- Ground ---
  const gGeo = new THREE.PlaneGeometry(60, 60);
  const gMat = new THREE.MeshStandardMaterial({ color: 0x334433, roughness: 0.85, metalness: 0.05 });
  const ground = new THREE.Mesh(gGeo, gMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  // --- Grid ---
  const grid = new THREE.GridHelper(60, 30, 0x446644, 0x334433);
  grid.position.y = 0.01;
  grid.name = "grid";
  scene.add(grid);

  // --- Lighting ---
  const amb = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.name = "sun";
  scene.add(sun);

  // --- Sky dome (large inverted sphere) ---
  const skyGeo = new THREE.SphereGeometry(90, 32, 32);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.name = "skydome";
  sky.renderOrder = -1;
  scene.add(sky);

  // --- Fog ---
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 140);

  console.log("[adapter] scene init: ground, grid, skydome, lighting, fog");
}

function updateSkybox(scene, registry) {
  // Update sky color from day-night facet if available
  const worlds = (registry.byKind?.("world") || []).concat(registry.byKind?.("root") || []);
  for (const wp of worlds) {
    const dn = registry.facetData(wp.id, "day-night");
    if (!dn || dn.sky === undefined) continue;

    // Update skydome
    const sky = scene.getObjectByName("skydome");
    if (sky && sky.material) {
      sky.material.color.setHex(dn.sky);
    }

    // Update ambient light from day-night
    const amb = scene.children.find(c => c.isAmbientLight);
    if (amb && dn.ambI !== undefined) amb.intensity = dn.ambI;

    // Update sun
    const sun = scene.getObjectByName("sun");
    if (sun) {
      if (dn.sunI !== undefined) sun.intensity = dn.sunI;
      if (dn.sunColor !== undefined) sun.color.setHex(dn.sunColor);
      if (dn.sunPos) sun.position.set(dn.sunPos.x, dn.sunPos.y, dn.sunPos.z);
    }

    // Update fog
    if (dn.fog !== undefined && scene.fog) {
      scene.fog.color.setHex(dn.fog);
      scene.background = new THREE.Color(dn.fog);
    }

    break;
  }
}
