// Legacy clone of mountScreenMeshTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1831..1831
// (context lines 1827..1835)

const { _camTarget, _camOff, _camLook, _camAimTarget, _camBuildLook } = mountCamVectors({ THREE });
const _cameraPosTick     = mountCameraPosTick({ vectors: { camTarget: _camTarget, camOff: _camOff, camLook: _camLook, camAimTarget: _camAimTarget, camBuildLook: _camBuildLook }, actions: { getCamera: () => camera } });
const _proximityTick     = mountProximityTick({ get: { dialogOpen: () => _npcDialog.isOpen, computerOpen: () => computerOpen }, set: { nearComputer: v => { nearComputer = v; }, nearNpc: n => { _nearNpc = n; } }, actions: { getComputerPos: () => computerEntity, getScreenFront: () => screenFront || null, getNpcDefs: () => NPC_DEFS, getNpcPos: id => world.players.get(id) || null } });
const _deviceBusTick     = mountDeviceBusTick({ actions: { getDeviceBus: () => typeof deviceBus !== "undefined" ? deviceBus : null, getHeroPos: () => world.players.get("hero") || { u: 0, v: 0 }, hasAudioMixer: () => typeof audioMixer !== "undefined" && !!audioMixer, playSfx: (str, vol) => playSfx(str, vol), pollMon1Bridge: () => { if (window.__mon1Bridge) window.__mon1Bridge.pollAndPaint(); } } });
const _screenMeshTick    = mountScreenMeshTick({ actions: { getScreenMesh: () => window.ScreenMesh || null, getBuildConsoleScreen: () => window._buildConsoleScreen || null, getBuildConsoleMesh: () => window._buildConsoleMesh || null, intersectMesh: (mesh) => { const _r = new THREE.Raycaster(); _r.setFromCamera({ x: 0, y: 0 }, camera); return _r.intersectObject(mesh, false); }, setHoverRegion: id => { window._bcHoverRegion = id; } } });
const _debugHudTick      = mountDebugHudTick({ actions: { getVehDist: id => Bridge.uvDist(world, "hero", id), setHudHtml: html => { hud.innerHTML = html; }, clearEnemyHpDirty: () => { _hudEnemyHpDirty = false; } } });
const _enemyMeshTick     = mountEnemyMeshTick({ actions: { getCamYaw: () => camYaw, getPos: id => world.players.get(id) || null, spawnParticles: (u, y, v, n, col, spd, size) => _spawnParticles(u, y, v, n, col, spd, size), spawnClearPos: (r1, r2) => _spawnClearPos(r1, r2), setPos: (id, x, yy, z, u, vv) => world.setPlayer(id, x, yy, z, u, vv), markHudDirty: () => { _hudEnemyHpDirty = true; } } });
const _vehiclePhysicsTick = mountVehiclePhysicsTick({ actions: { key: k => !!keys[k], getCamYaw: () => camYaw, getPos: id => world.players.get(id) || null, setPos: (id, x, yy, z, u, vv) => world.setPlayer(id, x, yy, z, u, vv), carPhysicsStep: (vId, vSt, throttle, steerIn, dt, opts) => Bridge.carPhysicsStep(world, vId, vSt, throttle, steerIn, dt, opts), updateCarState: next => Object.assign(carState, next), markPlatformDirty: () => _platformSys.markDirty() } });
const _ammoReloadTick    = mountAmmoReloadTick({ set: { reloading: v => { _reloading = v; }, pistolAmmo: v => { pistolAmmo = v; }, pistolCooldown: v => { pistolCooldown = v; }, getPistolAmmo: () => pistolAmmo }, actions: { getReloadDur: () => RELOAD_DUR(), getMagCap: () => PISTOL_MAG_CAP(), getWeapon: () => getWeapon(), countInvAmmo: item => Inv.countItem(heroInv, item), removeInvAmmo: (item, n) => Inv.removeItem(heroInv, item, n), setAmmo: v => setAmmo(v), getReloadCircle: () => _dom.reloadCircle || null, getAmmoHud: () => _dom.ammoHud || null } });
