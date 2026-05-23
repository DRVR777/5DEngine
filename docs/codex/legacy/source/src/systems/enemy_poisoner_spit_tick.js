// Poisoner acid spit: lobs a toxic glob every 4s at 3–10m range, creates poison puddle.
// THREE, scene, warnRingGeo, grenades, GRAVITY are raw materials bound at mount.
export function mountEnemyPoisonerSpitTick({ THREE, scene, warnRingGeo, grenades, GRAVITY, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "poisoner" || !canSee || dist <= 3 || dist >= 10) return;
    if (en._acidT && nowSec - en._acidT <= 4.0) return;
    en._acidT = nowSec;
    const tof = 1.1;
    const aspeed = dist / tof;
    const throwAng = Math.atan2(heroU - ep.u, heroV - ep.v);
    const aMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 6, 5),
      new THREE.MeshStandardMaterial({ color: 0x44dd44, emissive: 0x22bb00, emissiveIntensity: 1.2, roughness: 0.4 })
    );
    aMesh.position.set(ep.u, ep.y + 1.2, ep.v);
    scene.add(aMesh);
    const aWarnMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, transparent: true, opacity: 0.55, depthWrite: false });
    const aWarnRing = new THREE.Mesh(warnRingGeo, aWarnMat);
    aWarnRing.position.set(ep.u, 0.05, ep.v);
    scene.add(aWarnRing);
    grenades.push({
      mesh: aMesh, fuse: tof + 0.25, u: ep.u, y: ep.y + 1.2, v: ep.v,
      velU: Math.sin(throwAng) * aspeed,
      velY: Math.abs(GRAVITY) * tof / 2,
      velV: Math.cos(throwAng) * aspeed,
      _warnRing: aWarnRing, _isAcidSpit: true,
    });
    actions.playSfx("tone:600:50:sine", 0.22);
  }
  return { tick };
}
