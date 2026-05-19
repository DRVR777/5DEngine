export function mountStaminaTick({ STAMINA_DRAIN, STAMINA_REGEN, STAMINA_MAX, STAMINA_LOCKOUT, get, set }) {
  function tick(dt, { wantsSprint, isSprinting, inputMoving }) {
    if (get.heroEmpT() > 0) set.heroEmpT(get.heroEmpT() - dt);
    const canSprint = wantsSprint && get.stamina() >= (isSprinting ? 1 : STAMINA_LOCKOUT) && get.heroEmpT() <= 0;
    if (canSprint && inputMoving) {
      set.stamina(Math.max(0, get.stamina() - STAMINA_DRAIN * dt));
    } else if (!wantsSprint || get.stamina() <= 0) {
      set.stamina(Math.min(STAMINA_MAX + get.heroExtraStaminaMax(), get.stamina() + STAMINA_REGEN * dt));
    }
    return canSprint;
  }
  return { tick };
}
