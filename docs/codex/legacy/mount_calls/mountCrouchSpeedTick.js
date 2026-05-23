// Legacy clone of mountCrouchSpeedTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 2
// game.html lines 1700..1700
// (context lines 1696..1704)

let _grenadePressT = 0;   // performance.now() when G was pressed (0 = not held)
let _heroKbU = 0, _heroKbV = 0, _heroKbT = 0; // knockback burst from heavy/boss melee
let _enFsT = 0;   // global enemy-footstep timer — plays for nearest approaching enemy
let _heroShotAlertU = 0, _heroShotAlertV = 0, _heroShotAlertT = 0; // last shot pos alert to nearby enemies
// _crouchAmt managed by mountCrouchSpeedTick (iter 660)
let _slideT = 0, _slideDU = 0, _slideDV = 0, _ctrlWasDown = false; // sprint slide state
let _stamina = 100;    // 0..100; depletes while sprinting, regens when idle
// ═══ EXTRACTED → src/config/hero_stats.js (iter 562) — STAMINA_MAX/DRAIN/REGEN/LOCKOUT imported at top
let _heroExtraStaminaMax = 0; // bonus from kill level 3


// occurrence 2 of 2
// game.html lines 1836..1836
// (context lines 1832..1840)

const _debugHudTick      = mountDebugHudTick({ actions: { getVehDist: id => Bridge.uvDist(world, "hero", id), setHudHtml: html => { hud.innerHTML = html; }, clearEnemyHpDirty: () => { _hudEnemyHpDirty = false; } } });
const _enemyMeshTick     = mountEnemyMeshTick({ actions: { getCamYaw: () => camYaw, getPos: id => world.players.get(id) || null, spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), spawnClearPos: (r1, r2) => _spawnClearPos(r1, r2), setPos: (id, x, yy, z, u, vv) => world.setPlayer(id, x, yy, z, u, vv), markHudDirty: () => { _hudEnemyHpDirty = true; } } });
const _vehiclePhysicsTick = mountVehiclePhysicsTick({ actions: { key: k => !!keys[k], getCamYaw: () => camYaw, getPos: id => world.players.get(id) || null, setPos: (id, x, yy, z, u, vv) => world.setPlayer(id, x, yy, z, u, vv), carPhysicsStep: (vId, vSt, throttle, steerIn, dt, opts) => Bridge.carPhysicsStep(world, vId, vSt, throttle, steerIn, dt, opts), updateCarState: next => Object.assign(carState, next), markPlatformDirty: () => _platformSys.markDirty() } });
const _ammoReloadTick    = mountAmmoReloadTick({ set: { reloading: v => { _reloading = v; }, pistolAmmo: v => { pistolAmmo = v; }, pistolCooldown: v => { pistolCooldown = v; }, getPistolAmmo: () => pistolAmmo }, actions: { getReloadDur: () => RELOAD_DUR(), getMagCap: () => PISTOL_MAG_CAP(), getWeapon: () => getWeapon(), countInvAmmo: item => Inv.countItem(heroInv, item), removeInvAmmo: (item, n) => Inv.removeItem(heroInv, item, n), setAmmo: v => setAmmo(v), getReloadCircle: () => _dom.reloadCircle || null, getAmmoHud: () => _dom.ammoHud || null } });
const _crouchSpeedTick   = mountCrouchSpeedTick({ actions: { spawnSprintTrail: () => { const _spTp = world.players.get("hero"); if (_spTp) _spawnParticles(_spTp.u, _spTp.y + 0.08, _spTp.v, 1, "orange", 1.2, 0.22); } } });
const _waveHudTick       = mountWaveHudTick({ get: { waveBeepLast: () => _waveBeepLast, lastWaveNum: () => _lastWaveNum, waveBannerUntil: () => _waveBannerUntil, waveChallenge: () => _waveChallenge, waveChallengeStart: () => _waveChallengeStart, waveChallengeHits: () => _waveChallengeHits, heroLevel: () => _heroLevel, levelThresholds: () => _LEVEL_THRESHOLDS, enemyKills: () => enemyKills }, set: { waveBeepLast: v => { _waveBeepLast = v; }, lastWaveNum: v => { _lastWaveNum = v; }, waveBannerUntil: v => { _waveBannerUntil = v; } }, actions: { getWaveHud: () => _dom.waveHud || null, getWaveLabel: () => _dom.waveLabel || null, getWaveDetail: () => _dom.waveDetail || null, getLevelHud: () => _dom.heroLevelHud || null, getChallengeHud: () => _dom.waveChallengeHud || null, getBannerLabel: () => _dom.waveBannerLabel || null, getBannerSub: () => _dom.waveBannerSub || null, getBanner: () => _dom.waveBanner || null, playSfx: (str, vol) => playSfx(str, vol) } });
const _grenadeArcTick    = mountGrenadeArcTick({ THREE, get: { heroHp: () => heroHp }, set: { heroHp: v => { heroHp = v; }, grenadeCount: v => { grenadeCount = v; }, grenadePressT: v => { _grenadePressT = v; } }, actions: { addToScene: m => scene.add(m), flashDamage: () => flashDamage(), applyScreenShake: amt => _applyScreenShake(amt), spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), playSfx: (str, vol) => playSfx(str, vol), showToast: (msg, type, dur) => showToast(msg, type, dur), showDeathScreen: () => { if (!_heroDead) _heroShowDeathScreen(); }, getTimerEl: () => _dom.grenCookTimer || null } });
const _grenadePhysicsTick = mountGrenadePhysicsTick({ actions: { spawnParticles: (u, y, v) => { if (Math.random() < 0.55) _spawnParticles(u, y, v, 1, "white", 0.8, 0.35); }, removeMesh: m => scene.remove(m), deploySmokeZone: (u, v) => _deploySmokeZone(u, v), explodeGrenade: g => _explodeGrenade(g), playSfx: (str, vol) => playSfx(str, vol) } });
const _grenadeWarnTick   = mountGrenadeWarnTick({ actions: { getWarnEl: () => _dom.grenadeWarn || null } });
