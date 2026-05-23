export function mountHeroKnockbackTick({ get, set, actions }) {
  function tick(dt) {
    if (get.kbT() <= 0) return;
    set.kbT(get.kbT() - dt);
    const pos = actions.getPos();
    const mover = { u: pos.u, v: pos.v, hitbox: { w: 0.5, d: 0.5 } };
    actions.resolveMove(mover, get.kbU() * dt, get.kbV() * dt);
    actions.setPos(pos.x, pos.y, pos.z, mover.u, mover.v);
    set.kbU(get.kbU() * Math.max(0, 1 - dt * 8));
    set.kbV(get.kbV() * Math.max(0, 1 - dt * 8));
  }
  return { tick };
}
