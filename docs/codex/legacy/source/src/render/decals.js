// Ground decal + wall scorch system — extracted from index.html iter 539.
// mountDecalSystem({ THREE, scene }) → { spawnDecal, spawnWallScorch }
export function mountDecalSystem({ THREE, scene }) {
  const _decalPool = [];
  const _decalMats = {
    blood: new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: 0.82, depthWrite: false }),
    oil:   new THREE.MeshBasicMaterial({ color: 0x1a1a2a, transparent: true, opacity: 0.72, depthWrite: false }),
  };

  function spawnDecal(u, v, type) {
    const mat = _decalMats[type] || _decalMats.blood;
    const r = 0.4 + Math.random() * 0.35;
    let mesh;
    if (_decalPool.length) {
      mesh = _decalPool.pop();
      mesh.scale.setScalar(r / 0.5);
      mesh.material = mat;
      mesh.material.opacity = mat === _decalMats.blood ? 0.82 : 0.72;
      mesh.visible = true;
    } else {
      mesh = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), mat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.setScalar(r / 0.5);
      scene.add(mesh);
    }
    mesh.position.set(u, 0.015, v);
    mesh.rotation.z = Math.random() * Math.PI * 2;
    setTimeout(() => {
      mesh.visible = false;
      _decalPool.push(mesh);
    }, 45000);
  }

  const _wallScorches = [];
  const _SCORCH_MAX = 50;
  const _scorchGeo = new THREE.PlaneGeometry(0.28, 0.28);
  const _scorchBaseMat = new THREE.MeshBasicMaterial({
    color: 0x221100, transparent: true, opacity: 0.65, depthWrite: false,
    side: THREE.DoubleSide,
  });

  function spawnWallScorch(u, y, v, nU, nV) {
    let mesh;
    if (_wallScorches.length >= _SCORCH_MAX) {
      mesh = _wallScorches.shift();
    } else {
      mesh = new THREE.Mesh(_scorchGeo, _scorchBaseMat.clone());
      scene.add(mesh);
    }
    mesh.visible = true;
    mesh.material.opacity = 0.65;
    mesh.position.set(u + nU * 0.025, y, v + nV * 0.025);
    mesh.rotation.set(0, Math.atan2(nU, nV), 0);
    _wallScorches.push(mesh);
  }

  return { spawnDecal, spawnWallScorch, wallScorches: _wallScorches };
}
