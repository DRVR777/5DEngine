// Legacy clone of mountWeaponSelector call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 734..737
// (context lines 730..741)

const getAmmo    = _wAmmo.getAmmo;
const setAmmo    = _wAmmo.setAmmo;
const weaponAmmo = _wAmmo.weaponAmmo;
// Weapon selector bar — momentarily shown when switching
const _weaponSelector = mountWeaponSelector({
  getCFG: () => (typeof CFG !== "undefined" ? CFG : {}),
  getActiveWeaponId: () => currentWeaponId,
});
const _showWeaponSelector = () => _weaponSelector.show();

// Shooting state
const bullets3D = [];
