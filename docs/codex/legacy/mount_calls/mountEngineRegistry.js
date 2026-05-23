// Legacy clone of mountEngineRegistry call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 841..841
// (context lines 837..845)

// ═══ EXTRACTED → src/systems/nav_achievements_init.js (iter 577)
mountNavAndAchievements({ WD });

// ═══ EXTRACTED → src/core/engine_registry.js (iter 575)
mountEngineRegistry();

// ═══ EXTRACTED → src/render/renderer.js (iter 567)
const { renderer, camera } = mountRenderer({ THREE, getComposer: () => composer });
// ═══ EXTRACTED → src/render/post_processing.js (iter 571)
