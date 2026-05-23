// Vehicle mesh factory — extracted from index.html iter 547.
// makeVehicleMesh({ THREE }) → { makeVehicleMesh }
// Note: caller is responsible for scene.add(group).
export function mountVehicleMeshFactory({ THREE }) {
  function makeVehicleMesh(vDef) {
    const w = (vDef.hitbox && vDef.hitbox.w) || 2;
    const d = (vDef.hitbox && vDef.hitbox.d) || 4;
    const col = vDef.color || 0xc1121f;
    const group = new THREE.Group();

    // ── Drone (quadcopter) ─────────────────────────────────────────────────────
    if (vDef.type === "drone") {
      const bodyMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.3 });
      const armMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.8 });
      const rotMat  = new THREE.MeshStandardMaterial({ color: 0x333355, transparent: true, opacity: 0.55 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 6), bodyMat);
      body.position.y = 0.12; body.castShadow = true; group.add(body);
      const cam = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x001133, emissive: 0x0033ff, emissiveIntensity: 0.4 }));
      cam.position.set(0, 0.06, 0.28); group.add(cam);
      group._rotors = [];
      const armCorners = [[0.38, 0.38], [-0.38, 0.38], [0.38, -0.38], [-0.38, -0.38]];
      const armRots    = [-Math.PI/4, Math.PI/4, -3*Math.PI/4, 3*Math.PI/4];
      for (let i = 0; i < 4; i++) {
        const [ax, az] = armCorners[i];
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.76), armMat);
        arm.position.set(ax * 0.5, 0.12, az * 0.5);
        arm.rotation.y = armRots[i]; group.add(arm);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.03), armMat);
        leg.position.set(ax * 0.5, 0.04, az * 0.5); group.add(leg);
        const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.014, 14), rotMat);
        rotor.position.set(ax, 0.13, az); group.add(rotor);
        group._rotors.push(rotor);
      }
      group._bodyMesh = body;
      return group;
    }

    // ── Mech suit (bipedal walker) ─────────────────────────────────────────────
    if (vDef.type === "mech") {
      const bodyMat = new THREE.MeshStandardMaterial({ color: col, metalness: 0.7, roughness: 0.35 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.8 });
      const accMat  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xcc2200, emissiveIntensity: 0.8 });
      const torsoM = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.7), bodyMat);
      torsoM.position.y = 1.55; torsoM.castShadow = true; group.add(torsoM);
      for (const sx of [-0.65, 0.65]) {
        const sh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.35, 0.6), darkMat);
        sh.position.set(sx, 1.75, 0); group.add(sh);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.55), bodyMat);
      head.position.y = 2.22; group.add(head);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.16, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.5 }));
      visor.position.set(0, 2.22, 0.33); group.add(visor);
      for (const ax of [-0.7, 0.7]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), darkMat);
        arm.position.set(ax, 1.4, 0); group.add(arm);
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.55, 8), bodyMat);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(ax, 1.4, 0.45); group.add(cannon);
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.12, 6), accMat);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(ax, 1.4, 0.78); group.add(muzzle);
      }
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.6), darkMat);
      waist.position.y = 1.05; group.add(waist);
      group._legs = [];
      for (const lx of [-0.3, 0.3]) {
        const thighM = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.32), bodyMat);
        thighM.position.set(lx, 0.72, 0); group.add(thighM);
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.28), darkMat);
        shin.position.set(lx, 0.27, 0); group.add(shin);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.46), bodyMat);
        foot.position.set(lx, 0.06, 0.07); foot.castShadow = true; group.add(foot);
        group._legs.push({ thighM, shin });
      }
      group._bodyMesh = torsoM;
      return group;
    }

    // ── Standard car / motorcycle ──────────────────────────────────────────────
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.7, d),
      new THREE.MeshStandardMaterial({ color: col, metalness: 0.3, roughness: 0.4 })
    );
    body.position.y = 0.7; body.castShadow = true;
    group.add(body);
    if (vDef.type !== "motorcycle") {
      const roofDark = new THREE.Color(col).multiplyScalar(0.6);
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.85, 0.6, d * 0.5),
        new THREE.MeshStandardMaterial({ color: roofDark })
      );
      roof.position.set(0, 1.35, -d * 0.05); roof.castShadow = true;
      group.add(roof);
    }
    const wheelW = w * 0.5, wheelD = d * 0.35;
    group._wheels = [];
    for (const wx of [-wheelW, wheelW]) for (const wz of [-wheelD, wheelD]) {
      const wh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wh.rotation.z = Math.PI / 2;
      wh.position.set(wx, 0.35, wz); wh.castShadow = true;
      group.add(wh);
      group._wheels.push(wh);
    }
    group._bodyMesh = body;
    return group;
  }

  return { makeVehicleMesh };
}
