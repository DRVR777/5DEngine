// Boss rock throw: hurls a boulder every 6s (3.5s enraged) at 5–15m range.
// THREE, scene, warnRingGeo/Mat, grenades, and GRAVITY are raw materials bound at mount.
export function mountEnemyBossRockTick({ THREE, scene, warnRingGeo, warnRingMat, grenades, GRAVITY, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "boss" || !canSee || dist < 5 || dist >= 15) return;
    const cooldown = en._enraged ? 3.5 : 6.0;
    if (en._rockT && nowSec - en._rockT <= cooldown) return;
    en._rockT = nowSec;
    const tof = 1.8;
    const rspeed = dist / tof;
    const throwAng = Math.atan2(heroU - ep.u, heroV - ep.v);
    const rMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({ color: 0x555544, roughness: 1.0, metalness: 0.1 })
    );
    rMesh.position.set(ep.u, ep.y + 2.0, ep.v);
    scene.add(rMesh);
    const warnRing = new THREE.Mesh(warnRingGeo, warnRingMat.clone());
    warnRing.position.set(ep.u, 0.05, ep.v);
    scene.add(warnRing);
    grenades.push({
      mesh: rMesh, fuse: tof + 0.5, u: ep.u, y: ep.y + 2.0, v: ep.v,
      velU: Math.sin(throwAng) * rspeed,
      velY: Math.abs(GRAVITY) * tof / 2,
      velV: Math.cos(throwAng) * rspeed,
      _isBossRock: true, _warnRing: warnRing,
    });
    actions.playSfx("tone:80:200:sawtooth", 0.55);
    actions.screenShake(0.2);
  }
  return { tick };
}
