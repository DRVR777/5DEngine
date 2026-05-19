const LOW_HP_FRAC   = 0.3;
const PULSE_BASE    = 0.22;
const PULSE_AMP     = 0.12;
const PULSE_PERIOD  = 350;   // ms
const SPRING_RATE   = 6;

export function mountVignetteTick({ get, set }) {
  function tick(dt, now, heroHp, heroMaxHp, el) {
    const lowHpPulse = heroHp < heroMaxHp * LOW_HP_FRAC
      ? PULSE_BASE + Math.sin(now / PULSE_PERIOD) * PULSE_AMP : 0;
    set.vignetteAmt(get.vignetteAmt() + (lowHpPulse - get.vignetteAmt()) * Math.min(1, dt * SPRING_RATE));
    if (el) el.style.opacity = get.vignetteAmt().toFixed(3);
  }
  return { tick };
}
