// Legacy clone of mountVehicleDashTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1636..1636
// (context lines 1632..1640)

const _vignetteTick  = mountVignetteTick({ get: { vignetteAmt: () => _vignetteAmt }, set: { vignetteAmt: v => { _vignetteAmt = v; } } });
const _statBarsTick  = mountStatBarsTick({ get: { hpGhost: () => _hpGhost }, set: { hpGhost: v => { _hpGhost = v; } } });
const _bossBarTick   = mountBossBarTick();
const _comboHudTick    = mountComboHudTick();
const _vehicleDashTick = mountVehicleDashTick();
let _combatAmbT = 0;
const _combatAmbientTick = mountCombatAmbientTick({ get: { ambT: () => _combatAmbT }, set: { ambT: v => { _combatAmbT = v; } }, actions: { isAmbientReady: () => Sfx.isAmbientReady(), setAmbient: (k, f, t, v, fade) => _setAmbient(k, f, t, v, fade) } });
const _skyDayNightTick   = mountSkyDayNightTick({ actions: { setTopColor: (r,g,b) => skyUniforms.topColor.value.setRGB(r,g,b), setBottomColor: (r,g,b) => skyUniforms.bottomColor.value.setRGB(r,g,b), setFogColor: (r,g,b) => scene.fog.color.setRGB(r,g,b), setSunPos: (x,y,z) => sun.position.set(x,y,z), setSunIntensity: v => { sun.intensity = v; } } });
const _fpGunPosTick      = mountFpGunPosTick({ get: { weaponSwitchT: () => _weaponSwitchT }, set: { weaponSwitchT: v => { _weaponSwitchT = v; } }, actions: { setPosition: (x,y,z) => _fpGunGroup.position.set(x,y,z), setRotation: (x,y,z) => _fpGunGroup.rotation.set(x,y,z) } });
