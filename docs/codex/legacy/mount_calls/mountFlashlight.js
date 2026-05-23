// Legacy clone of mountFlashlight call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 995..995
// (context lines 991..999)

// function _triggerMuzzleFlash(x, y, z) { _muzzleLight.position.set(x, y, z); ... }
// ═════════════════════════════════════════════════════════════════════════════

// ═══ EXTRACTED → src/render/flashlight.js (iter 559)
const { flashLight: _flashLight, flashTarget: _flashTarget, tick: _flashlightTick } = mountFlashlight({ THREE, scene, getCamera: () => camera });
let _flashlightOn = false;

// ═══ EXTRACTED → src/render/vfx.js ═══════════════════════════════════════════
// _spawnParticles and _tickParticles moved to Vfx module.
