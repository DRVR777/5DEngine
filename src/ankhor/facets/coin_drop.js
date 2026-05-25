export default {
  priority: 70,
  tick(_t, data, dt, _r) {
    const p = data.pickups; if (!p || !p.length) return;
    const hu = data.heroU || 0, hv = data.heroV || 0;
    for (let i = p.length - 1; i >= 0; i--) {
      const c = p[i]; const d = Math.hypot(hu - c.u, hv - c.v);
      if (d < 1.2) { p.splice(i, 1); data.score = (data.score || 0) + (c.value || 0); }
      else { c.spin = (c.spin || 0) + dt * 2.8; c.bob = 0.5 + Math.sin((Date.now() / 310) + c.u) * 0.08;
        if (d < 3.0 && d > 0) { const pl = 9 * (1 - d / 3.0); c.u += ((hu - c.u) / d) * pl * dt; c.v += ((hv - c.v) / d) * pl * dt; } }
    }
  }
};
