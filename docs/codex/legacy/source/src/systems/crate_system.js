// Loot crate system — extracted from index.html iter 541.
// mountCrateSystem(deps) → { makeCrate, breakCrate, crates }
export function mountCrateSystem({ THREE, scene, get, set, actions }) {
  const _crateGeo     = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const _crateMat     = new THREE.MeshStandardMaterial({ color: 0x8b5c20, roughness: 0.85, metalness: 0.05 });
  const _crateEdgeMat = new THREE.MeshStandardMaterial({ color: 0x5a3a10, roughness: 0.9, metalness: 0.0 });
  const _crateEdgeGeo = new THREE.BoxGeometry(0.92, 0.06, 0.92);
  const _crateLoot    = ["ammo", "health", "coin", "coin", "ammo"];

  function makeCrate(u, v) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(_crateGeo, _crateMat);
    body.position.y = 0.45; body.castShadow = true; g.add(body);
    for (const ey of [0.18, 0.45, 0.72]) {
      const slat = new THREE.Mesh(_crateEdgeGeo, _crateEdgeMat);
      slat.position.y = ey; g.add(slat);
    }
    g.position.set(u, 0, v);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
    return { u, v, hp: 35, maxHp: 35, mesh: g, broken: false };
  }

  function breakCrate(crate) {
    crate.broken = true; crate.mesh.visible = false;
    actions.spawnParticles(crate.u, 0.5, crate.v, 20, "orange", 6, 0.55);
    actions.playSfx("tone:180:80:square", 0.35);
    const loot = _crateLoot[Math.floor(Math.random() * _crateLoot.length)];
    if (loot === "ammo")        actions.spawnAmmoPickup(crate.u, crate.v, 20, get.weapon().ammoItem);
    else if (loot === "health") actions.spawnHealthPickup(crate.u, crate.v, 25);
    else { set.score(get.score() + 2); actions.showToast("+2 coins from crate!", "success", 800); }
    actions.spawnDamageNumber(crate.u, 1.0, crate.v, "CRACK!", "#cc8833");
  }

  const crates = [
    {u:6,v:6},{u:-6,v:6},{u:6,v:-6},{u:-6,v:-6},
    {u:14,v:8},{u:-14,v:8},{u:8,v:-14},{u:-8,v:14}
  ].map(p => makeCrate(p.u, p.v));

  return { makeCrate, breakCrate, crates };
}
