const INTERVAL_SPRINT  = 0.26;
const INTERVAL_WALK    = 0.38;
const INTERVAL_CROUCH  = 0.55;

export function mountFootstepSound({ get, set, actions }) {
  function tick(dt, { isMoving, heroDead, pointerLocked, canSprint, crouching, onGround = true }) {
    if (isMoving && !heroDead && pointerLocked && onGround) {
      const next = get.footstepT() - dt;
      set.footstepT(next);
      if (next <= 0) {
        const interval = canSprint ? INTERVAL_SPRINT : (crouching ? INTERVAL_CROUCH : INTERVAL_WALK);
        set.footstepT(interval);
        const freq = 80 + Math.random() * 40;
        actions.playSfx(`tone:${Math.round(freq)}:30:triangle`, 0.08);
      }
    } else {
      set.footstepT(0);
    }
  }
  return { tick };
}
