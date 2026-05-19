const GRAD_HP_HIGH = "linear-gradient(90deg,#00ffaa,#00ccff)";
const GRAD_HP_MID  = "linear-gradient(90deg,#ffd166,#ff8800)";
const GRAD_HP_LOW  = "linear-gradient(90deg,#ff4466,#cc0033)";
const GRAD_ST_DEPL = "linear-gradient(90deg,#ff4444,#ff8844)";
const GRAD_ST_APEX = "linear-gradient(90deg,#ffcc00,#ffe066)";
const GRAD_ST_NORM = "linear-gradient(90deg,#44aaff,#00ccff)";
const GHOST_RATE   = 2.2;

export function mountStatBarsTick({ get, set }) {
  function tick(dt, { heroHp, heroMaxHp, heroArmor, heroMaxArmor, stamina, staminaMax, staminaExtraMax, staminaLockout, apexMode, perkMaxHpBonus }, els) {
    const effMaxHp = heroMaxHp + perkMaxHpBonus;

    set.hpGhost(get.hpGhost() + (heroHp - get.hpGhost()) * Math.min(1, dt * GHOST_RATE));
    if (els.hbGhost) els.hbGhost.style.width = (Math.max(0, get.hpGhost() / effMaxHp) * 100).toFixed(1) + "%";

    if (els.hbFill || els.hbVal) {
      const hpFrac = Math.max(0, heroHp / effMaxHp);
      if (els.hbFill) {
        els.hbFill.style.width = (hpFrac * 100).toFixed(1) + "%";
        els.hbFill.style.background = hpFrac > 0.5 ? GRAD_HP_HIGH : (hpFrac > 0.25 ? GRAD_HP_MID : GRAD_HP_LOW);
      }
      if (els.hbVal) els.hbVal.textContent = "" + Math.ceil(heroHp);
    }

    if (els.armorBar) {
      els.armorBar.style.display = heroArmor > 0 ? "flex" : "none";
      if (els.arFill) els.arFill.style.width = `${(heroArmor / heroMaxArmor * 100).toFixed(1)}%`;
      if (els.arVal)  els.arVal.textContent  = "" + Math.ceil(heroArmor);
    }

    if (els.stFill) {
      els.stFill.style.width = (stamina / (staminaMax + staminaExtraMax) * 100).toFixed(1) + "%";
      els.stFill.style.background = stamina < staminaLockout ? GRAD_ST_DEPL : (apexMode ? GRAD_ST_APEX : GRAD_ST_NORM);
    }
  }
  return { tick };
}
