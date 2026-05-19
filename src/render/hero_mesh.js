// Hero articulated mesh — torso + head + 2 arms + 2-segment legs + shadow blob.
// mountHeroMesh({ THREE, scene }) → { heroGroup, thighL, shinL, thighR, shinR, armL, armR, walkState, shadowBlob }
export function mountHeroMesh({ THREE, scene }) {
  const heroGroup = new THREE.Group();
  window._setHeroScale = v => { heroGroup.scale.setScalar(v); };

  const heroSkin  = new THREE.MeshStandardMaterial({ color: 0xffcc66 });
  const heroPants = new THREE.MeshStandardMaterial({ color: 0x223377 });
  const heroShirt = new THREE.MeshStandardMaterial({ color: 0xff5533 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), heroShirt);
  torso.position.y = 1.25; torso.castShadow = true; heroGroup.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), heroSkin);
  head.position.y = 1.85; head.castShadow = true; heroGroup.add(head);

  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x111111 })
  );
  eye.position.set(0, 1.92, 0.23); heroGroup.add(eye);

  function makeLimb(mat, h) {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, h, 0.22), mat);
    m.position.y = -h / 2;
    m.castShadow = true;
    pivot.add(m);
    return pivot;
  }

  function makeTwoSegLeg(mat) {
    const thigh = new THREE.Group();
    const thighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.43, 0.21), mat);
    thighMesh.position.y = -0.215; thighMesh.castShadow = true; thigh.add(thighMesh);
    const shin = new THREE.Group(); shin.position.y = -0.43;
    const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.18), mat);
    shinMesh.position.y = -0.21; shinMesh.castShadow = true; shin.add(shinMesh);
    thigh.add(shin);
    return { thigh, shin };
  }

  const { thigh: thighL, shin: shinL } = makeTwoSegLeg(heroPants);
  const { thigh: thighR, shin: shinR } = makeTwoSegLeg(heroPants);
  thighL.position.set(-0.18, 0.85, 0); heroGroup.add(thighL);
  thighR.position.set( 0.18, 0.85, 0); heroGroup.add(thighR);

  const armL = makeLimb(heroSkin, 0.7); armL.position.set(-0.45, 1.6, 0); heroGroup.add(armL);
  const armR = makeLimb(heroSkin, 0.7); armR.position.set( 0.45, 1.6, 0); heroGroup.add(armR);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;
  scene.add(shadowBlob);

  scene.add(heroGroup);
  const walkState = { t: 0 };

  return { heroGroup, thighL, shinL, thighR, shinR, armL, armR, walkState, shadowBlob };
}
