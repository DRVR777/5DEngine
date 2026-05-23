// Legacy clone of mountGadgetSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1244..1309
// (context lines 1240..1313)

jumbotronScreen = _worldScreens.jumbotronScreen;
skyScreen = _worldScreens.skyScreen;

// ---- gadget system (turrets, mines, grenades) ----
const gadget = mountGadgetSystem({
  THREE, scene, world, enemies, bullets3D, grenades3D, smokeZones,
  HERO_MAX_ARMOR, ARMOR_ABSORB,
  coinByType: _COIN_BY_TYPE,
  weaponDropMap: _WEAPON_DROP_MAP,
  get: {
    grenadeCount:      () => grenadeCount,
    smokeGrenadeCount: () => smokeGrenadeCount,
    flashbangCount:    () => flashbangCount,
    mineCount:         () => _mineCount,
    buildMode:         () => buildMode,
    computerOpen:      () => computerOpen,
    heroDead:          () => _heroDead,
    dodgeT:            () => _dodgeT,
    camYaw:            () => camYaw,
    inCar:             () => inCar,
    heroArmor:         () => heroArmor,
    heroHp:            () => heroHp,
    heroLastDamageT:   () => heroLastDamageT,
    score:             () => score,
    enemyKills:        () => enemyKills,
    comboCount:        () => _comboCount,
    comboLastT:        () => _comboLastT,
    heroLevel:         () => _heroLevel,
    levelThresholds:   () => _LEVEL_THRESHOLDS,
    shopIsOpen:        () => _shop.isOpen,
    bulletGeo:         () => bulletGeo,
    bulletMat:         () => bulletMat,
  },
  set: {
    grenadeCount:      (v) => { grenadeCount = v; },
    smokeGrenadeCount: (v) => { smokeGrenadeCount = v; },
    flashbangCount:    (v) => { flashbangCount = v; },
    mineCount:         (v) => { _mineCount = v; },
    heroArmor:         (v) => { heroArmor = v; },
    heroHp:            (v) => { heroHp = v; },
    heroLastDamageT:   (v) => { heroLastDamageT = v; },
    score:             (v) => { score = v; },
    enemyKills:        (v) => { enemyKills = v; },
    comboCount:        (v) => { _comboCount = v; },
    comboLastT:        (v) => { _comboLastT = v; },
    heroKbU:           (v) => { _heroKbU = v; },
    heroKbV:           (v) => { _heroKbV = v; },
    heroKbT:           (v) => { _heroKbT = v; },
    heroBlindT:        (v) => { _heroBlindT = v; },
  },
  actions: {
    spawnParticles:      _spawnParticles,
    playSfx,
    showToast,
    spawnDamageNumber:   _spawnDamageNumber,
    spawnDecal:          _spawnDecal,
    spawnCoinDrop:       _spawnCoinDrop,
    spawnAmmoPickup:     _spawnAmmoPickup,
    spawnHealthPickup:   _spawnHealthPickup,
    spawnWeaponPickup:   _spawnWeaponPickup,
    spawnFirePatch:      _spawnFirePatch,
    spawnPoisonPuddle:   _spawnPoisonPuddle,
    addKillFeedEntry:    _addKillFeedEntry,
    trackKillAndPanic:   _trackKillAndPanic,
    applyScreenShake:    _applyScreenShake,
    flashDamage,
    heroShowDeathScreen: _heroShowDeathScreen,
    applyLevelUpBuff:    _applyLevelUpBuff,
  },
});
const _deploySmokeZone   = gadget.deploySmokeZone;
const _placeTurret       = gadget.placeTurret;
const _tickTurrets       = gadget.tickTurrets;
const _dropMine          = gadget.dropMine;
