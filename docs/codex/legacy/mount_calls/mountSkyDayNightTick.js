// Legacy clone of mountSkyDayNightTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1639..1639
// (context lines 1635..1643)

const _comboHudTick    = mountComboHudTick();
const _vehicleDashTick = mountVehicleDashTick();
let _combatAmbT = 0;
const _combatAmbientTick = mountCombatAmbientTick({ get: { ambT: () => _combatAmbT }, set: { ambT: v => { _combatAmbT = v; } }, actions: { isAmbientReady: () => Sfx.isAmbientReady(), setAmbient: (k, f, t, v, fade) => _setAmbient(k, f, t, v, fade) } });
const _skyDayNightTick   = mountSkyDayNightTick({ actions: { setTopColor: (r,g,b) => skyUniforms.topColor.value.setRGB(r,g,b), setBottomColor: (r,g,b) => skyUniforms.bottomColor.value.setRGB(r,g,b), setFogColor: (r,g,b) => scene.fog.color.setRGB(r,g,b), setSunPos: (x,y,z) => sun.position.set(x,y,z), setSunIntensity: v => { sun.intensity = v; } } });
const _fpGunPosTick      = mountFpGunPosTick({ get: { weaponSwitchT: () => _weaponSwitchT }, set: { weaponSwitchT: v => { _weaponSwitchT = v; } }, actions: { setPosition: (x,y,z) => _fpGunGroup.position.set(x,y,z), setRotation: (x,y,z) => _fpGunGroup.rotation.set(x,y,z) } });
const _walkAnimTick      = mountWalkAnimTick({ get: { gunKickZ: () => _gunKickZ, gunReloadX: () => _gunReloadX }, set: { gunKickZ: v => { _gunKickZ = v; }, gunReloadX: v => { _gunReloadX = v; } }, actions: { walkCycle: (dt, gs) => Bridge.walkCyclePhase(walkState, dt, gs), setThighs: m => { thighL.rotation.x = +m; thighR.rotation.x = -m; }, setShins: m => { shinL.rotation.x = Math.max(0, m) * 0.75; shinR.rotation.x = Math.max(0, -m) * 0.75; }, setArms: (lx, rx) => { armL.rotation.x = lx; armR.rotation.x = rx; }, setGunMount: (px,py,pz,rx,ry,rz) => { _gunMount.position.set(px,py,pz); _gunMount.rotation.set(rx,ry,rz); }, setTorsoY: y => { torso.position.y = y; } } });
const _heroFaceTick      = mountHeroFaceTick({ get: { rotY: () => heroGroup.rotation.y }, set: { rotY: v => { heroGroup.rotation.y = v; } } });
const _camShakeTick      = mountCamShakeTick({ get: { camShakeAmt: () => _camShakeAmt }, set: { camShakeAmt: v => { _camShakeAmt = v; } }, actions: { offsetCamera: (dx, dy) => { camera.position.x += dx; camera.position.y += dy; } } });
