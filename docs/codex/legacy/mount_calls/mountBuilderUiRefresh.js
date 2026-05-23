// Legacy clone of mountBuilderUiRefresh call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1185..1191
// (context lines 1181..1195)

  });
}, 250);

// Pseudocode: each frame, show/hide builder UI and mirror selected transform.
const _refreshBuilderUI = mountBuilderUiRefresh({
  get: { buildMode: () => buildMode, worldBuilder: () => worldBuilder },
  actions: {
    renderSceneHierarchy: _renderSceneHierarchy,
    getScriptRunner: () => window.ScriptRunner || null,
  },
});

// ---- audio mixer (audio.js + audio_webaudio.js) --------------------
let audioMixer = null;
if (window.GTAAudio && window.WebAudioAdapter) {
