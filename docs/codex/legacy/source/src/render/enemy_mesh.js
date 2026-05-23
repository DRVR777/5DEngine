// Enemy mesh factory — extracted from index.html iter 546.
// mountEnemyMeshFactory({ THREE, scene }) → { makeEnemyMesh }
export function mountEnemyMeshFactory({ THREE, scene }) {
  const _alertSpriteMat = (function() {
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const cx = c.getContext("2d");
    cx.clearRect(0, 0, 64, 64);
    cx.fillStyle = "#ffee00";
    cx.font = "bold 58px monospace";
    cx.textAlign = "center"; cx.textBaseline = "middle";
    cx.fillText("!", 32, 34);
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false });
  })();

  function makeEnemyMesh(eDef) {
    const group = new THREE.Group();
    const bodyRadius = eDef.type === "boss" ? 0.9 : eDef.type === "heavy" ? 0.55 : eDef.type === "fast" ? 0.28 : eDef.type === "robot" ? 0.42 : 0.4;
    const bodyHeight = eDef.type === "boss" ? 2.6 : eDef.type === "heavy" ? 1.5  : eDef.type === "fast" ? 0.9  : eDef.type === "robot" ? 1.3 : 1.1;

    if (eDef.type === "robot") {
      const rMat  = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.9, roughness: 0.2 });
      const accMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 1.2 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.9, 0.6), rMat);
      torso.position.y = 1.3; torso.castShadow = true; group.add(torso);
      const headR = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.48, 0.5), rMat);
      headR.position.y = 2.02; group.add(headR);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.06), accMat);
      eye.position.set(0, 2.02, 0.28); group.add(eye);
      for (const sx of [-0.52, 0.52]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), rMat);
        arm.position.set(sx, 1.18, 0); group.add(arm);
      }
      for (const lx of [-0.25, 0.25]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), rMat);
        leg.position.set(lx, 0.55, 0); group.add(leg);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.38), rMat);
        foot.position.set(lx, 0.14, 0.05); group.add(foot);
      }
      const hpY = 2.75;
      const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      hpBg.position.y = hpY;
      const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.10), new THREE.MeshBasicMaterial({ color: 0x00cc44 }));
      hpFg.position.y = hpY; hpFg.position.z = 0.001;
      const hpPivot = new THREE.Group(); hpPivot.add(hpBg); hpPivot.add(hpFg); group.add(hpPivot);
      const alertS = new THREE.Sprite(_alertSpriteMat.clone()); alertS.scale.set(0.55, 0.55, 1); alertS.position.y = hpY + 0.42; alertS.visible = false; alertS.name = "_alertBubble"; group.add(alertS);
      scene.add(group);
      return { group, hpFg, hpPivot };
    }

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(bodyRadius, bodyHeight, 4, 12),
      new THREE.MeshStandardMaterial({ color: eDef.color || 0xff0044, emissive: 0x110000 })
    );
    body.position.y = bodyHeight * 0.5 + bodyRadius; body.castShadow = true; group.add(body);
    if (eDef.type && eDef.type !== "grunt") {
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshStandardMaterial({ color: eDef.color, emissive: eDef.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.92 })
      );
      gem.position.y = bodyHeight + bodyRadius * 2 + 0.3;
      gem.name = "_typeGem";
      group.add(gem);
    }
    const hpY = bodyHeight + bodyRadius * 2 + 0.55;
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    hpBg.position.y = hpY;
    const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.10), new THREE.MeshBasicMaterial({ color: 0x00cc44 }));
    hpFg.position.y = hpY; hpFg.position.z = 0.001;
    const hpPivot = new THREE.Group(); hpPivot.add(hpBg); hpPivot.add(hpFg); group.add(hpPivot);
    const alertSp = new THREE.Sprite(_alertSpriteMat.clone()); alertSp.scale.set(0.55, 0.55, 1); alertSp.position.y = hpY + 0.42; alertSp.visible = false; alertSp.name = "_alertBubble"; group.add(alertSp);
    scene.add(group);
    return { group, hpFg, hpPivot };
  }

  return { makeEnemyMesh };
}
