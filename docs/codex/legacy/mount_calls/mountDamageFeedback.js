// Legacy clone of mountDamageFeedback call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 810..814
// (context lines 806..818)

});
let _heroEmpT = 0;    // seconds sprinting is disabled (robot EMP burst debuff)
let _camShakeAmt = 0;
// ═══ EXTRACTED → src/systems/damage_feedback.js (iter 589)
const { flashDamage, applyScreenShake: _applyScreenShake } = mountDamageFeedback({
  get: { heroHp: () => heroHp, nearDeathFired: () => _nearDeathFired, bulletTimeLeft: () => _bulletTimeLeft, hitPunchPitch: () => _hitPunchPitch, camShakeAmt: () => _camShakeAmt },
  set: { waveChallengeNoDmg: v => { _waveChallengeNoDmg = v; }, vignetteAmt: v => { _vignetteAmt = v; }, nearDeathFired: v => { _nearDeathFired = v; }, bulletTimeLeft: v => { _bulletTimeLeft = v; }, hitPunchPitch: v => { _hitPunchPitch = v; }, camShakeAmt: v => { _camShakeAmt = v; } },
  actions: { playSfx: (...a) => playSfx(...a), showToast },
});

// Click-to-shoot handler is registered later, after `renderer` is created
// (it accesses renderer.domElement, scene, camYaw, pointerLocked, invDiv —
// all of which are declared further down).
