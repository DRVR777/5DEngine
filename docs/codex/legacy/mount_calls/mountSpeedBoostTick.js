// Legacy clone of mountSpeedBoostTick call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1060..1060
// (context lines 1056..1064)

// ═══ EXTRACTED → src/systems/speed_orb_spawner.js (iter 551)
// _speedBoostT / _speedTrailT remain here — mutated by lifecycle + tick
let _speedBoostT = 0;
let _speedTrailT = 0;
const _speedBoostTick = mountSpeedBoostTick({ get: { speedBoostT: () => _speedBoostT, speedTrailT: () => _speedTrailT }, set: { speedBoostT: v => { _speedBoostT = v; }, speedTrailT: v => { _speedTrailT = v; } }, actions: { spawnTrail: () => { const _h = world.players.get("hero"); if (_h) _spawnParticles(_h.u - Math.sin(camYaw)*0.3, 0.15, _h.v - Math.cos(camYaw)*0.3, 2, "yellow", 3, 0.22); } } });
const { speedOrbs: _speedOrbs, spawnSpeedOrb: _spawnSpeedOrb } = mountSpeedOrbSpawner({ THREE, scene });

// ═══ EXTRACTED → src/systems/hazard_zones.js (iter 543) ═════════════════════
const {
