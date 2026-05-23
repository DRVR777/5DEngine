// Legacy clone of mountWorldLayout call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 285..285
// (context lines 281..289)

const WD = window.WorldData || {};

// ═══ EXTRACTED → src/world/world_layout.js (iter 556)
const { buildings, buildingBlockers, buildArenaBoundary: _buildArenaBoundary } =
  mountWorldLayout({ THREE, LayerBoundary, wdBuildings: WD.buildings || [] });

// NPCs — from WorldData schema
const NPC_DEFS = WD.npcs || [];
for (const n of NPC_DEFS) world.setPlayer(n.id, 0, 0, 0, n.u, n.v);
