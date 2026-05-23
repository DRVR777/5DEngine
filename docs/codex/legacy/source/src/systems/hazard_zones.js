// Fire patches and poison puddles — extracted from index.html iter 543.
// mountHazardZones(deps) → { spawnFirePatch, spawnPoisonPuddle, firePatches, poisonPuddles }
export function mountHazardZones({ THREE, scene }) {
  const firePatches = [];
  function spawnFirePatch(u, v, radius, duration) {
    radius   = radius   ?? 1.5;
    duration = duration ?? 6.0;
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 12),
      new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.55, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(u, 0.04, v);
    scene.add(mesh);
    firePatches.push({ mesh, u, v, radius, timeLeft: duration, dmgT: 0 });
  }

  const poisonPuddles = [];
  function spawnPoisonPuddle(u, v) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1.2, 14),
      new THREE.MeshBasicMaterial({ color: 0x44cc44, transparent: true, opacity: 0.5, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(u, 0.03, v);
    scene.add(mesh);
    poisonPuddles.push({ mesh, u, v, radius: 1.2, timeLeft: 4.0, applyT: 0 });
  }

  return { spawnFirePatch, spawnPoisonPuddle, firePatches, poisonPuddles };
}
