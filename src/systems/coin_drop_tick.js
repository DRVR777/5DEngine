const COLLECT_DIST = 1.2;
const MAGNET_DIST  = 3.0;
const MAGNET_SPEED = 9;
const SPIN_SPEED   = 2.8;
const BOB_BASE     = 0.5;
const BOB_AMP      = 0.08;
const BOB_PERIOD   = 310;

export function mountCoinDropTick({ actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const cd = pickups[i];
      const d = Math.hypot(heroU - cd.u, heroV - cd.v);
      if (d < COLLECT_DIST) {
        pickups.splice(i, 1);
        actions.removeMesh(cd.mesh);
        actions.addScore(cd.value);
        actions.playSfx("blip", 0.55);
        actions.spawnDamageNumber(cd.u, 0.8, cd.v, `+${cd.value}`, "#ffd166");
      } else {
        cd.mesh.rotation.y += dt * SPIN_SPEED;
        cd.mesh.position.y = BOB_BASE + Math.sin(nowMs / BOB_PERIOD + cd.u) * BOB_AMP;
        if (d < MAGNET_DIST && d > 0) {
          const pull = MAGNET_SPEED * (1 - d / MAGNET_DIST);
          cd.u += ((heroU - cd.u) / d) * pull * dt;
          cd.v += ((heroV - cd.v) / d) * pull * dt;
          cd.mesh.position.x = cd.u;
          cd.mesh.position.z = cd.v;
        }
      }
    }
  }
  return { tick };
}
