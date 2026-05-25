/** grenade_warn — magic numbers: WARN_FUSE_THRESH=2.0, WARN_RADIUS=6.0, PULSE_BASE=0.5, PULSE_AMP=0.5, PULSE_PERIOD=100, OPACITY_BASE=0.6, OPACITY_PULSE=0.4, SCALE_BASE=0.92, SCALE_PULSE=0.12 */
export default {
  priority: 82,
  tick(_t, data, _dt, _r) {
    const gs = data.grenades; if (!gs || !gs.length) { data.warnVisible = false; return; }
    const hu = data.heroU || 0, hv = data.heroV || 0;
    let near = false;
    for (const g of gs) {
      if ((g.fuse || 0) < 2.0 && Math.hypot((g.u || 0) - hu, (g.v || 0) - hv) < 6.0) { near = true; break; }
    }
    data.warnVisible = near;
    if (near) {
      const p = 0.5 + 0.5 * Math.sin(Date.now() / 100);
      data.warnOpacity = 0.6 + p * 0.4;
      data.warnScale = 0.92 + p * 0.12;
    }
  }
};
