export function mountDodgeTick({ get, set, actions }) {
  function tick(dt) {
    if (get.dodgeCooldown() > 0) set.dodgeCooldown(get.dodgeCooldown() - dt);
    if (get.dodgeT() <= 0) { set.dodgeBashDone(false); return; }
    set.dodgeT(get.dodgeT() - dt);
    const pos = actions.getPos();
    actions.setPos(pos.x, pos.y, pos.z, pos.u + get.dodgeVelU() * dt, pos.v + get.dodgeVelV() * dt);
    actions.spawnTrail(pos.u, pos.y, pos.v);
    if (!get.dodgeBashDone() && actions.tryBash(pos)) set.dodgeBashDone(true);
  }
  return { tick };
}
