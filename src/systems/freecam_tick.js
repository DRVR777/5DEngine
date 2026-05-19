export function mountFreecamTick({ get, actions }) {
  function tick(dt, { buildMode, speed, speedFast, keys }) {
    if (!buildMode) return;
    const spd   = keys["ShiftLeft"] ? speedFast : speed;
    const yaw   = get.yaw(),  pitch = get.pitch();
    const fwdX  = Math.sin(yaw) * Math.cos(pitch);
    const fwdZ  = Math.cos(yaw) * Math.cos(pitch);
    const fwdY  = Math.sin(pitch);
    const rgtX  = Math.cos(yaw);
    const rgtZ  = -Math.sin(yaw);
    if (keys["KeyW"]) actions.move( fwdX * spd * dt,  fwdY * spd * dt,  fwdZ * spd * dt);
    if (keys["KeyS"]) actions.move(-fwdX * spd * dt, -fwdY * spd * dt, -fwdZ * spd * dt);
    if (keys["KeyA"]) actions.move(-rgtX * spd * dt, 0, -rgtZ * spd * dt);
    if (keys["KeyD"]) actions.move( rgtX * spd * dt, 0,  rgtZ * spd * dt);
    if (keys["Space"])  actions.moveY( spd * dt);
    if (keys["KeyC"])   actions.moveY(-spd * dt);
  }
  return { tick };
}
