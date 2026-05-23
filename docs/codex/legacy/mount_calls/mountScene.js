// Legacy clone of mountScene call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 826..826
// (context lines 822..830)

const pickups = (WD.pickups || []).map(p => Object.assign({ collected: false }, p));
let score = 0;

// ── Three.js scene — ═══ EXTRACTED → src/render/scene_setup.js (iter 570)
const { scene } = mountScene({ THREE });
window._setFogNear = v => { if (scene.fog) scene.fog.near = v; };
window._setFogFar  = v => { if (scene.fog) scene.fog.far  = v; };
_buildArenaBoundary(scene); // deferred here — scene now exists

