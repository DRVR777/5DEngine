// Legacy clone of mountNavAndAchievements call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 838..838
// (context lines 834..842)

// ═══ EXTRACTED → src/systems/trigger_zone_init.js (iter 576)
mountTriggerZoneInit({ THREE, scene, showToast });

// ═══ EXTRACTED → src/systems/nav_achievements_init.js (iter 577)
mountNavAndAchievements({ WD });

// ═══ EXTRACTED → src/core/engine_registry.js (iter 575)
mountEngineRegistry();

