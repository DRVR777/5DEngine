// Pickup/drop spawn functions — extracted from index.html iter 544.
// mountDropSpawner(deps) → { spawnAmmoPickup, spawnWeaponPickup, spawnHealthPickup,
//                            spawnArmorShard, spawnCoinDrop, + arrays }
export const WEAPON_DROP_MAP = { heavy: "rifle", robot: "smg", boss: "sniper" };

export function mountDropSpawner({ THREE, scene, CFG, get }) {
  // ── Ammo pickups ────────────────────────────────────────────────────────────
  const ammoPickups = [];
  const _ammoGeo = new THREE.BoxGeometry(0.18, 0.08, 0.28);
  const _ammoMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5, roughness: 0.4 });

  function spawnAmmoPickup(u, v, qty, ammoItem) {
    qty      = qty      ?? CFG.ammoDropQty ?? 12;
    ammoItem = ammoItem ?? get.weapon().ammoItem ?? "pistol_9mm";
    const mesh = new THREE.Mesh(_ammoGeo, _ammoMat);
    mesh.position.set(u, 0.4, v); mesh.castShadow = true;
    scene.add(mesh);
    ammoPickups.push({ mesh, u, v, qty, ammoItem, collected: false });
  }

  // ── Weapon pickups ──────────────────────────────────────────────────────────
  const weaponPickups = [];
  const _PICKUP_COLORS = { rifle: 0x445566, smg: 0x226699, sniper: 0x224433 };

  function spawnWeaponPickup(u, v, weaponId) {
    const col = _PICKUP_COLORS[weaponId] || 0x556677;
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.08, 0.14),
      new THREE.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: 0.3, emissive: col, emissiveIntensity: 0.5 })
    ));
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.4, roughness: 0.7 })
    );
    grip.position.set(-0.1, -0.1, 0);
    grp.add(grip);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 6, 6),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false })
    );
    pillar.position.set(0, 3, 0);
    grp.add(pillar);
    grp.position.set(u, 0.35, v);
    grp.rotation.y = Math.random() * Math.PI * 2;
    scene.add(grp);
    weaponPickups.push({ mesh: grp, u, v, weaponId, collected: false, pillar });
  }

  // ── Health pickups ──────────────────────────────────────────────────────────
  const healthPickups = [];
  const _healthGeo = new THREE.OctahedronGeometry(0.22, 0);
  const _healthMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00bb44, emissiveIntensity: 0.5 });

  function spawnHealthPickup(u, v, amount) {
    const off = () => (Math.random() - 0.5) * 0.8;
    const du = u + off(), dv = v + off();
    const mesh = new THREE.Mesh(_healthGeo, _healthMat);
    mesh.position.set(du, 0.6, dv); mesh.castShadow = true;
    scene.add(mesh);
    healthPickups.push({ mesh, u: du, v: dv, amount, collected: false });
  }

  // ── Armor shards ─────────────────────────────────────────────────────────────
  const armorShards = [];
  const _shardGeo = new THREE.TetrahedronGeometry(0.22, 0);
  const _shardMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xcc8800, emissiveIntensity: 0.7, metalness: 0.6, roughness: 0.3 });

  function spawnArmorShard(u, v, amount) {
    const off = () => (Math.random() - 0.5) * 1.0;
    const du = u + off(), dv = v + off();
    const mesh = new THREE.Mesh(_shardGeo, _shardMat.clone());
    mesh.position.set(du, 0.5, dv); mesh.castShadow = true;
    scene.add(mesh);
    armorShards.push({ mesh, u: du, v: dv, amount, collected: false });
  }

  // ── Coin drops ───────────────────────────────────────────────────────────────
  const coinDrops = [];

  function spawnCoinDrop(u, v, value) {
    value = value ?? 1;
    const off = () => (Math.random() - 0.5) * 0.8;
    const du = u + off(), dv = v + off();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x554400, metalness: 0.7, roughness: 0.2 })
    );
    mesh.position.set(du, 0.5, dv);
    scene.add(mesh);
    coinDrops.push({ mesh, u: du, v: dv, value, collected: false });
  }

  return {
    spawnAmmoPickup, spawnWeaponPickup, spawnHealthPickup, spawnArmorShard, spawnCoinDrop,
    ammoPickups, weaponPickups, healthPickups, armorShards, coinDrops,
  };
}
