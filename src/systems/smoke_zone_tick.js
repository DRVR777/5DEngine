const SPAWN_PROB   = 0.8;
const Y_BASE       = 0.5;
const Y_RAND_SCALE = 1.5;

export function mountSmokeZoneTick({ actions, random = Math.random }) {
  function tick(dt, { zones }) {
    for (let i = zones.length - 1; i >= 0; i--) {
      const sz = zones[i];
      sz.timeLeft -= dt;
      if (sz.timeLeft <= 0) { zones.splice(i, 1); continue; }
      if (random() < SPAWN_PROB) {
        actions.spawnSmoke(
          sz.u + (random() - 0.5) * sz.radius,
          Y_BASE + random() * Y_RAND_SCALE,
          sz.v + (random() - 0.5) * sz.radius
        );
      }
    }
  }
  return { tick };
}
