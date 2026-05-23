// Poisoner ranged spit: lobs poison glob into enemyBullets every 3-4.5s when 3.5-10m away.
// THREE, scene, enemyBullets are raw materials bound at mount.
// Magic numbers: distMin=3.5, distMax=10, intervalBase=3.0, intervalRange=1.5, defaultInterval=3.5,
//   spitRadius=0.12, yOffset=1.1, tofBase=0.9, tofDistDiv=14, dirY=0.18, damage=4, range=11.
export function mountEnemyPoisonerRangedSpitTick({ THREE, scene, enemyBullets, actions }) {
  const _mat = new THREE.MeshBasicMaterial({ color: 0x44cc44 });
  const _geo = new THREE.SphereGeometry(0.12, 5, 4);

  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "poisoner" || !canSee || dist <= 3.5 || dist >= 10) return;
    if (en._spitT && nowSec - en._spitT <= (en._spitInterval || 3.5)) return;
    en._spitT = nowSec;
    en._spitInterval = 3.0 + Math.random() * 1.5;
    const ang = Math.atan2(heroU - ep.u, heroV - ep.v);
    const mesh = new THREE.Mesh(_geo, _mat);
    mesh.position.set(ep.u, ep.y + 1.1, ep.v);
    scene.add(mesh);
    const tof = 0.9 + dist / 14;
    enemyBullets.push({
      mesh, posU: ep.u, posV: ep.v, posY: ep.y + 1.1,
      dirU: Math.sin(ang), dirV: Math.cos(ang), dirY: 0.18,
      speed: dist / tof, damage: 4, traveled: 0, range: 11, poisonOnHit: true,
    });
    actions.playSfx("tone:200:70:sawtooth", 0.22);
  }
  return { tick };
}
