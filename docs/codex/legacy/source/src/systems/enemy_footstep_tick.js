const DETECT_RADIUS = 12;
const VOL_BASE      = 0.10;
const VOL_THRESHOLD = 0.012;
const FREQ_HEAVY    = 32;
const FREQ_FAST     = 62;
const FREQ_NORMAL   = 46;
const INT_FAST      = 0.28;
const INT_HEAVY     = 0.50;
const INT_NORMAL    = 0.40;
const INT_IDLE      = 0.40;

export function mountEnemyFootstepTick({ get, set, actions }) {
  function tick(dt, { enemies, heroDead }) {
    if (heroDead) { set.enFsT(INT_IDLE); return; }
    const newT = get.enFsT() - dt;
    set.enFsT(newT);
    if (newT > 0) return;

    const heroPos = actions.getHeroPos();
    if (!heroPos) { set.enFsT(INT_IDLE); return; }

    let nearEn = null, nearDist = Infinity;
    for (const en of enemies) {
      if (en.dead) continue;
      const ep = actions.getEnemyPos(en.id);
      if (!ep) continue;
      const d = Math.hypot(ep.u - heroPos.u, ep.v - heroPos.v);
      if (d < nearDist) { nearDist = d; nearEn = en; }
    }

    if (nearEn && nearDist < DETECT_RADIUS) {
      const interval = nearEn.type === "fast" ? INT_FAST : nearEn.type === "heavy" ? INT_HEAVY : INT_NORMAL;
      set.enFsT(interval);
      const vol = Math.max(0, VOL_BASE * (1 - nearDist / DETECT_RADIUS));
      if (vol > VOL_THRESHOLD) {
        const freq = nearEn.type === "heavy" ? FREQ_HEAVY : nearEn.type === "fast" ? FREQ_FAST : FREQ_NORMAL;
        actions.playSfx(`tone:${freq}:22:triangle`, vol);
      }
    } else {
      set.enFsT(INT_IDLE);
    }
  }
  return { tick };
}
