/**
 * Render Adapter — minimal. Scene populated by mesh handler from spawn data.
 * This adapter only: exposes scene for debug, applies day-night updates.
 */
import * as THREE from "three";

let _init = false;
let _shadowBlob = null;

export function renderAdapter(scene, registry, dt) {
  if (!_init) {
    window._scene = scene;
    _init = true;
    // Shadow blob — follows hero, fades when airborne. From game.html L2086
    const blobGeo = new THREE.CircleGeometry(0.4, 16);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
    _shadowBlob = new THREE.Mesh(blobGeo, blobMat);
    _shadowBlob.rotation.x = -Math.PI / 2;
    _shadowBlob.renderOrder = 1;
    scene.add(_shadowBlob);
    console.log("[adapter] shadow blob + scene exposed");
  }
  updateShadowBlob(scene, registry);
  updateSkyColors(scene, registry);
}

function updateShadowBlob(scene, registry) {
  if (!_shadowBlob) return;
  const heroes = registry.byKind?.("hero") || [];
  if (!heroes.length) { _shadowBlob.visible = false; return; }
  const pos = registry.facetData(heroes[0].id, "position");
  if (!pos) { _shadowBlob.visible = false; return; }
  _shadowBlob.visible = true;
  _shadowBlob.position.set(pos.x || 0, 0.01, pos.z || 0);
  _shadowBlob.material.opacity = Math.max(0, 0.28 - (pos.y || 0) * 0.06);
}

function updateSkyColors(scene, registry) {
  const worlds = (registry.byKind?.("world") || []).concat(registry.byKind?.("root") || []);
  for (const wp of worlds) {
    const dn = registry.facetData(wp.id, "day-night");
    if (!dn || dn.sky === undefined) continue;
    if (scene.fog) scene.fog.color.setHex(dn.fog ?? dn.sky);
    if (scene.background) scene.background.setHex(dn.sky);
    const sun = scene.getObjectByName("sun");
    if (sun) {
      if (dn.sunI !== undefined) sun.intensity = dn.sunI;
      if (dn.sunColor !== undefined) sun.color.setHex(dn.sunColor);
    }
    break;
  }
}
