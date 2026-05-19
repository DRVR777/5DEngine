// Fast enemy charge: bursts toward hero at 2.2x speed for 0.38s, every 3.5-5.5s when 2-8m away.
// getEnemyPos, resolveMove, setEnemyPos are raw materials bound at mount.
// Magic numbers: distMin=2.0, distMax=8, intervalBase=3.5, intervalRange=2.0, defaultInterval=4.0,
//   chargeDur=0.38, chargeSpeedMul=2.2, hitboxW=0.7, hitboxD=0.7.
export function mountEnemyFastChargeTick({ getEnemyPos, resolveMove, setEnemyPos, actions }) {
  function tick(dt, en, { canSee, dist, ep, nowSec, dx, dz }) {
    if (en.type !== "fast") return;
    if (canSee && dist > 2.0 && dist < 8) {
      if (!en._chargeCD || nowSec - en._chargeCD > (en._chargeInterval || 4.0)) {
        en._chargeCD = nowSec;
        en._chargeInterval = 3.5 + Math.random() * 2.0;
        en._chargeDur = 0.38;
        en._chargeDirU = dx / (dist || 1);
        en._chargeDirV = dz / (dist || 1);
        actions.playSfx("tone:760:40:square", 0.18);
        actions.spawnParticles(ep.u, ep.y + 0.5, ep.v, 6, "orange", 6, 0.14);
      }
    }
    if (en._chargeDur > 0) {
      en._chargeDur -= dt;
      const pos = getEnemyPos(en.id);
      const mover = { u: pos.u, v: pos.v, hitbox: { w: 0.7, d: 0.7 } };
      resolveMove(mover, en._chargeDirU * en.moveSpeed * 2.2 * dt, en._chargeDirV * en.moveSpeed * 2.2 * dt);
      setEnemyPos(en.id, pos.x, 0, 0, mover.u, mover.v);
    }
  }
  return { tick };
}
