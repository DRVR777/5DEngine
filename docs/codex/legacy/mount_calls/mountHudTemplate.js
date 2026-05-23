// Legacy clone of mountHudTemplate call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 250..250
// (context lines 246..254)

// mountPostProcessing call is placed after mountRenderer (line ~824) so renderer+camera are live.
let composer = null;

// inject all HUD/panel HTML before any getElementById runs
mountHudTemplate();

// ════════════════════════════════════════════════════════════════════════════
// ENGINE BOOTSTRAP — null guards, aliases, world setup
// ════════════════════════════════════════════════════════════════════════════
