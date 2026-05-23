// Legacy clone of mountShootSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1711..1760
// (context lines 1707..1764)

const RELOAD_DUR     = () => Math.round((getWeapon().reloadDuration || 1200) * _perkReloadMul);
const PISTOL_MAG_CAP = () => getWeapon().magCap || 12;

// ── Shoot system — iter 538 ──────────────────────────────────────────────────
const _shootSys = mountShootSystem({
  THREE, scene, camera, world, bullets3D, heroGroup, Inv,
  get: {
    shopOpen:        () => _shop.isOpen,
    reloading:       () => _reloading,
    pistolAmmo:      () => pistolAmmo,
    pistolCooldown:  () => pistolCooldown,
    weapon:          () => getWeapon(),
    weapons:         () => CFG.weapons,
    heroInv:         () => heroInv,
    currentWeaponId: () => currentWeaponId,
    weaponAmmoEntry: (id) => weaponAmmo.has(id) ? weaponAmmo.get(id) : null,
    moveSpread:      () => _moveSpread,
    reloadDur:       () => RELOAD_DUR(),
    droneCooldown:   () => _droneCooldown,
    activeVehicleId: () => activeVehicleId,
    camYaw:          () => camYaw,
    camPitch:        () => camPitch,
    bulletGeo:       () => bulletGeo,
    bulletMat:       () => bulletMat,
    shotsFired:      () => _shotsFired,
  },
  set: {
    reloading:       (v) => { _reloading = v; },
    reloadStart:     (v) => { _reloadStart = v; },
    reloadMsg:       (v) => { reloadMsg = v; },
    reloadMsgUntil:  (v) => { reloadMsgUntil = v; },
    pistolAmmo:      (v) => { pistolAmmo = v; },
    pistolCooldown:  (v) => { pistolCooldown = v; },
    currentWeaponId: (v) => { currentWeaponId = v; },
    weaponAmmoEntry: (id, v) => { weaponAmmo.set(id, v); },
    shotsFired:      (v) => { _shotsFired = v; },
    lastHeroShotT:   (v) => { _lastHeroShotT = v; },
    heroShotAlertU:  (v) => { _heroShotAlertU = v; },
    heroShotAlertV:  (v) => { _heroShotAlertV = v; },
    heroShotAlertT:  (v) => { _heroShotAlertT = v; },
    addRecoilPitch:  (v) => { _recoilPitch += v; },
    gunKickZ:        (v) => { _gunKickZ = v; },
    droneCooldown:   (v) => { _droneCooldown = v; },
  },
  actions: {
    playSfx,
    showToast,
    spawnParticles:     _spawnParticles,
    triggerMuzzleFlash: _triggerMuzzleFlash,
    ejectCasing:        _ejectCasing,
    showWeaponSelector: _showWeaponSelector,
    switchGunMesh:      _switchGunMesh,
  },
});
const _tryShoot      = _shootSys.tryShoot;
const _tryDroneShoot = _shootSys.tryDroneShoot;
const _getAimAngle   = _shootSys.getAimAngle;

