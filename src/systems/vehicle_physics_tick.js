const DRONE_H  = 15;  // horizontal speed (m/s)
const DRONE_V  = 7;   // vertical speed (m/s)
const DRONE_MAX_ALT = 40;

export function mountVehiclePhysicsTick({ actions }) {
  function tickDrone(vDef, vSt, activeVehicleId, dt) {
    if (vSt.altY == null) vSt.altY = 0;
    const mf = (actions.key("KeyW") ? 1 : 0) - (actions.key("KeyS") ? 1 : 0);
    const mr = (actions.key("KeyD") ? 1 : 0) - (actions.key("KeyA") ? 1 : 0);
    const mv = (actions.key("Space") ? 1 : 0) - (actions.key("KeyC") ? 1 : 0);
    vSt.altY = Math.max(0, Math.min(DRONE_MAX_ALT, vSt.altY + mv * DRONE_V * dt));
    const cp = actions.getPos(activeVehicleId);
    if (!cp) return;
    const camYaw = actions.getCamYaw();
    const dfx = Math.sin(camYaw), dfz = Math.cos(camYaw);
    const drx = Math.cos(camYaw), drz = -Math.sin(camYaw);
    const du = (dfx * mf + drx * mr) * DRONE_H * dt;
    const dv = (dfz * mf + drz * mr) * DRONE_H * dt;
    actions.setPos(activeVehicleId, 0, vSt.altY, 0, cp.u + du, cp.v + dv);
    actions.setPos("hero", 0, vSt.altY, 0, cp.u + du, cp.v + dv);
    vSt.speed = Math.hypot(du, dv) / dt;
    if (mf !== 0 || mr !== 0) vSt.heading = Math.atan2(dfx * mf + drx * mr, dfz * mf + drz * mr);
    actions.updateCarState(vSt);
  }

  function tickGround(vDef, vSt, activeVehicleId, dt, blockers) {
    const throttle  = (actions.key("KeyW") ? 1 : 0) - (actions.key("KeyS") ? 1 : 0);
    const steerIn   = (actions.key("KeyA") ? 1 : 0) - (actions.key("KeyD") ? 1 : 0);
    const handbrake = !!actions.key("Space");
    const next = actions.carPhysicsStep(activeVehicleId, vSt, throttle, steerIn, dt, {
      blockers,
      carHitbox:    vDef ? vDef.hitbox      : { w: 2, d: 4 },
      handbrake,
      maxSpeed:     vDef ? vDef.maxSpeed    : 24,
      acceleration: vDef ? vDef.acceleration : 8,
      braking:      vDef ? vDef.braking     : 18,
      handling:     vDef ? vDef.handling    : 1.0,
    });
    vSt.speed = next.speed; vSt.heading = next.heading;
    vSt.gear  = next.gear;  vSt.gearName = next.gearName;
    actions.updateCarState(vSt);
    const cp = actions.getPos(activeVehicleId);
    if (cp) actions.setPos("hero", 0, 0, 0, cp.u, cp.v);
    if (vSt.speed > 0.01) actions.markPlatformDirty();
  }

  function tick(dt, { vDef, vSt, activeVehicleId, blockers }) {
    if (vDef && vDef.type === "drone") {
      tickDrone(vDef, vSt, activeVehicleId, dt);
    } else {
      tickGround(vDef, vSt, activeVehicleId, dt, blockers);
    }
  }

  return { tick, tickDrone, tickGround };
}
