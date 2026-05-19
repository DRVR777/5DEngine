export function mountMotionSprings({ get, set }) {
  function tick(dt, { moveSpreadTarget, isMoving, inCar, buildMode, heroDead, canSprint, inputR, aiming }) {
    set.moveSpread(get.moveSpread() + (moveSpreadTarget - get.moveSpread()) * Math.min(1, dt * 5));
    if (isMoving && !inCar && !buildMode && !heroDead) {
      set.gunBobPhase(get.gunBobPhase() + (canSprint ? 11 : 7) * dt);
    } else {
      set.gunBobPhase(get.gunBobPhase() * Math.exp(-dt * 8));
    }
    const rollTarget = inputR * (aiming ? 0.3 : 1.0);
    set.strafeRollAmt(get.strafeRollAmt() + (rollTarget - get.strafeRollAmt()) * Math.min(1, dt * 8));
  }
  return { tick };
}
