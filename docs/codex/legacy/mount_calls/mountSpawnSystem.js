// Legacy clone of mountSpawnSystem call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 2
// game.html lines 494..494
// (context lines 490..498)

  (WD.entities && WD.entities.computer) || { id: "pc1", u: -4, v: 4 }
);

// EXTRACT-PLAN iter 522: spawn_system.js → src/systems/spawn_system.js
// Export mountSpawnSystem({ THREE, scene, buildingBlockers })
// Returns: { addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints, spawnMeshes }
// Replaces: _addSpawnPoint, _getSpawnPoint, _spawnClearPos, _spawnPoints, _spawnMeshes
// ---- Spawn points (N key in build mode places a respawn marker) ----
const _spawnSys     = mountSpawnSystem({ THREE, getScene: () => scene, buildingBlockers });


// occurrence 2 of 2
// game.html lines 498..498
// (context lines 494..502)

// Export mountSpawnSystem({ THREE, scene, buildingBlockers })
// Returns: { addSpawnPoint, getSpawnPoint, spawnClearPos, spawnPoints, spawnMeshes }
// Replaces: _addSpawnPoint, _getSpawnPoint, _spawnClearPos, _spawnPoints, _spawnMeshes
// ---- Spawn points (N key in build mode places a respawn marker) ----
const _spawnSys     = mountSpawnSystem({ THREE, getScene: () => scene, buildingBlockers });
const _spawnPoints  = _spawnSys.spawnPoints;
const _addSpawnPoint  = _spawnSys.addSpawnPoint;
const _getSpawnPoint  = _spawnSys.getSpawnPoint;
const _spawnClearPos  = _spawnSys.spawnClearPos;
