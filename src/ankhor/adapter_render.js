/**
 * Render Adapter — minimal. Scene populated by mesh handler from spawn data.
 * This adapter only: exposes scene for debug, applies day-night updates.
 */
import * as THREE from "three";

let _init = false;

export function renderAdapter(scene, registry, dt) {
  if (!_init) {
    // Expose for Playwright debugging
    window._scene = scene;
    _init = true;
    console.log("[adapter] exposed window._scene for debug");
  }
  updateSkyColors(scene, registry);
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
