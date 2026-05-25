export default {
  priority: 70,
  tick(_thing, data, dt, _registry) {
    const pickups = data.pickups;
    if (!pickups || !pickups.length) return;
    const heroU = data.heroU || 0, heroV = data.heroV || 0;
    for (let i = pickups.length - 1; i >= 0; i--) {
      const ap = pickups[i];
      const d = Math.hypot(heroU - ap.u, heroV - ap.v);
      if (d < 1.2) {
        pickups.splice(i, 1);
        data.collectedAmmo = (data.collectedAmmo || 0) + (ap.qty || 0);
      } else {
        ap.spin = (ap.spin || 0) + dt * 2.5;
        ap.bob = 0.4 + Math.sin((Date.now() / 280) + ap.u) * 0.08;
        if (d < 3.0 && d > 0) {
          const pull = 8 * (1 - d / 3.0);
          ap.u += ((heroU - ap.u) / d) * pull * dt;
          ap.v += ((heroV - ap.v) / d) * pull * dt;
        }
      }
    }
  }
};
