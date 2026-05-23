const WARN_FUSE_THRESH = 2.0;
const WARN_RADIUS      = 6.0;
const PULSE_BASE       = 0.5;
const PULSE_AMP        = 0.5;
const PULSE_PERIOD     = 100;
const OPACITY_BASE     = 0.6;
const OPACITY_PULSE    = 0.4;
const SCALE_BASE       = 0.92;
const SCALE_PULSE      = 0.12;

export function mountGrenadeWarnTick({ actions }) {
  function tick(_dt, { grenades, heroU, heroV, nowMs }) {
    const el = actions.getWarnEl();
    if (!el) return;

    let near = false;
    for (const g of grenades) {
      if (g.fuse < WARN_FUSE_THRESH && Math.hypot(g.u - heroU, g.v - heroV) < WARN_RADIUS) {
        near = true;
        break;
      }
    }

    el.style.display = near ? "block" : "none";
    if (near) {
      const pulse = PULSE_BASE + PULSE_AMP * Math.sin(nowMs / PULSE_PERIOD);
      el.style.opacity = String(OPACITY_BASE + pulse * OPACITY_PULSE);
      el.style.transform = `translate(-50%,-50%) scale(${SCALE_BASE + pulse * SCALE_PULSE})`;
    }
  }
  return { tick };
}
