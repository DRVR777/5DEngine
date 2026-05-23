// Legacy clone of mountPickupMeshes call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1070..1070
// (context lines 1066..1074)

  firePatches, poisonPuddles,
} = mountHazardZones({ THREE, scene });

// ═══ EXTRACTED → src/render/pickup_mesh.js (iter 554)
const { pickupMeshes } = mountPickupMeshes({ THREE, scene, pickups });

// ═══ EXTRACTED → src/render/npc_mesh.js (iter 552)
const { npcMeshes } = mountNpcMeshFactory({ THREE, scene, npcDefs: NPC_DEFS });

