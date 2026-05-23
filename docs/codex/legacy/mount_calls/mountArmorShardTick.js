// Legacy clone of mountArmorShardTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1815..1815
// (context lines 1811..1819)

const _layerBldgName = id => ({ 2:"shop", 3:"tower", 4:"house", 5:"garage", 6:"diner", 7:"bank", 8:"park", 9:"studio" })[id] || `L${id}`;
const _layerTransTick    = mountLayerTransitionTick({ get: { layerId: () => world.layerId }, actions: { boundaryAt: (u, v, blds) => world.boundaryAt(u, v, blds), bldgName: id => _layerBldgName(id), logTransition: (from, to) => world.logTransition("hero", from, to, "phase_shift"), showToast: (msg, type, dur) => showToast(msg, type, dur), playSfx: (str, vol) => playSfx(str, vol) } });
const _ammoPickupTick    = mountAmmoPickupTick({ actions: { removeMesh: mesh => scene.remove(mesh), addAmmo: (item, qty) => Inv.addItem(heroInv, item || getWeapon().ammoItem || "pistol_9mm", qty), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c) } });
const _healthPickupTick  = mountHealthPickupTick({ get: { heroHp: () => heroHp, maxHp: () => HERO_MAX_HP }, set: { heroHp: v => { heroHp = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _armorShardTick    = mountArmorShardTick({ get: { heroArmor: () => heroArmor, maxArmor: () => HERO_MAX_ARMOR }, set: { heroArmor: v => { heroArmor = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _speedOrbTick      = mountSpeedOrbTick({ set: { speedBoostT: v => { _speedBoostT = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _poisonPuddleTick  = mountPoisonPuddleTick({ actions: { removeMesh: mesh => scene.remove(mesh), applyPoison: () => { if (typeof StatusEffects !== "undefined") StatusEffects.apply("hero", "poison"); } } });
const _smokeZoneTick     = mountSmokeZoneTick({ actions: { spawnSmoke: (u, y, v) => _spawnParticles(u, y, v, 1, "white", 0.6, 0.9) } });
const _grenadeCrateTick  = mountGrenadeCrateTick({ get: { grenadeCount: () => grenadeCount }, set: { grenadeCount: v => { grenadeCount = v; } }, actions: { playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
