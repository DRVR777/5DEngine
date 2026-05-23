// Legacy clone of mountHudElements call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1589..1589
// (context lines 1585..1593)

// ═══ EXTRACTED → src/config/movement_stats.js (iter 565)
const { GRAVITY, JUMP_V, WALK, SPRINT } = makeMovementStats(CFG);

// ---- main loop ----
const { dom: _dom, hud, mini, MINI_HALF, dmgDirSvg: _dmgDirSvg, dmgDirG: _dmgDirG } = mountHudElements(CFG);

// ═══ EXTRACTED → src/ui/minimap.js ═══════════════════════════════════════════
// drawMinimap() — full 250-line body moved to Minimap.draw(ctx, state)
// ═════════════════════════════════════════════════════════════════════════════
