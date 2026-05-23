// Legacy clone of mountParticleAndTerrain call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 832..832
// (context lines 828..836)

window._setFogFar  = v => { if (scene.fog) scene.fog.far  = v; };
_buildArenaBoundary(scene); // deferred here — scene now exists

// ═══ EXTRACTED → src/systems/particle_terrain_init.js (iter 578)
mountParticleAndTerrain({ THREE, scene, showToast });

// ═══ EXTRACTED → src/systems/trigger_zone_init.js (iter 576)
mountTriggerZoneInit({ THREE, scene, showToast });

