// Legacy clone of mountWorldBuilderControls call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1155..1163
// (context lines 1151..1167)

  });
  worldBuilder.attachDragDrop();

  // Pseudocode: wire builder buttons, inspector, scene save/load, import/export.
  mountWorldBuilderControls({
    worldBuilder,
    get: { heroPos: () => world.players.get("hero"), camYaw: () => camYaw },
    actions: {
      playSfx,
      getScriptRunner: () => window.ScriptRunner || null,
      info: (...args) => console.info(...args),
    },
  });

  // Pseudocode: hotbar, creative inventory, textures, grouping, and coop build sync.
  mountWorldBuilderHotbar({
    worldBuilder,
