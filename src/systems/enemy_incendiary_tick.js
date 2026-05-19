// Incendiary fire bomb throw: lobs a flaming ball every 5s at 4–12m range.
// THREE, scene, warnRingGeo, grenades, GRAVITY are raw materials bound at mount.
export function mountEnemyIncendiaryTick({ THREE, scene, warnRingGeo, grenades, GRAVITY, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "incendiary" || !canSee || dist <= 4 || dist >= 12) return;
    if (en._fireT && nowSec - en._fireT <= 5.0) return;
    en._fireT = nowSec;
    const tof = 1.4;
    const fspeed = dist / tof;
    const throwAng = Math.atan2(heroU - ep.u, heroV - ep.v);
    const fMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1.5, roughness: 0.5 })
    );
    fMesh.position.set(ep.u, ep.y + 1.2, ep.v);
    scene.add(fMesh);
    const fWarnMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.65, depthWrite: false });
    const fWarnRing = new THREE.Mesh(warnRingGeo, fWarnMat);
    fWarnRing.position.set(ep.u, 0.05, ep.v);
    scene.add(fWarnRing);
    grenades.push({
      mesh: fMesh, fuse: tof + 0.3, u: ep.u, y: ep.y + 1.2, v: ep.v,
      velU: Math.sin(throwAng) * fspeed,
      velY: Math.abs(GRAVITY) * tof / 2,
      velV: Math.cos(throwAng) * fspeed,
      _warnRing: fWarnRing, _isFireball: true,
    });
    actions.playSfx("tone:400:60:sawtooth", 0.3);
  }
  return { tick };
}
