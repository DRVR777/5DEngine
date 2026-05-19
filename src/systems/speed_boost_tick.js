const BOOST_MUL     = 1.5;
const TRAIL_PERIOD  = 0.08; // seconds between trail particle bursts

export function mountSpeedBoostTick({ get, set, actions }) {
  function tick(dt, { isMoving, inCar, buildMode, heroDead }) {
    if (get.speedBoostT() <= 0) return 1.0;
    set.speedBoostT(get.speedBoostT() - dt);
    if (isMoving && !inCar && !buildMode && !heroDead) {
      set.speedTrailT(get.speedTrailT() - dt);
      if (get.speedTrailT() <= 0) {
        set.speedTrailT(TRAIL_PERIOD);
        actions.spawnTrail();
      }
    }
    return get.speedBoostT() > 0 ? BOOST_MUL : 1.0;
  }
  return { tick };
}
