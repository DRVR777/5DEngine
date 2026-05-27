/**
 * Hero Render Adapter — calls EXACT game.html mountHeroMesh.
 * Imports from src/render/hero_mesh.js — zero duplication.
 * Reads position from Ankhor facets, passes to game.html's mesh.
 */

import { mountHeroMesh } from "../render/hero_mesh.js";
import * as THREE from "three";

let _hero, _muzzleLight, _muzzleT;

export function heroRenderAdapter(scene, registry, dt) {
  if (!_hero) {
    _hero = mountHeroMesh({ THREE, scene });
    _muzzleLight = new THREE.PointLight(0xffcc44, 0, 8);
    scene.add(_muzzleLight);
  }

  const heroes = registry.byKind?.("hero") || [];
  if (!heroes.length) { _hero.heroGroup.visible = false; return; }

  const pos = registry.facetData(heroes[0].id, "position");
  if (!pos) return;

  _hero.heroGroup.visible = true;
  _hero.heroGroup.position.set(pos.x || 0, pos.y || 0, pos.z || 0);

  // Walk animation — same logic as game.html
  _hero.walkState.t += dt * 8;
  const input = registry.byKind?.("input")?.[0];
  const fd = input ? registry.facetData(input.id, "input-state") : null;
  const moving = fd?.keys?.KeyW || fd?.keys?.KeyA || fd?.keys?.KeyS || fd?.keys?.KeyD;

  if (moving) {
    const s = Math.sin(_hero.walkState.t);
    _hero.armL.rotation.x = s * 0.6;
    _hero.armR.rotation.x = -s * 0.6;
    _hero.thighL.rotation.x = -s * 0.5;
    _hero.thighR.rotation.x = s * 0.5;
  }

  // Shadow blob
  _hero.shadowBlob.position.set(pos.x || 0, 0.01, pos.z || 0);
  _hero.shadowBlob.material.opacity = Math.max(0, 0.28 - (pos.y || 0) * 0.06);

  // Muzzle flash
  _muzzleT -= dt;
  if (fd?.mouseHeld) _muzzleT = 0.08;
  _muzzleLight.intensity = _muzzleT > 0 ? 2.0 : 0;
  if (_muzzleT > 0) {
    const yaw = fd?.yaw || 0;
    _muzzleLight.position.set(
      (pos.x || 0) - Math.sin(yaw) * 0.9,
      (pos.y || 0) + 1.45,
      (pos.z || 0) - Math.cos(yaw) * 0.9
    );
  }
}
