// Legacy clone of mountRenderer call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 2
// game.html lines 246..246
// (context lines 242..250)

// ═══ EXTRACTED → src/render/loaders.js (iter 572)
const { Loaders } = mountLoaders();

// Post-processing — ═══ EXTRACTED → src/render/post_processing.js (iter 571)
// mountPostProcessing call is placed after mountRenderer (line ~824) so renderer+camera are live.
let composer = null;

// inject all HUD/panel HTML before any getElementById runs
mountHudTemplate();


// occurrence 2 of 2
// game.html lines 844..844
// (context lines 840..848)

// ═══ EXTRACTED → src/core/engine_registry.js (iter 575)
mountEngineRegistry();

// ═══ EXTRACTED → src/render/renderer.js (iter 567)
const { renderer, camera } = mountRenderer({ THREE, getComposer: () => composer });
// ═══ EXTRACTED → src/render/post_processing.js (iter 571)
mountPostProcessing({ THREE, renderer, scene, camera, onReady: c => { composer = c; } });

// ── VFX MODULE INIT ──────────────────────────────────────────────────────────
