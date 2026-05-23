// Legacy clone of mountFirstLaunch call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2215..2219
// (context lines 2211..2223)

}
requestAnimationFrame(tick);

// ═══ EXTRACTED → src/systems/first_launch.js (iter 586)
mountFirstLaunch({
  getFirstLaunch:      () => _firstLaunch,
  finishComputerEntry: () => finishComputerEntry(),
  getApps:             () => APPS,
});

// ---- High score (separate from save) ----
// ═══ EXTRACTED → src/progression/high_score.js ════════════════════════════════
// const _HS_KEY, let _bestRecord, function _checkHighScore — all moved to module
