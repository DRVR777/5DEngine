// Legacy clone of mountDecalSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 972..972
// (context lines 968..976)

// _makeCrate, _breakCrate, crates — mounted below after all deps declared

// ═══ EXTRACTED → src/render/decals.js (iter 539) ════════════════════════════
const { spawnDecal: _spawnDecal, spawnWallScorch: _spawnWallScorch, wallScorches: _wallScorches } =
  mountDecalSystem({ THREE, scene });

// ═══ EXTRACTED → src/render/vfx.js ═══════════════════════════════════════════
// All of the following was moved to Vfx module (particles, casings, damage
// numbers, warn ring geo, shockwaves). Aliases live at the Vfx.init() block
