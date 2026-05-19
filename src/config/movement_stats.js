// Hero movement and camera constants — CFG-derived speeds + hardcoded limits.
export const CAM_DIST_MIN = 0;
export const CAM_DIST_MAX = 15;

// makeMovementStats(CFG) → { GRAVITY, JUMP_V, WALK, SPRINT }
export function makeMovementStats(CFG) {
  return {
    GRAVITY: CFG.gravity      || -25,
    JUMP_V:  CFG.jumpVelocity || 13,
    WALK:    CFG.walkSpeed    || 5,
    SPRINT:  CFG.sprintSpeed  || 9,
  };
}
