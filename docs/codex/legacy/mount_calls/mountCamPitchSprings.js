// Legacy clone of mountCamPitchSprings call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1668..1668
// (context lines 1664..1672)

const _jumpGravityTick   = mountJumpGravityTick({ jumpV: JUMP_V, gravity: GRAVITY, get: { velocityY: () => velocityY, spaceWasDown: () => _spaceWasDown, canDoubleJump: () => _canDoubleJump, stamina: () => _stamina }, set: { velocityY: v => { velocityY = v; }, spaceWasDown: v => { _spaceWasDown = v; }, canDoubleJump: v => { _canDoubleJump = v; }, stamina: v => { _stamina = v; } }, actions: { getPos: () => world.players.get("hero"), setPos: (x,y,z,u,v) => world.setPlayer("hero",x,y,z,u,v), getSupport: (u,v,y) => _platformSys.getSupport(u,v,y), spawnDoubleJumpFx: (u,y,v) => { const _djp = world.players.get("hero"); _spawnParticles(_djp.u, _djp.y + 0.5, _djp.v, 10, "cyan", 4, 0.3); playSfx("tone:700:60:sine", 0.22); }, onLand: impact => { const fd = Math.min(90, Math.max(0, (-impact - 15) * 5)); if (fd > 0 && !(typeof Engine !== "undefined" && Engine.debug.godMode)) { heroHp = Math.max(0, heroHp - fd); heroLastDamageT = _frameNowMs / 1000; flashDamage(); showToast(`Fall damage: -${Math.round(fd)} HP`, "danger", 1500); } }, heroDead: () => _heroDead } });
const _weaponHudTick   = mountWeaponHudTick({ get: { lowAmmoWarnedAt: () => _lowAmmoWarnedAt, lastMagBarAmmo: () => _lastMagBarAmmo, lastMagBarReloading: () => _lastMagBarReloading }, set: { lowAmmoWarnedAt: v => { _lowAmmoWarnedAt = v; }, lastMagBarAmmo: v => { _lastMagBarAmmo = v; }, lastMagBarReloading: v => { _lastMagBarReloading = v; } }, actions: { getWeapon: () => getWeapon(), getReserve: ammoItem => Inv.countItem(heroInv, ammoItem), playSfx: (str, vol) => playSfx(str, vol) } });
let _reloading = false, _reloadStart = 0;
let _recoilPitch = 0;
const _camPitchSprings = mountCamPitchSprings({ camPitchMax: CFG.camPitchMax || 0.4, get: { recoilPitch: () => _recoilPitch, hitPunchPitch: () => _hitPunchPitch, camPitch: () => camPitch }, set: { recoilPitch: v => { _recoilPitch = v; }, hitPunchPitch: v => { _hitPunchPitch = v; }, camPitch: v => { camPitch = v; } } });
let _gunKickZ = 0;      // offset applied to _gunMount.position.z each frame
let _gunReloadX = 0;   // spring: tilts gun down during reload window
let _weaponSwitchT = 0; // countdown for weapon-swap dip animation (0.3s total)
let _meleeSwing = 0;   // spring: lateral swing for melee attack (applied to fpGun roll)
