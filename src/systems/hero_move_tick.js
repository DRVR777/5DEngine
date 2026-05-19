const SLIDE_DUR = 0.6;
const SLIDE_MULT = 1.5;

export function mountHeroMoveTick({ get, set, actions }) {
  function tick(dt, { inputF, inputR, forward, right, speed, sprintSpeed, canSprint, isMoving, heroDead, buildMode, ctrlDown, blockers }) {
    if (!get.ctrlWasDown() && ctrlDown && canSprint && isMoving && get.slideT() <= 0 && !heroDead && !buildMode) {
      const du = inputF * forward.x + inputR * right.x;
      const dv = inputF * forward.z + inputR * right.z;
      const mag = Math.hypot(du, dv) || 1;
      set.slideT(SLIDE_DUR);
      set.slideDU((du / mag) * sprintSpeed * SLIDE_MULT);
      set.slideDV((dv / mag) * sprintSpeed * SLIDE_MULT);
      actions.playSlideSound();
    }
    set.ctrlWasDown(ctrlDown);
    let effF = inputF, effR = inputR, effSpeed = speed;
    if (get.slideT() > 0) {
      set.slideT(get.slideT() - dt);
      const decay = Math.max(0, get.slideT() / SLIDE_DUR);
      actions.slideMove(get.slideDU() * decay * dt, get.slideDV() * decay * dt, blockers);
      actions.spawnTrail();
      effF = 0; effR = 0; effSpeed = 0;
    }
    actions.applyMove(effF, effR, forward, right, effSpeed, dt, blockers);
  }
  return { tick };
}
