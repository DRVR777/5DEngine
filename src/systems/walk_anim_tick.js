const SWING = 1.3;
const KNEE  = 0.75;

export function mountWalkAnimTick({ get, set, actions }) {
  function tick(dt, { groundSpeed, aimAmt, reloading }) {
    const wc = actions.walkCycle(dt, groundSpeed);

    actions.setThighs(wc.swing * SWING);
    actions.setShins(wc.swing * SWING);

    const aimRaise = -Math.PI / 2 * aimAmt;
    const walkArmL = -wc.swing * SWING * 0.7;
    const walkArmR =  wc.swing * SWING * 0.7;
    actions.setArms(walkArmL * (1 - aimAmt) + aimRaise, walkArmR * (1 - aimAmt) + aimRaise);

    let kz = get.gunKickZ();
    kz += (0 - kz) * Math.min(1, dt * 18);
    set.gunKickZ(kz);

    const tiltTarget = reloading ? 0.75 : 0;
    let rx = get.gunReloadX();
    rx += (tiltTarget - rx) * Math.min(1, dt * 10);
    set.gunReloadX(rx);

    const gunSwayX = Math.sin(wc.t * 2.2 + Math.PI) * wc.speed * 0.018;
    actions.setGunMount(0, -0.7 + wc.bob * 0.3, 0.2 + kz, rx, 0, gunSwayX);
    actions.setTorsoY(1.25 + wc.bob);
  }
  return { tick };
}
