// StatusEffects entity hooks — called by status_effects.js onTick callbacks.
// Returns { entityDamage, entityHeal, setHeroOpacity } and also assigns them
// to window._ names for the existing global-call sites in status_effects.js.
export function mountEntityHooks({ ARMOR_ABSORB, get, set, actions }) {
  function entityDamage(entityId, amount, _type) {
    if (entityId !== "hero") return;
    if (typeof Engine !== "undefined" && Engine.debug.godMode) return;
    if (get.dodgeT() > 0) return;
    const armor = get.heroArmor();
    if (armor > 0) {
      const armorHit = Math.min(armor, amount * ARMOR_ABSORB);
      set.heroArmor(Math.max(0, armor - armorHit));
      amount = amount - armorHit;
    }
    set.heroHp(Math.max(0, get.heroHp() - amount));
    set.heroLastDamageT(performance.now() / 1000);
    set.waveChallengeNoDmg(false);
    if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.HERO_DAMAGED, { amount, hp: get.heroHp() });
    if (get.heroHp() <= 0) {
      if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.HERO_DIED, { killer: "effect" });
      if (!get.heroDead()) actions.heroShowDeathScreen();
    }
  }
  function entityHeal(entityId, amount) {
    if (entityId !== "hero") return;
    set.heroHp(Math.min(get.HERO_MAX_HP() + get.perkMaxHpBonus(), get.heroHp() + amount));
  }
  function setHeroOpacity(v) {
    const hg = typeof window !== "undefined" ? window._heroGroup : null;
    if (hg) hg.traverse(c => { if (c.material) c.material.transparent = true, c.material.opacity = v; });
  }
  if (typeof window !== "undefined") {
    window._entityDamage    = entityDamage;
    window._entityHeal      = entityHeal;
    window._setHeroOpacity  = setHeroOpacity;
  }
  return { entityDamage, entityHeal, setHeroOpacity };
}
