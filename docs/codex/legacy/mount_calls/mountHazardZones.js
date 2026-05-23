// Legacy clone of mountHazardZones call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1067..1067
// (context lines 1063..1071)

// ═══ EXTRACTED → src/systems/hazard_zones.js (iter 543) ═════════════════════
const {
  spawnFirePatch: _spawnFirePatch, spawnPoisonPuddle: _spawnPoisonPuddle,
  firePatches, poisonPuddles,
} = mountHazardZones({ THREE, scene });

// ═══ EXTRACTED → src/render/pickup_mesh.js (iter 554)
const { pickupMeshes } = mountPickupMeshes({ THREE, scene, pickups });

