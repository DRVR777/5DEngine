// Static supply caches — grenade crates and armor vest pickups placed at fixed map positions.
// mountStaticSupply({ THREE, scene }) → { grenadeCrates, armorPickups }
export function mountStaticSupply({ THREE, scene }) {
  const grenadeCrates = [];
  (function() {
    const cratePositions = [[10, -10], [-10, 10], [0, 18], [-14, -4]];
    const geo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x336633, metalness: 0.3, roughness: 0.6 });
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x00ff44, emissive: 0x00aa22, emissiveIntensity: 0.6 });
    for (const [cu, cv] of cratePositions) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.set(cu, 0.2, cv); mesh.castShadow = true; scene.add(mesh);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.12), lineMat.clone());
      stripe.position.set(0, 0, 0); mesh.add(stripe);
      grenadeCrates.push({ mesh, u: cu, v: cv, respawnT: -Infinity, active: true });
    }
  })();

  const armorPickups = [];
  (function() {
    const positions = [[18, 5], [-16, 14], [4, -20]];
    const geo  = new THREE.BoxGeometry(0.4, 0.55, 0.25);
    const mat  = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xcc9900, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.4 });
    for (const [au, av] of positions) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.set(au, 0.3, av); mesh.castShadow = true; scene.add(mesh);
      armorPickups.push({ mesh, u: au, v: av, respawnT: -Infinity, active: true });
    }
  })();

  return { grenadeCrates, armorPickups };
}
