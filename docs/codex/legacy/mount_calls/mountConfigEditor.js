// Legacy clone of mountConfigEditor call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1011..1011
// (context lines 1007..1015)

// ---- Hero animation system (AnimationMixer) --------------------------------
const heroAnim = createHeroAnimSystem(THREE, heroGroup);

// ---- Game Config Editor (K key in build mode) ----
const cfgEditor = mountConfigEditor(window.GameConfig || {});

// ---- Scene Hierarchy panel ----
const _renderSceneHierarchy = mountSceneHierarchy({ getWorldBuilder: () => worldBuilder, scene });

