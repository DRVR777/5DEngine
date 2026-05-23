const COLLECT_DIST  = 1.5;
const SPIN_SPEED    = 1.5;
const BOB_AMP       = 0.12;
const BOB_PERIOD    = 350;
const BOB_BASE      = 1.0;

export function mountMediaPickups({ THREE, scene, actions = {} }) {
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

  function tick(dt, { heroU, heroV, nowMs }) {
    for (const m of worldMedia) {
      if (m.picked) continue;
      const d = Math.hypot(m.mesh.position.x - heroU, m.mesh.position.z - heroV);
      if (d < COLLECT_DIST) {
        m.picked = true;
        scene.remove(m.mesh);
        heroMedia.push({ id: m.id, kind: m.kind, label: m.label, files: m.files });
        if (actions.playSfx) actions.playSfx("blip", 0.4);
      } else {
        m.mesh.rotation.y += dt * SPIN_SPEED;
        m.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + (m.id.length || 1)) * BOB_AMP;
      }
    }
  }

  return { heroMedia, worldMedia, spawnMedia, tick };
}
