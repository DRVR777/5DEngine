// Legacy clone of mountComputerMesh call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1111..1111
// (context lines 1107..1115)

// Backwards-compat: keep enemyGroup/enemyHpFg pointing to first enemy's mesh
const { group: enemyGroup, hpFg: enemyHpFg } = enemyMeshes.get(enemies[0].id) || {};

// ═══ EXTRACTED → src/render/computer_mesh.js (iter 554)
const { compGroup, screenFront } = mountComputerMesh({ THREE, scene, computerEntity });

// Hoist worldScreens here so the mon1-mirror code below can populate it
// (the rest of the in-world screen setup happens further down).
const worldScreens = new Map();
