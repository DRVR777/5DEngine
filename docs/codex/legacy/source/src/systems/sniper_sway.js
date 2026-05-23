// iter 431: sway is absolute per-frame, not accumulated — subtract before re-applying.
export function mountSniperSway({ get, set }) {
  function tick(dt, { isSniperScope, heroDead, holdingBreath, crouching }) {
    if (isSniperScope && !heroDead) {
      set.scopeSwayT(get.scopeSwayT() + dt);
      let breathHoldT = get.breathHoldT();
      breathHoldT = holdingBreath
        ? Math.min(breathHoldT + dt, 3.0)
        : Math.max(0, breathHoldT - dt * 2.5);
      set.breathHoldT(breathHoldT);
      const breathMul = breathHoldT < 1.5
        ? (holdingBreath ? 0.05 + (breathHoldT / 1.5) * 0.05 : 1.0)
        : 1.0 + (breathHoldT - 1.5) * 2.2;
      const swayMul = (crouching ? 0.25 : 1.0) * breathMul;
      const t = get.scopeSwayT();
      set.camPitch(get.camPitch() - get.lastSwayPitch());
      set.camYaw(get.camYaw() - get.lastSwayYaw());
      const newPitch = Math.sin(t * 0.9) * 0.0025 * swayMul;
      const newYaw   = Math.sin(t * 0.6 + 1.2) * 0.002  * swayMul;
      set.lastSwayPitch(newPitch);
      set.lastSwayYaw(newYaw);
      set.camPitch(get.camPitch() + newPitch);
      set.camYaw(get.camYaw() + newYaw);
    } else {
      set.camPitch(get.camPitch() - get.lastSwayPitch());
      set.camYaw(get.camYaw() - get.lastSwayYaw());
      set.lastSwayPitch(0);
      set.lastSwayYaw(0);
      set.scopeSwayT(0);
      set.breathHoldT(0);
    }
  }
  return { tick };
}
