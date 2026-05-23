// Legacy clone of mountEnemyRobotEmpTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1648..1648
// (context lines 1644..1652)

const _heroKbTick        = mountHeroKnockbackTick({ get: { kbT: () => _heroKbT, kbU: () => _heroKbU, kbV: () => _heroKbV }, set: { kbT: v => { _heroKbT = v; }, kbU: v => { _heroKbU = v; }, kbV: v => { _heroKbV = v; } }, actions: { getPos: () => world.players.get("hero"), setPos: (x,y,z,u,v) => world.setPlayer("hero",x,y,z,u,v), resolveMove: (mover,du,dv) => GTAPhysics.resolveAABBMove(mover,du,dv,buildingBlockers) } });
const _dodgeTick         = mountDodgeTick({ get: { dodgeCooldown: () => _dodgeCooldown, dodgeT: () => _dodgeT, dodgeVelU: () => _dodgeVelU, dodgeVelV: () => _dodgeVelV, dodgeBashDone: () => _dodgeBashDone }, set: { dodgeCooldown: v => { _dodgeCooldown = v; }, dodgeT: v => { _dodgeT = v; }, dodgeBashDone: v => { _dodgeBashDone = v; } }, actions: { getPos: () => world.players.get("hero"), setPos: (x,y,z,u,v) => world.setPlayer("hero",x,y,z,u,v), spawnTrail: (u,y,v) => { if (Math.random() < 0.7) _spawnParticles(u, y + 0.6, v, 2, "cyan", 2.5, 0.18); }, tryBash: heroPos => { const bd = Math.round(25 * _heroLvlDmgMul); for (const en of enemies) { if (en.dead) continue; const ep = world.players.get(en.id); if (Math.hypot(ep.u - heroPos.u, ep.v - heroPos.v) < 0.9) { en.hp = Math.max(0, en.hp - bd); en._hpBarShowT = _frameNowMs / 1000; const a = Math.atan2(ep.u - heroPos.u, ep.v - heroPos.v); en._kbU = Math.sin(a) * 5; en._kbV = Math.cos(a) * 5; en._kbT = 0.18; _spawnDamageNumber(ep.u, 1.4, ep.v, `BASH! ${bd}`, "#00ffff"); _spawnParticles(ep.u, 1.0, ep.v, 8, "cyan", 5, 0.2); playSfx("tone:180:60:sawtooth", 0.28); return true; } } return false; } } });
const _enemyRegenTick    = mountEnemyRegenTick({ actions: { getPos: id => world.players.get(id), spawnDamageNumber: (u,y,v,t,c) => _spawnDamageNumber(u,y,v,t,c) } });
const _enemySepTick      = mountEnemySepTick({ actions: { getPos: id => world.players.get(id), setPos: (id,x,y,z,u,v) => world.setPlayer(id,x,y,z,u,v) } });
const _empTick           = mountEnemyRobotEmpTick({ THREE, scene, shockwaves: _shockwaves, actions: { playSfx, setHeroEmpT: v => { _heroEmpT=v; }, showToast, flashDamage: o => { damageFlashEl.style.opacity=String(o); } } });
const _heavyGrenadeTick  = mountEnemyHeavyGrenadeTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat, grenades: grenades3D, GRAVITY, actions: { playSfx } });
const _bossRockTick      = mountEnemyBossRockTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat, grenades: grenades3D, GRAVITY, actions: { playSfx, screenShake: _applyScreenShake } });
const _poisonerSpitTick  = mountEnemyPoisonerSpitTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, grenades: grenades3D, GRAVITY, actions: { playSfx } });
const _incendiaryTick    = mountEnemyIncendiaryTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, grenades: grenades3D, GRAVITY, actions: { playSfx } });
