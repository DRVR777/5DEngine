const APPLY_INTERVAL = 0.8;
const FADE_WINDOW    = 1.0;
const OPACITY_BASE   = 0.5;
const FLICKER_AMP    = 0.3;
const FLICKER_PERIOD = 200;

export function mountPoisonPuddleTick({ actions }) {
  function tick(dt, { pickups, heroU, heroV, nowMs }) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pp = pickups[i];
      pp.timeLeft -= dt;
      if (pp.timeLeft <= 0) {
        actions.removeMesh(pp.mesh);
        pickups.splice(i, 1);
        continue;
      }
      pp.mesh.material.opacity =
        OPACITY_BASE * Math.min(1, pp.timeLeft / FADE_WINDOW) *
        (1 - FLICKER_AMP + FLICKER_AMP * Math.sin(nowMs / FLICKER_PERIOD));
      if (Math.hypot(heroU - pp.u, heroV - pp.v) < pp.radius) {
        pp.applyT -= dt;
        if (pp.applyT <= 0) {
          pp.applyT = APPLY_INTERVAL;
          actions.applyPoison();
        }
      }
    }
  }
  return { tick };
}
