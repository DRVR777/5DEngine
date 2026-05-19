// World layout — converts WorldData building defs to LayerBoundary objects + AABB blockers.
// Arena boundary walls are deferred until scene exists.
// mountWorldLayout({ THREE, wdBuildings }) → { buildings, buildingBlockers, buildArenaBoundary }
export function mountWorldLayout({ THREE, wdBuildings, LayerBoundary }) {
  function _buildFromSchema(def, layerIdx) {
    return {
      id: def.id, color: def.color,
      b: new LayerBoundary(layerIdx, "rect", { u0: def.u0, v0: def.v0, u1: def.u1, v1: def.v1 }),
    };
  }
  const buildings = wdBuildings.map((def, i) => _buildFromSchema(def, i + 2));

  function rectToBlocker(building) {
    const { u0, v0, u1, v1 } = building.b.params;
    return { u: (u0+u1)/2, v: (v0+v1)/2, hitbox: { w: Math.abs(u1-u0), d: Math.abs(v1-v0), h: 6 }, y: 0 };
  }
  const buildingBlockers = buildings.map(rectToBlocker);

  function buildArenaBoundary(scene) {
    const HALF = 28, THICK = 1.6, HEIGHT = 2.2;
    const matB = new THREE.MeshStandardMaterial({ color: 0x888880, roughness: 0.9, metalness: 0.1 });
    const wallDefs = [
      { u: 0,     v:  HALF, w: HALF * 2 + THICK, d: THICK },
      { u: 0,     v: -HALF, w: HALF * 2 + THICK, d: THICK },
      { u:  HALF, v: 0,     w: THICK, d: HALF * 2 + THICK },
      { u: -HALF, v: 0,     w: THICK, d: HALF * 2 + THICK },
    ];
    for (const wd of wallDefs) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wd.w, HEIGHT, wd.d), matB);
      mesh.position.set(wd.u, HEIGHT / 2, wd.v);
      mesh.receiveShadow = mesh.castShadow = true;
      scene.add(mesh);
      buildingBlockers.push({ u: wd.u, v: wd.v, hitbox: { w: wd.w, d: wd.d, h: HEIGHT }, y: 0 });
    }
  }

  return { buildings, buildingBlockers, buildArenaBoundary };
}
