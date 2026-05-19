// World pickup meshes — gold coin sphere for each WD pickup entity.
// mountPickupMeshes({ THREE, scene, pickups }) → { pickupMeshes }
export function mountPickupMeshes({ THREE, scene, pickups }) {
  const pickupMeshes = new Map();
  const coinGeo = new THREE.SphereGeometry(0.3, 12, 12);
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400, metalness: 0.6, roughness: 0.3 });

  for (const pk of pickups) {
    const m = new THREE.Mesh(coinGeo, coinMat);
    m.position.set(pk.u, 1.0, pk.v);
    m.castShadow = true;
    pickupMeshes.set(pk.id, m);
    scene.add(m);
  }

  return { pickupMeshes };
}
