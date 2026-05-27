/**
 * Environment Adapter — calls EXACT game.html mountEnvironment.
 * Imports from src/render/environment.js — zero duplication.
 * Buildings from world_data.js.
 */

import { mountEnvironment } from "../render/environment.js";
import * as THREE from "three";

let _skyUniforms, _init;

const buildings = [
  { id:"shop", color:0xff6b6b, u0:10, v0:-4, u1:16, v1:4 },
  { id:"tower", color:0x4ecdc4, u0:-16, v0:6, u1:-10, v1:12 },
  { id:"house", color:0xffe66d, u0:-6, v0:-14, u1:0, v1:-8 },
  { id:"garage", color:0xa8dadc, u0:6, v0:10, u1:12, v1:16 },
  { id:"diner", color:0xff9f1c, u0:-22, v0:-12, u1:-16, v1:-6 },
  { id:"server_room", color:0x1a3a5c, u0:-38, v0:-8, u1:-26, v1:8 },
  { id:"bank", color:0x9b5de5, u0:18, v0:12, u1:24, v1:18 },
  { id:"park", color:0x80ed99, u0:-10, v0:18, u1:-2, v1:26 },
  { id:"studio", color:0xf72585, u0:20, v0:-22, u1:26, v1:-14 },
];

// Convert building defs to LayerBoundary format that mountEnvironment expects
function toLayerBoundary(def) {
  return { id: def.id, color: def.color, b: { params: { u0: def.u0, v0: def.v0, u1: def.u1, v1: def.v1 } } };
}

export function envRenderAdapter(scene, registry, dt) {
  if (!_init) {
    const bldgs = buildings.map(toLayerBoundary);
    const result = mountEnvironment({ THREE, scene, buildings: bldgs });
    _skyUniforms = result.skyUniforms;
    _init = true;
    window._scene = scene;
  }

  // Day-night sky colors
  if (!_skyUniforms) return;
  const worlds = (registry.byKind?.("world") || []).concat(registry.byKind?.("root") || []);
  for (const wp of worlds) {
    const dn = registry.facetData(wp.id, "day-night");
    if (dn?.sky !== undefined) {
      _skyUniforms.topColor.value.setHex(dn.sky);
      return;
    }
  }
}
