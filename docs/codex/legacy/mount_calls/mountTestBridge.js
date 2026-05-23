// Legacy clone of mountTestBridge call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2329..2409
// (context lines 2325..2413)

const _mp = (_mpRef = _appMp.mp);
const _duelMode = _appMp.duelMode;

// ═══ EXTRACTED → src/bridges/test_bridge.js (iter 689) ════════════════════════
mountTestBridge({
  enemies, world, WaveManager, THREE, renderer, camera, composer, scene, Vfx,
  bullets3D, enemyBullets, buildingBlockers, hasLOS, CFG,
  shop: _shop, settings: _settings, npcDialog: _npcDialog,
  get: {
    heroHp:           () => heroHp,
    HERO_MAX_HP:      () => HERO_MAX_HP,
    perkMaxHpBonus:   () => _perkMaxHpBonus || 0,
    pistolAmmo:       () => pistolAmmo,
    heroDead:         () => _heroDead,
    reloading:        () => _reloading,
    camYaw:           () => camYaw,
    camPitch:         () => camPitch,
    camDist:          () => camDist,
    buildMode:        () => buildMode,
    aiming:           () => aiming,
    gameMode:         () => gameMode,
    computerOpen:     () => computerOpen,
    computerEntering: () => computerEntering,
    firstLaunch:      () => _firstLaunch,
    currentWeaponId:  () => currentWeaponId,
    heroArmor:        () => heroArmor,
    pointerLocked:    () => pointerLocked,
    fpsDisplay:       () => _fpsDisplay,
    lastT:            () => lastT,
    noRender:         () => _5D_NO_RENDER,
    weaponAmmo:       () => weaponAmmo,
    shotsFired:       () => _shotsFired,
    speedOrbs:        () => _speedOrbs,
    healthPickups:    () => healthPickups,
    coinDrops:        () => coinDrops,
    firePatches:      () => firePatches,
    poisonPuddles:    () => poisonPuddles,
    mines:            () => _mines,
    inCar:            () => (typeof inCar !== "undefined" ? inCar : false),
  },
  set: {
    heroHp:           v => { heroHp = v; },
    pistolAmmo:       v => { pistolAmmo = v; },
    heroDead:         v => { _heroDead = v; },
    reloading:        v => { _reloading = v; },
    camYaw:           v => { camYaw = v; },
    camPitch:         v => { camPitch = v; },
    buildMode:        v => { buildMode = v; },
    aiming:           v => { aiming = v; },
    gameMode:         v => { gameMode = v; },
    computerOpen:     v => { computerOpen = v; },
    computerEntering: v => { computerEntering = v; },
    firstLaunch:      v => { _firstLaunch = v; },
    currentWeaponId:  v => { currentWeaponId = v; },
    pistolCooldown:   v => { pistolCooldown = v; },
    shotsFired:       v => { _shotsFired = v; },
    lastHeroShotT:    v => { _lastHeroShotT = v; },
    heroShotAlertU:   v => { _heroShotAlertU = v; },
    heroShotAlertV:   v => { _heroShotAlertV = v; },
    heroShotAlertT:   v => { _heroShotAlertT = v; },
    lastT:            v => { lastT = v; },
  },
  fns: {
    getWeapon,
    tryShoot:          _tryShoot,
    switchGunMesh:     _switchGunMesh,
    closeComputer:     typeof closeComputer !== "undefined" ? closeComputer : null,
    flashDamage,
    showPerkPicker:    _showPerkPicker,
    spawnHealthPickup: _spawnHealthPickup,
    spawnAmmoPickup:   _spawnAmmoPickup,
    spawnArmorShard:   _spawnArmorShard,
    spawnWeaponPickup: _spawnWeaponPickup,
    spawnCoinDrop:     _spawnCoinDrop,
    spawnFirePatch:    _spawnFirePatch,
    spawnPoisonPuddle: _spawnPoisonPuddle,
    throwGrenade:      _throwGrenade,
    throwSmokeGrenade: _throwSmokeGrenade,
    throwFlashbang:    _throwFlashbang,
    dropMine:          _dropMine,
    spawnSpeedOrb:     typeof _spawnSpeedOrb !== "undefined" ? _spawnSpeedOrb : null,
    spawnEnemyAtHero:  typeof window._spawnEnemyAtHero === "function" ? window._spawnEnemyAtHero : null,
    gameTick: () => { _tickDriveMode = true; try { tick(); } finally { _tickDriveMode = false; } },
  },
});

// ═══ EXTRACTED → src/core/ecs_bootstrap.js (iter 583)
// ═══ TICK 3 — ECS Core boot (additive, parallel runtime) ═══════════════════
mountEcsBootstrap({
