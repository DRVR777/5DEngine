// Heavy enemy grenade throw: lobs a grenade every 4s (2.5s when enraged) at 3.5–12m with LOS.
// THREE, scene, warnRingGeo/Mat, grenades array, and GRAVITY are raw materials bound at mount.
export function mountEnemyHeavyGrenadeTick({ THREE, scene, warnRingGeo, warnRingMat, grenades, GRAVITY, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "heavy" || !canSee || dist <= 3.5 || dist >= 12) return;
    const cooldown = en._enraged ? 2.5 : 4.0;
    if (en._grenadeT && nowSec - en._grenadeT <= cooldown) return;
    en._grenadeT = nowSec;
    const tof = 1.5;
    const hspeed = dist / tof;
    const throwAng = Math.atan2(heroU - ep.u, heroV - ep.v);
    const gMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x222200, roughness: 0.8, metalness: 0.5 })
    );
    gMesh.position.set(ep.u, ep.y + 1.2, ep.v);
    scene.add(gMesh);
    const warnRing = new THREE.Mesh(warnRingGeo, warnRingMat.clone());
    warnRing.position.set(ep.u, 0.05, ep.v);
    scene.add(warnRing);
    grenades.push({
      mesh: gMesh, fuse: tof + 0.3, u: ep.u, y: ep.y + 1.2, v: ep.v,
      velU: Math.sin(throwAng) * hspeed,
      velY: Math.abs(GRAVITY) * tof / 2,
      velV: Math.cos(throwAng) * hspeed,
      _warnRing: warnRing,
    });
    actions.playSfx("tone:150:80:triangle", 0.22);
  }
  return { tick };
}
