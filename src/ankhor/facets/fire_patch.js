export default {
  priority: 55,
  tick(_t, data, dt, _r) {
    const patches = data.patches; if (!patches || !patches.length) return;
    const heroU = data.heroU || 0, heroV = data.heroV || 0;
    for (let i = patches.length - 1; i >= 0; i--) {
      const fp = patches[i];
      fp.timeLeft -= dt;
      if (fp.timeLeft <= 0) { patches.splice(i, 1); continue; }
      if (Math.hypot(heroU - fp.u, heroV - fp.v) < (fp.radius || 1)) {
        fp.dmgT = (fp.dmgT || 0) - dt;
        if (fp.dmgT <= 0) {
          fp.dmgT = 0.5;
          data.heroHp = Math.max(0, (data.heroHp || 100) - 6);
          data.heroFireT = Math.max(data.heroFireT || 0, 2.5);
        }
      }
    }
  }
};
