const WHEEL_RADIUS = 0.35;
const DRONE_ROT_FAST = 28;
const DRONE_ROT_IDLE = 12;
const DRONE_TILT_AMT = 0.18;
const MECH_SWING_AMP = 0.35;

export function mountVehicleRenderTick() {
  function tick(dt, { vehicleDefs, vehicleMeshes, vehicleStates, activeVehicleId, inCar, keys, toRenderPos }) {
    for (const vDef of vehicleDefs) {
      const vp = toRenderPos(vDef.id); if (!vp) continue;
      const vst  = vehicleStates.get(vDef.id);
      const vGrp = vehicleMeshes.get(vDef.id); if (!vGrp) continue;
      vGrp.position.set(vp.x, vp.y, vp.z);
      if (vDef.type === "drone") {
        vGrp.visible = true;
        vGrp.rotation.y = vst ? vst.heading : 0;
        const rotSpd = (vst && vst.speed > 0.5) ? DRONE_ROT_FAST : DRONE_ROT_IDLE;
        if (vGrp._rotors) for (const r of vGrp._rotors) r.rotation.y += dt * rotSpd;
        const tiltAmt = inCar && activeVehicleId === vDef.id && vst && vst.speed > 0.3 ? DRONE_TILT_AMT : 0;
        vGrp.rotation.x += (tiltAmt * (keys["KeyW"] ? -1 : keys["KeyS"] ? 1 : 0) - vGrp.rotation.x) * Math.min(1, dt * 6);
        vGrp.rotation.z += (tiltAmt * (keys["KeyD"] ? -1 : keys["KeyA"] ? 1 : 0) - vGrp.rotation.z) * Math.min(1, dt * 6);
      } else if (vDef.type === "mech") {
        vGrp.rotation.y = vst ? vst.heading : 0;
        vGrp.visible = true;
        if (vGrp._legs && vst) {
          const mechWalk = (vst._walkT = (vst._walkT || 0) + dt * Math.abs(vst.speed) * 0.8);
          const mechSwing = Math.sin(mechWalk) * MECH_SWING_AMP;
          if (vGrp._legs[0]) vGrp._legs[0].thighM.rotation.x =  mechSwing;
          if (vGrp._legs[1]) vGrp._legs[1].thighM.rotation.x = -mechSwing;
        }
      } else {
        vGrp.rotation.y = vst ? vst.heading : 0;
        if (vGrp._wheels && vst && vst.speed !== 0) {
          const spinDelta = (vst.speed / WHEEL_RADIUS) * dt;
          for (const wh of vGrp._wheels) wh.rotation.x -= spinDelta;
        }
        vGrp.visible = true;
      }
    }
  }
  return { tick };
}
