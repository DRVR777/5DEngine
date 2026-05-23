// Legacy clone of mountSettingsPanel call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 778..784
// (context lines 774..788)

  isBlocked: () => computerOpen || buildMode,
});

// Settings panel — O key opens, Escape closes
const _settings = mountSettingsPanel({
  getCFG: () => (typeof CFG !== "undefined" ? CFG : {}),
  getRenderer: () => renderer,
  getBuildMode: () => buildMode,
  password: "5DENGINE",
  initialSniperSens: 3.0,
});

// Grenade system data — functions mounted via mountGadgetSystem below
const grenades3D = [];
let grenadeCount = 3;
