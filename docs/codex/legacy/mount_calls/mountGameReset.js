// Legacy clone of mountGameReset call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1079..1100
// (context lines 1075..1104)

// Enemy meshes — one group per enemy def
const enemyMeshes = new Map();  // enemy.id → { group, hpFg }

// Game reset — full session teardown (all arrays declared above this point)
const _resetSys = mountGameReset({
  scene, world, Inv, CFG,
  enemies, enemyMeshes,
  bullets3D, enemyBullets, grenades3D,
  smokeZones, firePatches, poisonPuddles,
  wallScorches: _wallScorches, armorShards,
  speedOrbs: _speedOrbs, weaponPickups,
  heroInv, weaponAmmo,
  actions: {
    gadgetClearAll:    () => gadget.clearAll(),
    heroRespawn:       () => _heroRespawn(),
    waveRestart:       () => { if (typeof WaveManager !== "undefined" && gameMode !== "peaceful") { WaveManager.reset(); WaveManager.start(); } },
    resetWeapon:       () => { currentWeaponId = "pistol"; pistolAmmo = (CFG.weapons.find(w => w.id === "pistol") || { magCap: 12 }).magCap; if (typeof _switchGunMesh === "function") _switchGunMesh("pistol"); },
    resetGrenades:     () => { grenadeCount = 3; smokeGrenadeCount = 2; flashbangCount = 2; _mineCount = 2; },
    resetStats:        () => { score = 0; enemyKills = 0; _shotsFired = 0; _shotsHit = 0; _damageDealt = 0; _comboCount = 0; _comboAnnouncedMul = 0; _streakCount = 0; _lastKillT = 0; _waveBeepLast = 0; _killTracking.resetPanic(); },
    resetLevel:        () => { _heroLevel = 0; _heroLvlDmgMul = 1.0; _heroLvlSpeedBonus = 0; _heroApexMode = false; _heroExtraStaminaMax = 0; _eliteSpawnedThisWave = false; },
    resetPerks:        () => { _perkDmgMul = 1.0; _perkReloadMul = 1.0; _perkMaxHpBonus = 0; _perkLifesteal = false; _perkRegenBonus = 0; _perkSpeedBonus = 0; _perkSys.clearTimerAndReset(); },
    hidePerkPicker:    () => { const el = document.getElementById("perkPicker"); if (el) el.style.display = "none"; },
    refreshPerkHud:    () => _refreshPerkHud(),
    clearHeroLevelHud: () => { const el = _dom.heroLevelHud; if (el) el.textContent = ""; },
  },
});
resetGameState = _resetSys.resetGameState;
window.resetGameState = resetGameState;

// ── Enemy mesh factory — iter 546 ─────────────────────────────────────────────
