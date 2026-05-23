// Legacy clone of mountEntityHooks call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 594..613
// (context lines 590..617)

  resetGameState:  () => resetGameState(),
});

// ═══ EXTRACTED → src/systems/entity_hooks.js (iter 587)
mountEntityHooks({
  ARMOR_ABSORB,
  get: {
    heroHp:         () => heroHp,
    heroArmor:      () => heroArmor,
    heroDead:       () => _heroDead,
    HERO_MAX_HP:    () => HERO_MAX_HP,
    perkMaxHpBonus: () => _perkMaxHpBonus,
    dodgeT:         () => _dodgeT,
  },
  set: {
    heroHp:             (v) => { heroHp = v; },
    heroArmor:          (v) => { heroArmor = v; },
    heroLastDamageT:    (v) => { heroLastDamageT = v; },
    waveChallengeNoDmg: (v) => { _waveChallengeNoDmg = v; },
  },
  actions: {
    heroShowDeathScreen: () => _heroShowDeathScreen(),
  },
});
// Dev console hooks
window._teleportHero = function(u, v) {
  world.setPlayer("hero", 0, 0, 0, u, v);
};
