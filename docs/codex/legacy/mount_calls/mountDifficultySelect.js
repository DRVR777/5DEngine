// Legacy clone of mountDifficultySelect call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 905..915
// (context lines 901..919)

  });
}

// ═══ EXTRACTED → src/systems/difficulty_select.js (iter 579)
mountDifficultySelect({
  set: {
    diffHpMul:  (v) => { _diffHpMul = v; },
    diffDmgMul: (v) => { _diffDmgMul = v; },
    diffLabel:  (v) => { _diffLabel = v; },
  },
  showToast,
  actions: {
    requestGameplayPointer,
  },
});

// Kill leveling — extracted to src/systems/level_system.js
const _levelSys = mountLevelSystem({
  get: {
