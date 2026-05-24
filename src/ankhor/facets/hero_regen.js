/** hero-regen facet — native Ankhor replacement for the legacy
 *  mountHeroRegenTick (data/legacy/hero-regen.json).
 *
 *  Legacy contract being reproduced (src/systems/hero_regen_tick.js):
 *
 *    tick(dt, { nowSec }) {
 *      const hp = get.heroHp();
 *      const maxHp = get.maxHp() + get.perkMaxHpBonus();
 *      if (hp < maxHp && (nowSec - get.lastDamageT()) > get.regenDelay()) {
 *        set.heroHp(Math.min(maxHp, hp + (get.regenRate() + get.perkRegenBonus()) * dt));
 *      }
 *      if (get.heroHp() > 15) set.nearDeathFired(false);
 *    }
 *
 *  Native version:
 *    - Reads hero.health.hp + maxHp directly (no $kind/$tuning detour).
 *    - regen_delay_seconds + regen_rate_per_second from hero-tuning.
 *    - lastDamageT lives on hero.health.lastDamageT (added when damage
 *      lands — facets writing hp now also stamp the timestamp; until
 *      they do, missing field defaults to 0 = always-regen-immediately).
 *    - perk bonuses default to 0 (substrate doesn't have a perk system
 *      yet; will read from hero.inventory.perks when it lands).
 *    - nearDeathFired is a UI flag with no substrate consumer today;
 *      no-op writes go nowhere.
 *
 *  Priority 24: data-container range; runs after combat (kinetic-hit
 *  at 45 — wait, lower priority numbers run first per registry.tick
 *  sort, so 24 runs BEFORE 45). So this regens BEFORE damage applies
 *  this frame — that's the legacy ordering too (legacy runs in its
 *  mount order, regen before bullet hits).
 *
 *  No hardcoded numbers — handler no-ops if tuning keys missing.
 *
 *  Data: {} — facet itself is stateless; reads + writes all on hero. */

const NEAR_DEATH_HP = 15;  // legacy literal — purely for UI flag clearing

export default {
  priority: 24,
  tick(thing, _data, dt, registry) {
    const tn = readHeroTuning(registry);
    if (!tn) return;

    const heroes = registry.byKind("hero");
    if (heroes.length === 0) return;
    const hero = heroes[0];
    const health = registry.facetData(hero.id, "health");
    if (!health || typeof health.hp !== "number" || typeof health.maxHp !== "number") return;

    const perkMaxHpBonus = readHeroPerkBonus(hero, registry, "max_hp_bonus");
    const perkRegenBonus = readHeroPerkBonus(hero, registry, "regen_bonus");
    const effMaxHp = health.maxHp + perkMaxHpBonus;
    const lastDamageT = typeof health.lastDamageT === "number" ? health.lastDamageT : 0;
    const nowSec = Date.now() / 1000;

    if (health.hp < effMaxHp && (nowSec - lastDamageT) > tn.regen_delay_seconds) {
      const rate = tn.regen_rate_per_second + perkRegenBonus;
      const next = Math.min(effMaxHp, health.hp + rate * dt);
      health.hp = next;
    }
    // nearDeathFired is a legacy UI sentinel; clearing it requires a
    // consumer. No consumer in substrate today — no-op the write.
  }
};

function readHeroTuning(registry) {
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "hero-tuning") continue;
    const tn = registry.facetData(t.id, "tuning");
    if (!tn) return null;
    if (typeof tn.regen_delay_seconds   !== "number") return null;
    if (typeof tn.regen_rate_per_second !== "number") return null;
    return tn;
  }
  return null;
}

function readHeroPerkBonus(hero, registry, key) {
  const inv = registry.facetData(hero.id, "inventory");
  if (!inv || !inv.perks || typeof inv.perks !== "object") return 0;
  return typeof inv.perks[key] === "number" ? inv.perks[key] : 0;
}
