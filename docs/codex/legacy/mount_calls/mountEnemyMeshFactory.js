// Legacy clone of mountEnemyMeshFactory call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1105..1105
// (context lines 1101..1109)

resetGameState = _resetSys.resetGameState;
window.resetGameState = resetGameState;

// ── Enemy mesh factory — iter 546 ─────────────────────────────────────────────
const { makeEnemyMesh: _makeEnemyMesh } = mountEnemyMeshFactory({ THREE, scene });
for (const e of enemies) enemyMeshes.set(e.id, _makeEnemyMesh(e));
// Backwards-compat: keep enemyGroup/enemyHpFg pointing to first enemy's mesh
const { group: enemyGroup, hpFg: enemyHpFg } = enemyMeshes.get(enemies[0].id) || {};

