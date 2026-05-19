// NPC capsule mesh factory — capsule body + glow ring per NPC def.
// mountNpcMeshFactory({ THREE, scene, npcDefs }) → { npcMeshes }
export function mountNpcMeshFactory({ THREE, scene, npcDefs }) {
  const npcMeshes = new Map();

  for (const n of npcDefs) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 12),
      new THREE.MeshStandardMaterial({ color: n.color })
    );
    b.position.y = 0.85; b.castShadow = true; g.add(b);

    const ringGeo = new THREE.RingGeometry(0.45, 0.60, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);

    scene.add(g);
    npcMeshes.set(n.id, { group: g, heading: n.heading, ring });
  }

  return { npcMeshes };
}
