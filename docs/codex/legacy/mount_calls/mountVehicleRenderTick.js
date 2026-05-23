// Legacy clone of mountVehicleRenderTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1809..1809
// (context lines 1805..1813)

});

window._loadingDismissed = false;
const _platformSys = mountPlatformSystem();
const _vehicleRenderTick = mountVehicleRenderTick();
const _heroRegenTick     = mountHeroRegenTick({ get: { heroHp: () => heroHp, maxHp: () => HERO_MAX_HP, perkMaxHpBonus: () => _perkMaxHpBonus, lastDamageT: () => heroLastDamageT, regenDelay: () => HERO_REGEN_DELAY, regenRate: () => HERO_REGEN_RATE, perkRegenBonus: () => _perkRegenBonus }, set: { heroHp: v => { heroHp = v; }, nearDeathFired: v => { _nearDeathFired = v; } } });
const _layerBldgName = id => ({ 2:"shop", 3:"tower", 4:"house", 5:"garage", 6:"diner", 7:"bank", 8:"park", 9:"studio" })[id] || `L${id}`;
const _layerTransTick    = mountLayerTransitionTick({ get: { layerId: () => world.layerId }, actions: { boundaryAt: (u, v, blds) => world.boundaryAt(u, v, blds), bldgName: id => _layerBldgName(id), logTransition: (from, to) => world.logTransition("hero", from, to, "phase_shift"), showToast: (msg, type, dur) => showToast(msg, type, dur), playSfx: (str, vol) => playSfx(str, vol) } });
const _ammoPickupTick    = mountAmmoPickupTick({ actions: { removeMesh: mesh => scene.remove(mesh), addAmmo: (item, qty) => Inv.addItem(heroInv, item || getWeapon().ammoItem || "pistol_9mm", qty), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c) } });
