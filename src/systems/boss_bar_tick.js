const GRAD_BOSS_HIGH = "linear-gradient(90deg,#cc0000,#ff4400)";
const GRAD_BOSS_MID  = "linear-gradient(90deg,#aa0000,#ff2200)";
const GRAD_BOSS_LOW  = "linear-gradient(90deg,#660000,#cc0000)";

export function mountBossBarTick() {
  function tick(now, liveBoss, els) {
    const { bossBar, bossHpFill, bossHpVal, bossName } = els;
    if (!bossBar) return;
    if (liveBoss && !liveBoss.dead) {
      bossBar.style.display = "block";
      const bFrac = Math.max(0, liveBoss.hp / liveBoss.maxHp);
      const bPulse = bFrac < 0.3
        ? `0 0 ${(8 + 6 * Math.sin(now / 180)).toFixed(1)}px rgba(255,0,0,0.7)`
        : "0 0 12px rgba(255,40,0,0.3)";
      if (bossHpFill) {
        bossHpFill.style.width = (bFrac * 100).toFixed(1) + "%";
        bossHpFill.style.background = bFrac > 0.5 ? GRAD_BOSS_HIGH : (bFrac > 0.25 ? GRAD_BOSS_MID : GRAD_BOSS_LOW);
        bossHpFill.parentElement.style.boxShadow = bPulse;
      }
      if (bossHpVal) bossHpVal.textContent = `${Math.ceil(liveBoss.hp)} / ${liveBoss.maxHp}`;
      if (bossName)  bossName.textContent  = "☠ BOSS";
    } else {
      bossBar.style.display = "none";
    }
  }
  return { tick };
}
