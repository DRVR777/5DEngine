// Legacy clone of mountSmokeZoneTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1818..1818
// (context lines 1814..1822)

const _healthPickupTick  = mountHealthPickupTick({ get: { heroHp: () => heroHp, maxHp: () => HERO_MAX_HP }, set: { heroHp: v => { heroHp = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _armorShardTick    = mountArmorShardTick({ get: { heroArmor: () => heroArmor, maxArmor: () => HERO_MAX_ARMOR }, set: { heroArmor: v => { heroArmor = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _speedOrbTick      = mountSpeedOrbTick({ set: { speedBoostT: v => { _speedBoostT = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _poisonPuddleTick  = mountPoisonPuddleTick({ actions: { removeMesh: mesh => scene.remove(mesh), applyPoison: () => { if (typeof StatusEffects !== "undefined") StatusEffects.apply("hero", "poison"); } } });
const _smokeZoneTick     = mountSmokeZoneTick({ actions: { spawnSmoke: (u, y, v) => _spawnParticles(u, y, v, 1, "white", 0.6, 0.9) } });
const _grenadeCrateTick  = mountGrenadeCrateTick({ get: { grenadeCount: () => grenadeCount }, set: { grenadeCount: v => { grenadeCount = v; } }, actions: { playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _armorVestTick     = mountArmorVestTick({ get: { heroArmor: () => heroArmor, maxArmor: () => HERO_MAX_ARMOR }, set: { heroArmor: v => { heroArmor = v; } }, actions: { playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur) } });
const _coinDropTick      = mountCoinDropTick({ actions: { removeMesh: mesh => scene.remove(mesh), addScore: v => { score += v; if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.SCORE_CHANGED, { score, delta: v, source: "coin" }); }, playSfx: (str, vol) => playSfx(str, vol), spawnDamageNumber: (u, y, v, t, c) => _spawnDamageNumber(u, y, v, t, c) } });
const _weaponPickupTick  = mountWeaponPickupTick({ get: { currentWeaponId: () => currentWeaponId, currentMag: () => pistolAmmo, currentWeaponAmmoItem: () => getWeapon().ammoItem || "pistol_9mm" }, set: { currentWeaponId: v => { currentWeaponId = v; }, currentMag: v => { pistolAmmo = v; }, weaponSwitchT: v => { _weaponSwitchT = v; } }, actions: { removeMesh: mesh => scene.remove(mesh), findWeaponDef: id => (CFG.weapons || []).find(w => w.id === id) || null, setWeaponAmmo: (id, v) => weaponAmmo.set(id, v), addReserveAmmo: (item, qty) => Inv.addItem(heroInv, item, qty), countReserveAmmo: item => Inv.countItem(heroInv, item), playSfx: (str, vol) => playSfx(str, vol), spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), clearReload: () => { _reloading = false; reloadMsg = ""; reloadMsgUntil = 0; }, switchGunMesh: id => _switchGunMesh(id), showWeaponSelector: () => _showWeaponSelector(), showToast: (msg, type, dur) => showToast(msg, type, dur), addKillFeed: (msg, col) => _addKillFeedEntry(msg, col) } });
