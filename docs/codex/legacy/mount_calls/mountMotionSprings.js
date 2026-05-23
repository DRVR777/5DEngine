// Legacy clone of mountMotionSprings call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1687..1687
// (context lines 1683..1691)

let _footstepT = 0;    // seconds until next footstep tick
const _footstepSnd = mountFootstepSound({ get: { footstepT: () => _footstepT }, set: { footstepT: v => { _footstepT = v; } }, actions: { playSfx } });
let _gunBobPhase = 0;  // oscillation phase for FP weapon bob
let _strafeRollAmt = 0; // spring [−1..1]: FP camera roll when strafing
const _motionSprings = mountMotionSprings({ get: { moveSpread: () => _moveSpread, gunBobPhase: () => _gunBobPhase, strafeRollAmt: () => _strafeRollAmt }, set: { moveSpread: v => { _moveSpread = v; }, gunBobPhase: v => { _gunBobPhase = v; }, strafeRollAmt: v => { _strafeRollAmt = v; } } });
let _lowAmmoWarnedAt = -1; // magCap at last low-ammo beep (avoid repeat beep per mag)
let _scopeSwayT = 0;      // accumulates real time for sniper scope sway oscillation
let _breathHoldT = 0;    // seconds Shift held while scoped (>1.5s causes trembling)
let _wasSniperScope = false;
