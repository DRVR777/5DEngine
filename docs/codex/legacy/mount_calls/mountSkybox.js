// Legacy clone of mountSkybox call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 948..948
// (context lines 944..952)

});
const _applyLevelUpBuff = _levelSys.applyLevelUpBuff;

// ═══ EXTRACTED → src/render/skybox.js (iter 555)
const { skyboxPresets: _skyboxPresets } = mountSkybox({ THREE, scene, ambLight: _ambLight, sun, showToast });

// ═══ EXTRACTED → src/render/environment.js (iter 548)
const { skyUniforms, ground, sky, grid } = mountEnvironment({ THREE, scene, buildings });

