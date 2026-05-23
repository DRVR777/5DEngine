// Legacy clone of mountWalkAnimTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1641..1641
// (context lines 1637..1645)

let _combatAmbT = 0;
const _combatAmbientTick = mountCombatAmbientTick({ get: { ambT: () => _combatAmbT }, set: { ambT: v => { _combatAmbT = v; } }, actions: { isAmbientReady: () => Sfx.isAmbientReady(), setAmbient: (k, f, t, v, fade) => _setAmbient(k, f, t, v, fade) } });
const _skyDayNightTick   = mountSkyDayNightTick({ actions: { setTopColor: (r,g,b) => skyUniforms.topColor.value.setRGB(r,g,b), setBottomColor: (r,g,b) => skyUniforms.bottomColor.value.setRGB(r,g,b), setFogColor: (r,g,b) => scene.fog.color.setRGB(r,g,b), setSunPos: (x,y,z) => sun.position.set(x,y,z), setSunIntensity: v => { sun.intensity = v; } } });
const _fpGunPosTick      = mountFpGunPosTick({ get: { weaponSwitchT: () => _weaponSwitchT }, set: { weaponSwitchT: v => { _weaponSwitchT = v; } }, actions: { setPosition: (x,y,z) => _fpGunGroup.position.set(x,y,z), setRotation: (x,y,z) => _fpGunGroup.rotation.set(x,y,z) } });
const _walkAnimTick      = mountWalkAnimTick({ get: { gunKickZ: () => _gunKickZ, gunReloadX: () => _gunReloadX }, set: { gunKickZ: v => { _gunKickZ = v; }, gunReloadX: v => { _gunReloadX = v; } }, actions: { walkCycle: (dt, gs) => Bridge.walkCyclePhase(walkState, dt, gs), setThighs: m => { thighL.rotation.x = +m; thighR.rotation.x = -m; }, setShins: m => { shinL.rotation.x = Math.max(0, m) * 0.75; shinR.rotation.x = Math.max(0, -m) * 0.75; }, setArms: (lx, rx) => { armL.rotation.x = lx; armR.rotation.x = rx; }, setGunMount: (px,py,pz,rx,ry,rz) => { _gunMount.position.set(px,py,pz); _gunMount.rotation.set(rx,ry,rz); }, setTorsoY: y => { torso.position.y = y; } } });
const _heroFaceTick      = mountHeroFaceTick({ get: { rotY: () => heroGroup.rotation.y }, set: { rotY: v => { heroGroup.rotation.y = v; } } });
const _camShakeTick      = mountCamShakeTick({ get: { camShakeAmt: () => _camShakeAmt }, set: { camShakeAmt: v => { _camShakeAmt = v; } }, actions: { offsetCamera: (dx, dy) => { camera.position.x += dx; camera.position.y += dy; } } });
const _heroKbTick        = mountHeroKnockbackTick({ get: { kbT: () => _heroKbT, kbU: () => _heroKbU, kbV: () => _heroKbV }, set: { kbT: v => { _heroKbT = v; }, kbU: v => { _heroKbU = v; }, kbV: v => { _heroKbV = v; } }, actions: { getPos: () => world.players.get("hero"), setPos: (x,y,z,u,v) => world.setPlayer("hero",x,y,z,u,v), resolveMove: (mover,du,dv) => GTAPhysics.resolveAABBMove(mover,du,dv,buildingBlockers) } });
const _dodgeTick         = mountDodgeTick({ get: { dodgeCooldown: () => _dodgeCooldown, dodgeT: () => _dodgeT, dodgeVelU: () => _dodgeVelU, dodgeVelV: () => _dodgeVelV, dodgeBashDone: () => _dodgeBashDone }, set: { dodgeCooldown: v => { _dodgeCooldown = v; }, dodgeT: v => { _dodgeT = v; }, dodgeBashDone: v => { _dodgeBashDone = v; } }, actions: { getPos: () => world.players.get("hero"), setPos: (x,y,z,u,v) => world.setPlayer("hero",x,y,z,u,v), spawnTrail: (u,y,v) => { if (Math.random() < 0.7) _spawnParticles(u, y + 0.6, v, 2, "cyan", 2.5, 0.18); }, tryBash: heroPos => { const bd = Math.round(25 * _heroLvlDmgMul); for (const en of enemies) { if (en.dead) continue; const ep = world.players.get(en.id); if (Math.hypot(ep.u - heroPos.u, ep.v - heroPos.v) < 0.9) { en.hp = Math.max(0, en.hp - bd); en._hpBarShowT = _frameNowMs / 1000; const a = Math.atan2(ep.u - heroPos.u, ep.v - heroPos.v); en._kbU = Math.sin(a) * 5; en._kbV = Math.cos(a) * 5; en._kbT = 0.18; _spawnDamageNumber(ep.u, 1.4, ep.v, `BASH! ${bd}`, "#00ffff"); _spawnParticles(ep.u, 1.0, ep.v, 8, "cyan", 5, 0.2); playSfx("tone:180:60:sawtooth", 0.28); return true; } } return false; } } });
