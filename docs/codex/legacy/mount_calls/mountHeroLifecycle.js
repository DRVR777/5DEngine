// Legacy clone of mountHeroLifecycle call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 506..552
// (context lines 502..556)

const _spawnClearPos  = _spawnSys.spawnClearPos;
const _spawnMeshes    = _spawnSys.spawnMeshes;
let _heroDead = false;
// Hero death/respawn lifecycle — mounted here; deathCountdownT is internal to module
const _lifecycle = mountHeroLifecycle({
  get: {
    heroDead:         () => _heroDead,
    shotsFired:       () => _shotsFired,
    shotsHit:         () => _shotsHit,
    damageDealt:      () => _damageDealt,
    enemyKills:       () => enemyKills,
    score:            () => score,
    perkMaxHpBonus:   () => _perkMaxHpBonus,
    HERO_MAX_HP:      () => HERO_MAX_HP,
    STAMINA_MAX:      () => STAMINA_MAX,
  },
  set: {
    heroDead:         (v) => { _heroDead = v; },
    grenadePressT:    (v) => { _grenadePressT = v; },
    heroKbT:          (v) => { _heroKbT = v; },
    heroHp:           (v) => { heroHp = v; },
    heroArmor:        (v) => { heroArmor = v; },
    heroLastDamageT:  (v) => { heroLastDamageT = v; },
    velocityY:        (v) => { velocityY = v; },
    stamina:          (v) => { _stamina = v; },
    shotsFired:       (v) => { _shotsFired = v; },
    shotsHit:         (v) => { _shotsHit = v; },
    damageDealt:      (v) => { _damageDealt = v; },
    comboCount:       (v) => { _comboCount = v; },
    comboAnnouncedMul:(v) => { _comboAnnouncedMul = v; },
    heroFireT:        (v) => { _heroFireT = v; },
    heroEmpT:         (v) => { _heroEmpT = v; },
    heroBlindT:       (v) => { _heroBlindT = v; },
    heroKbU:          (v) => { _heroKbU = v; },
    heroKbV:          (v) => { _heroKbV = v; },
    slideT:           (v) => { _slideT = v; },
    speedBoostT:      (v) => { _speedBoostT = v; },
    bulletTimeLeft:   (v) => { _bulletTimeLeft = v; },
    killMarkerUntil:  (v) => { _killMarkerUntil = v; },
  },
  actions: {
    waveNum:            () => typeof WaveManager !== "undefined" ? WaveManager.getState().wave : 0,
    checkHighScore:     (k, w, a) => HighScore.check(k, w, a),
    highScoreGet:       () => HighScore.get(),
    getSpawnPoint:      () => _getSpawnPoint(),
    worldSetPlayer:     (u, v) => world.setPlayer("hero", 0, 0, 0, u, v),
    playSfx:            (t, v) => playSfx(t, v),
    heroRespawnedEvent: (sp) => { if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.HERO_RESPAWNED, { spawnPoint: sp }); },
    requestPointerLock: () => { const c = typeof renderer !== "undefined" ? renderer.domElement : null; if (c) c.requestPointerLock(); },
  },
});
const _heroShowDeathScreen = _lifecycle.heroShowDeathScreen;
const _heroRespawn         = _lifecycle.heroRespawn;
const _tickDeath           = _lifecycle.tickDeath;

