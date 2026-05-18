// Weapon mesh registry — 3P arm mount + FP camera overlay.
// createWeaponVisuals({ THREE, armR, camera, weapons, getActiveWeaponId })
//   weapons = [{ id }, ...] from CFG.weapons (or [] for default pistol fallback)
//   getActiveWeaponId() → currentWeaponId at call time
// Returns { gunMount, fpGunGroup, switchGunMesh, registerGunMesh }
//   gunMount   — THREE.Group parented to armR; caller animates position/rotation in tick()
//   fpGunGroup — THREE.Group parented to camera; caller animates in tick()
export function createWeaponVisuals({ THREE, armR, camera, weapons, getActiveWeaponId }) {
  // ── 3P arm mount ───────────────────────────────────────────────────────────
  const gunMount = new THREE.Group();
  gunMount.position.set(0, -0.7, 0.2);
  armR.add(gunMount);

  const _gunMeshes = new Map();  // weaponId → THREE.Group

  const _3pSpecs = {
    pistol:  { body: [0.10, 0.16, 0.32], barrel: [0.06, 0.06, 0.40], bz: 0.34 },
    rifle:   { body: [0.08, 0.13, 0.58], barrel: [0.05, 0.05, 0.60], bz: 0.56 },
    shotgun: { body: [0.12, 0.16, 0.46], barrel: [0.09, 0.09, 0.38], bz: 0.40 },
    smg:     { body: [0.09, 0.13, 0.28], barrel: [0.05, 0.05, 0.28], bz: 0.28 },
    sniper:  { body: [0.07, 0.12, 0.70], barrel: [0.04, 0.04, 0.80], bz: 0.74 },
  };

  function _buildPlaceholder3P(id) {
    const dark  = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.75, roughness: 0.35 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const s = _3pSpecs[id] || _3pSpecs.pistol;
    const g = new THREE.Group();
    const body   = new THREE.Mesh(new THREE.BoxGeometry(...s.body), dark);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(...s.barrel), black);
    barrel.position.z = s.bz;
    g.add(body); g.add(barrel);
    return g;
  }

  // Seed placeholder for every configured weapon
  const activeId = getActiveWeaponId();
  for (const w of weapons) {
    const mesh = _buildPlaceholder3P(w.id);
    mesh.visible = w.id === activeId;
    gunMount.add(mesh);
    _gunMeshes.set(w.id, mesh);
  }
  if (!_gunMeshes.has("pistol")) {
    const m = _buildPlaceholder3P("pistol");
    m.visible = activeId === "pistol";
    gunMount.add(m);
    _gunMeshes.set("pistol", m);
  }

  // ── FP gun overlay ─────────────────────────────────────────────────────────
  const fpGunGroup = new THREE.Group();
  fpGunGroup.visible = false;
  fpGunGroup.position.set(0.22, -0.24, -0.45);
  camera.add(fpGunGroup);

  const _fpGunMeshes = new Map();  // weaponId → Group in FP view

  const _fpSpecs = {
    pistol:  { body: [0.06, 0.10, 0.20], barrel: [0.04, 0.04, 0.26], bz: 0.21 },
    rifle:   { body: [0.05, 0.08, 0.36], barrel: [0.03, 0.03, 0.38], bz: 0.35 },
    shotgun: { body: [0.07, 0.10, 0.28], barrel: [0.06, 0.06, 0.24], bz: 0.25 },
    smg:     { body: [0.05, 0.08, 0.18], barrel: [0.03, 0.03, 0.18], bz: 0.18 },
    sniper:  { body: [0.04, 0.07, 0.44], barrel: [0.025, 0.025, 0.50], bz: 0.46 },
  };

  function _buildFpGun(id) {
    const mat1 = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.75, roughness: 0.35, depthTest: false });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, depthTest: false });
    const s = _fpSpecs[id] || _fpSpecs.pistol;
    const g = new THREE.Group();
    const body   = new THREE.Mesh(new THREE.BoxGeometry(...s.body), mat1);
    body.renderOrder = 100;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(...s.barrel), mat2);
    barrel.position.z = -s.bz;
    barrel.renderOrder = 100;
    g.add(body); g.add(barrel);
    return g;
  }

  const fpWeapons = weapons.length > 0 ? weapons : ["pistol","rifle","shotgun","smg","sniper"].map(id => ({ id }));
  for (const w of fpWeapons) {
    const m = _buildFpGun(w.id);
    m.visible = w.id === activeId;
    fpGunGroup.add(m);
    _fpGunMeshes.set(w.id, m);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  function _switchFpGunMesh(weaponId) {
    _fpGunMeshes.forEach((m, id) => { m.visible = id === weaponId; });
  }

  function switchGunMesh(weaponId) {
    _gunMeshes.forEach((mesh, id) => { mesh.visible = id === weaponId; });
    _switchFpGunMesh(weaponId);
  }

  function registerGunMesh(weaponId, threeGroup) {
    const old = _gunMeshes.get(weaponId);
    if (old) gunMount.remove(old);
    threeGroup.visible = weaponId === getActiveWeaponId();
    gunMount.add(threeGroup);
    _gunMeshes.set(weaponId, threeGroup);
  }

  return { gunMount, fpGunGroup, switchGunMesh, registerGunMesh };
}
