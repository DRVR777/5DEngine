/** armor_shard — magic numbers: COLLECT_DIST=1.2, MAGNET_DIST=3.0, MAGNET_SPEED=9, SPIN_Y=3.0, SPIN_X=1.8, BOB_BASE=0.5, BOB_PERIOD=260, BOB_AMP=0.12 */
export default {
  priority: 72,
  tick(_t, data, dt, _r) {
    const ps = data.pickups; if (!ps || !ps.length) return;
    const hu = data.heroU || 0, hv = data.heroV || 0;
    for (let i = ps.length - 1; i >= 0; i--) {
      const a = ps[i]; const d = Math.hypot(hu - a.u, hv - a.v);
      if (d < 1.2) { ps.splice(i, 1); data.armorGained = (data.armorGained || 0) + (a.amount || 0); }
      else { a.spinY = (a.spinY || 0) + dt * 3.0; a.spinX = (a.spinX || 0) + dt * 1.8; a.bobY = 0.5 + Math.sin(Date.now() / 260 + a.u) * 0.12;
        if (d < 3.0 && d > 0) { const p = 9 * (1 - d / 3.0); a.u += ((hu - a.u) / d) * p * dt; a.v += ((hv - a.v) / d) * p * dt; } }
    }
  }
};
