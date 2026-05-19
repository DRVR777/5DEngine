// Initialises the Vfx module and returns bound action helpers.
// Must be called after scene and camera exist.
export function mountVfxInit({ THREE, scene, camera, Vfx, warnRingGeo, warnRingMat }) {
  Vfx.init(THREE, scene, camera);
  return {
    _warnRingGeo:        warnRingGeo,
    _warnRingMat:        warnRingMat,
    _spawnParticles:     Vfx.spawnParticles.bind(Vfx),
    _ejectCasing:        Vfx.ejectCasing.bind(Vfx),
    _spawnDamageNumber:  Vfx.spawnDamageNumber.bind(Vfx),
    _triggerMuzzleFlash: Vfx.triggerMuzzleFlash.bind(Vfx),
    _spawnShockwave:     Vfx.spawnShockwave.bind(Vfx),
  };
}
