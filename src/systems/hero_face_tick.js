export function mountHeroFaceTick({ get, set }) {
  function tick(dt, { aiming, inputF, inputR, forward, right, camYaw }) {
    const targetY = aiming
      ? camYaw
      : (inputF !== 0 || inputR !== 0)
          ? Math.atan2(forward.x * inputF + right.x * inputR,
                       forward.z * inputF + right.z * inputR)
          : camYaw;
    const turnRate = aiming ? 25 : 10;
    let diff = targetY - get.rotY();
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    set.rotY(get.rotY() + diff * Math.min(1, dt * turnRate));
  }
  return { tick };
}
