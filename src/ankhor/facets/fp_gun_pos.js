/** fp_gun_pos — magic numbers preserved from mountFpGunPosTick */
export default {
  priority: 88,
  tick(_t, data, dt, _r) {
    if (!data.active) return;
    const aim = data.aiming ? -0.08 : 0;
    let rd = 0;
    if (data.reloading) {
      const p = Math.min(1, (Date.now() - (data.reloadStart || 0)) / (data.reloadDur || 1500));
      rd = p < 0.2 ? p / 0.2 : p < 0.8 ? 1.0 : 1 - (p - 0.8) / 0.2;
    }
    let sw = (data.weaponSwitchT || 0);
    if (sw > 0) { sw = Math.max(0, sw - dt); data.weaponSwitchT = sw; }
    const sd = sw > 0 ? (sw > 0.15 ? ((0.30 - sw) / 0.15 * -0.44) : (sw / 0.15 * -0.44)) : 0;
    const bs = data.aiming ? 0.25 : 1;
    const by = Math.sin(data.gunBobPhase || 0) * (data.canSprint ? 0.022 : 0.013) * bs;
    const bx = Math.sin((data.gunBobPhase || 0) * 0.5) * (data.canSprint ? 0.014 : 0.008) * bs;
    data.gunX = 0.22 + aim + rd * 0.10 + bx;
    data.gunY = -0.24 - rd * 0.30 + sd + by;
    data.gunZ = -0.45 + (data.gunKickZ || 0) * 0.6 + rd * 0.05;
    data.gunRX = rd * 0.42 + (data.gunReloadX || 0) * 0.05;
    data.gunRY = rd * -0.22;
    data.gunRZ = (data.meleeSwing || 0) * 0.9;
  }
};
