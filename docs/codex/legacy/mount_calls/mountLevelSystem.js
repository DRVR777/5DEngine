// Legacy clone of mountLevelSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 918..944
// (context lines 914..948)

  },
});

// Kill leveling — extracted to src/systems/level_system.js
const _levelSys = mountLevelSystem({
  get: {
    heroLvlDmgMul:    () => _heroLvlDmgMul,
    heroLvlSpeedBonus:() => _heroLvlSpeedBonus,
    heroExtraStaminaMax: () => _heroExtraStaminaMax,
    stamina:          () => _stamina,
    STAMINA_MAX:      () => STAMINA_MAX,
    heroHp:           () => heroHp,
    HERO_MAX_HP:      () => HERO_MAX_HP,
    heroPos:          () => world.players.get("hero"),
  },
  set: {
    heroLvlDmgMul:    (v) => { _heroLvlDmgMul = v; },
    heroLvlSpeedBonus:(v) => { _heroLvlSpeedBonus = v; },
    heroExtraStaminaMax: (v) => { _heroExtraStaminaMax = v; },
    stamina:          (v) => { _stamina = v; },
    heroHp:           (v) => { heroHp = v; },
    heroApexMode:     (v) => { _heroApexMode = v; },
  },
  actions: {
    spawnParticles:    (u, y, v, n, c, s, sz) => _spawnParticles(u, y, v, n, c, s, sz),
    showToast:         (msg, type, dur) => showToast(msg, type, dur),
    playSfx:           (t, v) => playSfx(t, v),
    addKillFeedEntry:  (text, color) => _addKillFeedEntry(text, color),
    setHeroLevelHud:   (text) => { const el = _dom.heroLevelHud; if (el) el.textContent = text; },
  },
});
const _applyLevelUpBuff = _levelSys.applyLevelUpBuff;

// ═══ EXTRACTED → src/render/skybox.js (iter 555)
const { skyboxPresets: _skyboxPresets } = mountSkybox({ THREE, scene, ambLight: _ambLight, sun, showToast });
