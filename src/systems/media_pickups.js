export function mountMediaPickups({ THREE, scene }) {
  const heroMedia  = [];  // { id, kind, label, files } — items the player is carrying
  const worldMedia = [];  // { id, kind, label, files, mesh, picked } — on-ground pickups

  function spawnMedia(spec, pos) {
    const isCD = spec.kind === "cd";
    const geom = isCD
      ? new THREE.CylinderGeometry(0.18, 0.18, 0.02, 24)
      : new THREE.BoxGeometry(0.08, 0.04, 0.2);
    const color = isCD ? 0xddddff : 0xffffff;
    const mat  = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos.u, pos.y || 1.0, pos.v);
    mesh.castShadow = true;
    scene.add(mesh);
    worldMedia.push({ id: spec.id, kind: spec.kind, label: spec.label, files: spec.files, mesh, picked: false });
  }

  return { heroMedia, worldMedia, spawnMedia };
}
