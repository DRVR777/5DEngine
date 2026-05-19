export function mountHeroRegenTick({ get, set }) {
  function tick(dt, { nowSec }) {
    const hp = get.heroHp();
    const maxHp = get.maxHp() + get.perkMaxHpBonus();
    if (hp < maxHp && (nowSec - get.lastDamageT()) > get.regenDelay()) {
      set.heroHp(Math.min(maxHp, hp + (get.regenRate() + get.perkRegenBonus()) * dt));
    }
    if (get.heroHp() > 15) set.nearDeathFired(false);
  }
  return { tick };
}
