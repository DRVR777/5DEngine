// Legacy clone of mountWorldBuilderHotbar call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1166..1181
// (context lines 1162..1185)

    },
  });

  // Pseudocode: hotbar, creative inventory, textures, grouping, and coop build sync.
  mountWorldBuilderHotbar({
    worldBuilder,
    get: {
      heroPos: () => world.players.get("hero"),
      camYaw: () => camYaw,
      gameMode: () => gameMode,
      mp: () => _mpRef,
      mpState: () => _mpState,
    },
    actions: {
      playSfx,
      showToast,
      warn: (...args) => console.warn(...args),
      setInterval: (fn, ms) => setInterval(fn, ms),
    },
  });
}, 250);

// Pseudocode: each frame, show/hide builder UI and mirror selected transform.
const _refreshBuilderUI = mountBuilderUiRefresh({
