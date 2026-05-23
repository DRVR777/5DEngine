// Legacy clone of mountWaveEvents call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 866..901
// (context lines 862..905)

const { ambLight: _ambLight, sun } = mountLighting({ THREE, scene, Engine, renderer });

// ═══ EXTRACTED → src/systems/wave_events.js (iter 684)
if (typeof WaveManager !== "undefined") {
  mountWaveEvents({
    WaveManager, Engine, THREE, scene, ambLight: _ambLight, sun,
    get: {
      score: () => score,         heroHp: () => heroHp,         HERO_MAX_HP: () => HERO_MAX_HP,
      perkMaxHpBonus: () => _perkMaxHpBonus,
      shotsFired: () => _shotsFired,       shotsHit: () => _shotsHit,
      waveChallenge: () => _waveChallenge, waveChallengeStart: () => _waveChallengeStart,
      waveChallengeHits: () => _waveChallengeHits, waveChallengeNoDmg: () => _waveChallengeNoDmg,
      bulletTimeLeft: () => _bulletTimeLeft, enemyKills: () => enemyKills,
      crates: () => crates,        barrels: () => barrels,
      skyboxPresets: () => _skyboxPresets,
    },
    set: {
      score: v => { score = v; },        heroHp: v => { heroHp = v; },
      waveChallenge: v => { _waveChallenge = v; },
      waveChallengeStart: v => { _waveChallengeStart = v; },
      waveChallengeHits: v => { _waveChallengeHits = v; },
      waveChallengeNoDmg: v => { _waveChallengeNoDmg = v; },
      eliteSpawnedThisWave: v => { _eliteSpawnedThisWave = v; },
      shotsFired: v => { _shotsFired = v; }, shotsHit: v => { _shotsHit = v; },
      bulletTimeLeft: v => { _bulletTimeLeft = v; },
    },
    actions: {
      showToast, playSfx: (str, vol) => playSfx(str, vol),
      addKillFeedEntry: _addKillFeedEntry, applyScreenShake: amt => _applyScreenShake(amt),
      spawnSpeedOrb: (u, v) => _spawnSpeedOrb(u, v),
      showPerkPicker: w => _showPerkPicker(w), checkHighScore: (k, w, a) => _checkHighScore(k, w, a),
      exitPointerLock: () => { document.exitPointerLock && document.exitPointerLock(); },
      getWaveChallengeHud: () => _dom.waveChallengeHud,
      getWaveClearBanner: () => document.getElementById("waveClearBanner"),
      getWaveClearTitle:  () => document.getElementById("waveClearTitle"),
      getWaveClearSub:    () => document.getElementById("waveClearSub"),
      getVictoryOverlay:  () => document.getElementById("victoryOverlay"),
      getVictoryStats:    () => document.getElementById("victoryStats"),
    },
  });
}

// ═══ EXTRACTED → src/systems/difficulty_select.js (iter 579)
mountDifficultySelect({
