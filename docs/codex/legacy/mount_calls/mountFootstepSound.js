// Legacy clone of mountFootstepSound call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1684..1684
// (context lines 1680..1688)

let _sprintFovAmt = 0; // spring [0..1]: pushes FOV wider while sprinting
let _moveSpread = 0;   // spring: accuracy penalty while moving/sprinting
let _hitPunchPitch = 0; // spring: upward camera kick when taking damage
let _footstepT = 0;    // seconds until next footstep tick
const _footstepSnd = mountFootstepSound({ get: { footstepT: () => _footstepT }, set: { footstepT: v => { _footstepT = v; } }, actions: { playSfx } });
let _gunBobPhase = 0;  // oscillation phase for FP weapon bob
let _strafeRollAmt = 0; // spring [−1..1]: FP camera roll when strafing
const _motionSprings = mountMotionSprings({ get: { moveSpread: () => _moveSpread, gunBobPhase: () => _gunBobPhase, strafeRollAmt: () => _strafeRollAmt }, set: { moveSpread: v => { _moveSpread = v; }, gunBobPhase: v => { _gunBobPhase = v; }, strafeRollAmt: v => { _strafeRollAmt = v; } } });
let _lowAmmoWarnedAt = -1; // magCap at last low-ammo beep (avoid repeat beep per mag)
