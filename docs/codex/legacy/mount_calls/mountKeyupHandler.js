// Legacy clone of mountKeyupHandler call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1463..1483
// (context lines 1459..1487)

  },
  weaponDropMap: _WEAPON_DROP_MAP,
  coinByType:    _COIN_BY_TYPE,
});;
mountKeyupHandler({
  keys,
  getState: () => ({
    buildMode, computerOpen, _heroDead, _grenadePressT,
    heroHp, world, grenadeCount,
  }),
  set: {
    grenadePressT: (v) => { _grenadePressT = v; },
    heroHp:        (v) => { heroHp = v; },
    grenadeCount:  (v) => { grenadeCount = v; },
  },
  actions: {
    flashDamage:        flashDamage,
    applyScreenShake:   _applyScreenShake,
    spawnParticles:     _spawnParticles,
    playSfx:            playSfx,
    showToast:          showToast,
    heroShowDeathScreen:_heroShowDeathScreen,
    throwGrenade:       _throwGrenade,
  },
});

// ════════════════════════════════════════════════════════════════════════════
// CAMERA STATE
// camYaw/camPitch — mouse-driven orientation (radians)
