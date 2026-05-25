/** camera_pos facet — preserves ALL magic numbers from mountCameraPosTick */
export default {
  priority: 90,
  tick(_t, data, _dt, _r) {
    const fp = data.firstPerson, bm = data.buildMode;
    const hu = data.heroU || 0, hy = data.heroY || 0, hv = data.heroV || 0;
    const cy = data.camYaw || 0, cp = data.camPitch || 0;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const sx = Math.cos(cy), sz = -Math.sin(cy);
    data.camTarget = { x: hu, y: hy + (fp ? 1.78 - (data.crouchAmt || 0) * 0.75 : 1.20 - (data.crouchAmt || 0) * 0.40), z: hv };
    if (bm) { data.camPos = { x: data.freeCamX || 0, y: data.freeCamY || 0, z: data.freeCamZ || 0 }; }
    else if (fp) {
      const bs = (data.aiming ? 0.15 : 1) * (data.canSprint ? 0.028 : 0.014);
      data.camPos = { x: hu, y: hy + 1.78 - (data.crouchAmt || 0) * 0.75 + Math.sin(data.gunBobPhase || 0) * bs, z: hv };
      data.roll = -(data.strafeRollAmt || 0) * 0.025;
    } else {
      const sa = Math.min(2.2, (data.dist || 6) * 0.38) * (data.camSide || 0);
      data.camPos = { x: hu - fx * Math.cos(cp) * (data.dist || 6) + sx * sa, y: hy + Math.sin(-cp) * (data.dist || 6) + 1.2, z: hv - fz * Math.cos(cp) * (data.dist || 6) + sz * sa };
    }
  }
};
