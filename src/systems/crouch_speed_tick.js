// Crouching spring (lerp [0..1]), crouch speed multiplier, move-spread target,
// and sprint trail particle burst — all driven by the same input state.
export function mountCrouchSpeedTick({ actions }) {
  let crouchAmt = 0; // spring: 0=standing, 1=fully crouched

  function tick(dt, { keys, buildMode, inCar, computerOpen, heroDead, aiming, isSprinting, isMoving, pointerLocked }) {
    const crouching = !!(keys["ControlLeft"] || keys["ControlRight"]) && !buildMode && !inCar && !computerOpen;
    crouchAmt += ((crouching ? 1 : 0) - crouchAmt) * Math.min(1, dt * 12);
    const crouchSpeedMul = 1 - crouchAmt * 0.4;

    const moveSpreadTarget = aiming
      ? 0
      : isSprinting
        ? 1
        : isMoving
          ? (crouching ? 0.18 : 0.45)
          : (crouching ? 0 : 0);

    if (isSprinting && isMoving && !heroDead && pointerLocked && Math.random() < 0.45) {
      actions.spawnSprintTrail();
    }

    return { crouching, crouchAmt, crouchSpeedMul, moveSpreadTarget };
  }

  return { tick };
}
