// Legacy clone of mountSniperSway call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1695..1695
// (context lines 1691..1699)

let _wasSniperScope = false;
let _sniperSavedCamDist = 7; // camDist restored when scope is dropped
let _lastSwayPitch = 0;  // sway offset applied last frame — subtracted before re-applying
let _lastSwayYaw   = 0;
const _sniperSway = mountSniperSway({ get: { scopeSwayT: () => _scopeSwayT, breathHoldT: () => _breathHoldT, lastSwayPitch: () => _lastSwayPitch, lastSwayYaw: () => _lastSwayYaw, camPitch: () => camPitch, camYaw: () => camYaw }, set: { scopeSwayT: v => { _scopeSwayT = v; }, breathHoldT: v => { _breathHoldT = v; }, lastSwayPitch: v => { _lastSwayPitch = v; }, lastSwayYaw: v => { _lastSwayYaw = v; }, camPitch: v => { camPitch = v; }, camYaw: v => { camYaw = v; } } });
let _grenadePressT = 0;   // performance.now() when G was pressed (0 = not held)
let _heroKbU = 0, _heroKbV = 0, _heroKbT = 0; // knockback burst from heavy/boss melee
let _enFsT = 0;   // global enemy-footstep timer — plays for nearest approaching enemy
let _heroShotAlertU = 0, _heroShotAlertV = 0, _heroShotAlertT = 0; // last shot pos alert to nearby enemies
