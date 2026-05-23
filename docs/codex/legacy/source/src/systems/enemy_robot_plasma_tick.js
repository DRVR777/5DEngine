// Robot plasma bolt: fires a cyan sphere into enemyBullets every 1.5s when within 10m.
// THREE, scene, enemyBullets are raw materials bound at mount.
// Magic numbers: distMax=10, cooldown=1.5, sphereR=0.1, color=0x00ccff, yOffset=1.3,
//   pitchNumerator=1.1 (=1.2-0.1), speed=14, damage=12, range=12.
export function mountEnemyRobotPlasmaTick({ THREE, scene, enemyBullets, actions }) {
  const _mat = new THREE.MeshBasicMaterial({ color: 0x00ccff });
  const _geo = new THREE.SphereGeometry(0.1, 4, 4);

  function tick(dt, en, { canSee, dist, ep, nowSec, heroU, heroV }) {
    if (en.type !== "robot" || !canSee || dist >= 10) return;
    if (en._lastShootT && nowSec - en._lastShootT <= 1.5) return;
    en._lastShootT = nowSec;
    const ang   = Math.atan2(heroU - ep.u, heroV - ep.v);
    const pitch = Math.atan2(1.1, dist);
    const cosP  = Math.cos(pitch);
    const mesh  = new THREE.Mesh(_geo, _mat);
    mesh.position.set(ep.u, ep.y + 1.3, ep.v);
    scene.add(mesh);
    enemyBullets.push({
      mesh, posU: ep.u, posV: ep.v, posY: ep.y + 1.3,
      dirU: Math.sin(ang) * cosP, dirV: Math.cos(ang) * cosP,
      dirY: Math.sin(pitch), speed: 14, damage: 12, traveled: 0, range: 12,
    });
    actions.playSfx("tone:600:40:sine", 0.3);
  }
  return { tick };
}
