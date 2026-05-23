// Legacy clone of mountPostProcessing call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 846..846
// (context lines 842..850)


// ═══ EXTRACTED → src/render/renderer.js (iter 567)
const { renderer, camera } = mountRenderer({ THREE, getComposer: () => composer });
// ═══ EXTRACTED → src/render/post_processing.js (iter 571)
mountPostProcessing({ THREE, renderer, scene, camera, onReady: c => { composer = c; } });

// ── VFX MODULE INIT ──────────────────────────────────────────────────────────
// Must happen AFTER both scene and camera exist.
// Vfx.init() allocates shared geometries (sphere, torus, cylinder), materials,
