// Legacy clone of mountMediaPickups call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1132..1132
// (context lines 1128..1136)

  worldScreens,
});

// ═══ EXTRACTED → src/systems/media_pickups.js (iter 574)
const { heroMedia, worldMedia, spawnMedia: _spawnMedia, tick: _mediaPickupsTick } = mountMediaPickups({ THREE, scene, actions: { playSfx: (str, vol) => playSfx(str, vol) } });
_spawnMedia({ id: "cd_mix", kind: "cd", label: "MIX_2026",
              files: { "/track1.wav": "(440Hz sine)", "/track2.wav": "(beep loop)",
                       "/readme.txt": "Burned by jumbotron HYPE crew" } },
            { u: -2, v: 2, y: 1.0 });
