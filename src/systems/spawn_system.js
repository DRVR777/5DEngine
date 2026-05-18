// Spawn point system — N key (in build mode) places respawn markers
// mountSpawnSystem(deps) → { addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints }

// scene is passed as a lazy getter (getScene) so this can be mounted before
// scene exists in index.html — scene is only accessed at call time, not mount time.
export function mountSpawnSystem({ THREE, getScene, buildingBlockers }) {
  const spawnPoints = [{ u: 0, v: 0, label: "origin" }];
  const _spawnMeshes = [];

  function addSpawnPoint(u, v) {
    const sp = { u, v, label: `SP${spawnPoints.length + 1}` };
    spawnPoints.push(sp);
    const scene = getScene();
    const geo = new THREE.CylinderGeometry(0.3, 0.8, 0.15, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(u, 0.08, v);
    scene.add(mesh);
    _spawnMeshes.push({ mesh, sp });
    return sp;
  }

  function getSpawnPoint() {
    return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
  }

  // Returns a (u,v) at radius [minR,maxR] from (cu,cv) that doesn't overlap any building.
  // Retries up to maxTries times; falls back to a safe open-field spot if all fail.
  function spawnClearPos(minR, maxR, maxTries, cu, cv) {
    cu = cu || 0; cv = cv || 0;
    maxTries = maxTries || 30;
    const margin = 0.7;
    for (let _t = 0; _t < maxTries; _t++) {
      const ang = Math.random() * Math.PI * 2;
      const r   = minR + Math.random() * (maxR - minR);
      const u   = cu + Math.cos(ang) * r;
      const v   = cv + Math.sin(ang) * r;
      let blocked = false;
      for (const bl of buildingBlockers) {
        if (Math.abs(bl.u) >= 26 || Math.abs(bl.v) >= 26) continue;
        const hw = bl.hitbox.w / 2 + margin;
        const hd = bl.hitbox.d / 2 + margin;
        if (Math.abs(u - bl.u) < hw && Math.abs(v - bl.v) < hd) { blocked = true; break; }
      }
      if (!blocked) return { u, v };
    }
    return { u: 15, v: 0 };
  }

  return { addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints };
}
