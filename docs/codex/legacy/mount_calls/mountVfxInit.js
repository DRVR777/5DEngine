// Legacy clone of mountVfxInit call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 858..858
// (context lines 854..862)

// "warnRingGeo / warnRingMat" are live named exports — after init() they hold
// the actual TorusGeometry / MeshBasicMaterial for enemy grenade indicators.
// ═══ EXTRACTED → src/render/vfx_init.js (iter 573)
const { _warnRingGeo, _warnRingMat, _spawnParticles, _ejectCasing, _spawnDamageNumber, _triggerMuzzleFlash, _spawnShockwave, _shockwaves } =
  mountVfxInit({ THREE, scene, camera, Vfx, warnRingGeo: _vfxWarnGeo, warnRingMat: _vfxWarnMat });
// ─────────────────────────────────────────────────────────────────────────────

// ═══ EXTRACTED → src/render/lighting.js (iter 553)
const { ambLight: _ambLight, sun } = mountLighting({ THREE, scene, Engine, renderer });
