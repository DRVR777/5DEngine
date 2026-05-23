// Legacy clone of mountHeroInventory call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 275..275
// (context lines 271..279)

// ═══ HERO_HITBOX extracted → src/config/hero_stats.js (iter 564) — imported at top
const CFG = window.GameConfig || {};

// ═══ EXTRACTED → src/systems/hero_inventory.js (iter 563)
const { heroInv, heroHealth } = mountHeroInventory({ Inv, Health, CFG });

const world = new WorldState(1);
world.setPlayer("hero", 0, 0, 0, 0, 0);

