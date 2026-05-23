// Legacy clone of mountVictoryPlayAgain call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 558..558
// (context lines 554..562)

const _heroRespawn         = _lifecycle.heroRespawn;
const _tickDeath           = _lifecycle.tickDeath;

// ═══ EXTRACTED → src/systems/victory_overlay.js (iter 580)
mountVictoryPlayAgain({ resetGameState: () => resetGameState() });

// resetGameState is mounted below (after all array deps are declared, ~line 1988)
// Forward-declared so victory IIFE closure can capture the binding safely.
let resetGameState;
