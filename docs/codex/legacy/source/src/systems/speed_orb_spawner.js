// Speed boost orb spawner — DodecahedronGeometry orbs placed by wave system.
// Caller owns _speedBoostT / _speedTrailT; this module just creates meshes.
// mountSpeedOrbSpawner({ THREE, scene }) → { speedOrbs, spawnSpeedOrb }
export function mountSpeedOrbSpawner({ THREE, scene }) {
  const speedOrbs = [];
  const _geo = new THREE.DodecahedronGeometry(0.22, 0);
  const _mat = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xffa500, emissiveIntensity: 0.9, metalness: 0.2 });

  function spawnSpeedOrb(u, v) {
    const mesh = new THREE.Mesh(_geo, _mat.clone());
    mesh.position.set(u, 0.7, v);
    scene.add(mesh);
    speedOrbs.push({ mesh, u, v, collected: false, _birthT: performance.now() / 1000 });
  }

  return { speedOrbs, spawnSpeedOrb };
}
