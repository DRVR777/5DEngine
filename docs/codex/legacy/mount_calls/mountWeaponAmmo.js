// Legacy clone of mountWeaponAmmo call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 725..728
// (context lines 721..732)


// Weapon registry — look up active weapon from CFG.weapons by id
let currentWeaponId = "pistol";
// ═══ EXTRACTED → src/systems/weapon_ammo.js (iter 588)
const _wAmmo = mountWeaponAmmo({
  getWeapons:        () => (typeof CFG !== "undefined" ? CFG.weapons : []),
  getActiveWeaponId: () => currentWeaponId,
});
const getWeapon  = _wAmmo.getWeapon;
const getAmmo    = _wAmmo.getAmmo;
const setAmmo    = _wAmmo.setAmmo;
const weaponAmmo = _wAmmo.weaponAmmo;
