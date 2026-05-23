// Legacy clone of mountEnemyIncendiaryTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1652..1652
// (context lines 1648..1656)

const _empTick           = mountEnemyRobotEmpTick({ THREE, scene, shockwaves: _shockwaves, actions: { playSfx, setHeroEmpT: v => { _heroEmpT=v; }, showToast, flashDamage: o => { damageFlashEl.style.opacity=String(o); } } });
const _heavyGrenadeTick  = mountEnemyHeavyGrenadeTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat, grenades: grenades3D, GRAVITY, actions: { playSfx } });
const _bossRockTick      = mountEnemyBossRockTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat, grenades: grenades3D, GRAVITY, actions: { playSfx, screenShake: _applyScreenShake } });
const _poisonerSpitTick  = mountEnemyPoisonerSpitTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, grenades: grenades3D, GRAVITY, actions: { playSfx } });
const _incendiaryTick    = mountEnemyIncendiaryTick({ THREE, scene, warnRingGeo: _vfxWarnGeo, grenades: grenades3D, GRAVITY, actions: { playSfx } });
const _bossSlamTick      = mountEnemyBossSlamTick({ ARMOR_ABSORB, getHeroPos: () => world.players.get("hero"), getEnemyPos: id => world.players.get(id), enemies, actions: { playSfx, screenShake: _applyScreenShake, spawnParticles: _spawnParticles, spawnShockwave: _spawnShockwave, flashDamage, setHeroHp: v => { heroHp = v; }, setHeroArmor: v => { heroArmor = v; }, setHeroLastDamageT: v => { heroLastDamageT = v; }, onHeroDeath: () => { if (!_heroDead) _heroShowDeathScreen(); } } });
const _poisonerRangedSpitTick = mountEnemyPoisonerRangedSpitTick({ THREE, scene, enemyBullets, actions: { playSfx } });
const _fastChargeTick          = mountEnemyFastChargeTick({ getEnemyPos: id => world.players.get(id), resolveMove: (mover, du, dv) => GTAPhysics.resolveAABBMove(mover, du, dv, buildingBlockers), setEnemyPos: (id, x, z, rot, u, v) => world.setPlayer(id, x, z, rot, u, v), actions: { playSfx, spawnParticles: _spawnParticles } });
const _sniperTick              = mountEnemySniperTick({ THREE, scene, enemyBullets, resolveMove: (mover, du, dv) => GTAPhysics.resolveAABBMove(mover, du, dv, buildingBlockers), getEnemyPos: id => world.players.get(id), setEnemyPos: (id, x, z, rot, u, v) => world.setPlayer(id, x, z, rot, u, v), actions: { playSfx, screenShake: _applyScreenShake, alertShot: () => { showToast("SNIPER SHOT INCOMING!", "danger", 800); _bulletTimeLeft = 0.38; } } });
