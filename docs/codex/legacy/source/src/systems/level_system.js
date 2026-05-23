// In-session kill leveling — applies stat buffs on level-up (levels 1-5)
// mountLevelSystem(deps) → { applyLevelUpBuff }

export function mountLevelSystem({ get, set, actions }) {
  const _MSGS = {
    1: "LVL 1 — +10% DAMAGE",
    2: "LVL 2 — +SPRINT SPEED",
    3: "LVL 3 — +25 STAMINA MAX",
    4: "LVL 4 — +MAX HP",
    5: "LVL 5 — APEX PREDATOR",
  };

  function applyLevelUpBuff(lvl) {
    if (lvl === 1) set.heroLvlDmgMul(get.heroLvlDmgMul() * 1.10);
    if (lvl === 2) set.heroLvlSpeedBonus(get.heroLvlSpeedBonus() + 1.0);
    if (lvl === 3) {
      set.heroExtraStaminaMax(25);
      set.stamina(Math.min(get.STAMINA_MAX() + 25, get.stamina() + 25));
    }
    if (lvl === 4) set.heroHp(Math.min(get.HERO_MAX_HP() + 20, get.heroHp() + 20));
    if (lvl === 5) set.heroApexMode(true);
    const hp = get.heroPos();
    actions.spawnParticles(hp.u, 1.5, hp.v, 40, "yellow", 8, 0.8);
    actions.showToast(`LEVEL UP! ${_MSGS[lvl]}`, "success", 3000);
    actions.playSfx("tone:880:100:sine", 0.5);
    actions.playSfx("tone:1100:80:sine", 0.45);
    actions.playSfx("tone:1320:120:sine", 0.4);
    actions.addKillFeedEntry(`★ LEVEL ${lvl}: ${_MSGS[lvl]}`, "#ffd700");
    actions.setHeroLevelHud(`LVL ${lvl}`);
  }

  return { applyLevelUpBuff };
}
