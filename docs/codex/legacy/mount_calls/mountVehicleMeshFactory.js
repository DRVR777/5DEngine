// Legacy clone of mountVehicleMeshFactory call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1037..1037
// (context lines 1033..1041)

  }
});

// ── Vehicle mesh factory — iter 547 ──────────────────────────────────────────
const { makeVehicleMesh: _makeVehicleMesh } = mountVehicleMeshFactory({ THREE });

// ═══ EXTRACTED → src/render/vehicle_meshes.js (iter 558)
const { vehicleMeshes, carGroup, carBody } = mountVehicleMeshes({ THREE, scene, vehicleDefs: VEHICLE_DEFS, makeVehicleMesh: _makeVehicleMesh });

