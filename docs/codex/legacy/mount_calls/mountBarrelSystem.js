// Legacy clone of mountBarrelSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1766..1805
// (context lines 1762..1809)

const _tryDroneShoot = _shootSys.tryDroneShoot;
const _getAimAngle   = _shootSys.getAimAngle;

// ── Barrel system — iter 540 ─────────────────────────────────────────────────
const { makeBarrel: _makeBarrel, explodeBarrel: _explodeBarrel, barrels } = mountBarrelSystem({
  THREE, scene, enemies, world,
  coinByType:    _COIN_BY_TYPE,
  weaponDropMap: _WEAPON_DROP_MAP,
  get: {
    heroDead:   () => _heroDead,
    heroHp:     () => heroHp,
    dodgeT:     () => _dodgeT,
    enemyKills: () => enemyKills,
    comboCount: () => _comboCount,
    comboLastT: () => _comboLastT,
  },
  set: {
    heroHp:           (v) => { heroHp = v; },
    heroLastDamageT:  (v) => { heroLastDamageT = v; },
    enemyKills:       (v) => { enemyKills = v; },
    comboCount:       (v) => { _comboCount = v; },
    comboLastT:       (v) => { _comboLastT = v; },
    heroKbU:          (v) => { _heroKbU = v; },
    heroKbV:          (v) => { _heroKbV = v; },
    heroKbT:          (v) => { _heroKbT = v; },
  },
  actions: {
    playSfx,
    spawnParticles:      _spawnParticles,
    triggerMuzzleFlash:  _triggerMuzzleFlash,
    spawnDecal:          _spawnDecal,
    spawnFirePatch:      _spawnFirePatch,
    spawnPoisonPuddle:   _spawnPoisonPuddle,
    addKillFeedEntry:    _addKillFeedEntry,
    trackKillAndPanic:   _trackKillAndPanic,
    spawnCoinDrop:       _spawnCoinDrop,
    spawnAmmoPickup:     _spawnAmmoPickup,
    spawnHealthPickup:   _spawnHealthPickup,
    spawnWeaponPickup:   _spawnWeaponPickup,
    applyScreenShake:    _applyScreenShake,
    flashDamage,
    heroShowDeathScreen: _heroShowDeathScreen,
  },
});

window._loadingDismissed = false;
const _platformSys = mountPlatformSystem();
const _vehicleRenderTick = mountVehicleRenderTick();
