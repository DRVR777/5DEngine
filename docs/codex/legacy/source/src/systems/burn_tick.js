const BURN_DMG        = 3;
const BURN_DMG_PERIOD = 0.5;

export function mountBurnTick({ get, set, actions }) {
  function tick(dt, nowSec) {
    if (get.heroFireT() <= 0 || get.heroDead()) return;
    set.heroFireT(get.heroFireT() - dt);
    set.heroFireDmgT(get.heroFireDmgT() - dt);
    if (get.heroFireDmgT() <= 0) {
      set.heroFireDmgT(BURN_DMG_PERIOD);
      const godMode = typeof Engine !== "undefined" && Engine.debug.godMode;
      if (!godMode) {
        set.heroHp(Math.max(0, get.heroHp() - BURN_DMG));
        set.heroLastDamageT(nowSec);
      }
      const pos = get.heroPos();
      actions.spawnParticles(
        pos.u + (Math.random() - 0.5) * 0.6,
        pos.y + 0.8 + Math.random() * 0.8,
        pos.v + (Math.random() - 0.5) * 0.6,
        2, "orange", 2.5, 0.5,
      );
    }
    if (get.heroFireT() <= 0) set.heroFireT(0);
    if (get.heroHp() <= 0 && !get.heroDead()) actions.heroShowDeathScreen();
  }
  return { tick };
}
