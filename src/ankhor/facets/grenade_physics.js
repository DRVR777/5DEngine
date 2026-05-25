export default {
  priority: 50,
  tick(_t, data, dt, _r) {
    const gs = data.grenades; if (!gs || !gs.length) return;
    const grav = data.gravity || -9.8;
    for (let i = gs.length - 1; i >= 0; i--) {
      const g = gs[i];
      g.fuse = (g.fuse || 3) - dt;
      g.velY = (g.velY || 0) + grav * dt;
      g.u = (g.u || 0) + (g.velU || 0) * dt;
      g.y = (g.y || 1) + g.velY * dt;
      g.v = (g.v || 0) + (g.velV || 0) * dt;
      if (g.y <= 0) { g.y = 0; g.velY = Math.abs(g.velY) * 0.35; g.velU *= 0.6; g.velV *= 0.6; }
      if (g.fuse <= 0 || (g.y <= 0 && g.fuse <= 0)) { gs.splice(i, 1); g.data.exploded = true; }
    }
  }
};
