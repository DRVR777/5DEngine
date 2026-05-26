/** enemy_sep — SEP_DIST=1.2, SEP_PUSH=0.6, separation force between enemies */
const SEP_DIST = 1.2;
const SEP_PUSH = 0.6;

export default {
  priority: 30,
  tick(_t, data, dt, _r) {
    const enemies = data.enemies; if (!enemies || enemies.length < 2) return;
    for (let i = 0; i < enemies.length; i++) {
      const ea = enemies[i]; if (ea.dead) continue;
      for (let j = i + 1; j < enemies.length; j++) {
        const eb = enemies[j]; if (eb.dead) continue;
        const dx = eb.u - ea.u, dz = eb.v - ea.v;
        const d = Math.hypot(dx, dz);
        if (d < SEP_DIST && d > 0.01) {
          const push = (SEP_DIST - d) / SEP_DIST * SEP_PUSH;
          const nx = dx / d, nz = dz / d;
          ea.u -= nx * push * dt;
          ea.v -= nz * push * dt;
          eb.u += nx * push * dt;
          eb.v += nz * push * dt;
        }
      }
    }
  }
};
