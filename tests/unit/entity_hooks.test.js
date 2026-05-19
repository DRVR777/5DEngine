import { it, expect, describe } from "vitest";
import { mountEntityHooks } from "../../src/systems/entity_hooks.js";

function makeHero({ hp = 100, armor = 0, maxHp = 100, perkMaxHpBonus = 0 } = {}) {
  let _hp = hp, _armor = armor;
  const get = {
    heroHp:         () => _hp,
    heroArmor:      () => _armor,
    heroDead:       () => _hp <= 0,
    HERO_MAX_HP:    () => maxHp,
    perkMaxHpBonus: () => perkMaxHpBonus,
    dodgeT:         () => 0,
  };
  const set = {
    heroHp:             (v) => { _hp = v; },
    heroArmor:          (v) => { _armor = v; },
    heroLastDamageT:    () => {},
    waveChallengeNoDmg: () => {},
  };
  let deathCalled = false;
  const actions = { heroShowDeathScreen: () => { deathCalled = true; } };
  const { entityDamage, entityHeal } = mountEntityHooks({ ARMOR_ABSORB: 0.6, get, set, actions });
  return {
    get hp()    { return _hp; },
    get armor() { return _armor; },
    get deathCalled() { return deathCalled; },
    damage: entityDamage,
    heal:   entityHeal,
  };
}

describe("entityDamage — state-invariant fuzz (15 random events)", () => {
  it("hp never goes below 0", () => {
    const hero = makeHero({ hp: 100 });
    for (let i = 0; i < 15; i++) {
      hero.damage("hero", Math.floor(Math.random() * 50));
      expect(hero.hp).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(hero.hp)).toBe(true);
    }
  });

  it("armor absorbs ARMOR_ABSORB fraction of damage", () => {
    const hero = makeHero({ hp: 100, armor: 50 });
    hero.damage("hero", 20);
    // armorHit = min(50, 20 * 0.6) = 12 → armor = 38, hp = 100 - (20-12) = 92
    expect(hero.hp).toBe(92);
    expect(hero.armor).toBe(38);
  });

  it("armor depletes and remainder hits HP when hit exceeds pool", () => {
    const hero = makeHero({ hp: 100, armor: 5 });
    hero.damage("hero", 20);
    // armorHit = min(5, 12) = 5 → armor = 0, hp = 100 - (20-5) = 85
    expect(hero.hp).toBe(85);
    expect(hero.armor).toBe(0);
  });

  it("ignores non-hero entity IDs", () => {
    const hero = makeHero({ hp: 100 });
    hero.damage("enemy1", 999);
    expect(hero.hp).toBe(100);
  });
});

describe("entityHeal", () => {
  it("heals hp", () => {
    const hero = makeHero({ hp: 40 });
    hero.heal("hero", 30);
    expect(hero.hp).toBe(70);
  });

  it("does not overheal past HERO_MAX_HP", () => {
    const hero = makeHero({ hp: 95, maxHp: 100 });
    hero.heal("hero", 20);
    expect(hero.hp).toBe(100);
  });

  it("perkMaxHpBonus extends heal ceiling", () => {
    const hero = makeHero({ hp: 100, maxHp: 100, perkMaxHpBonus: 25 });
    hero.heal("hero", 20);
    expect(hero.hp).toBe(120);
  });

  it("ignores non-hero entity IDs", () => {
    const hero = makeHero({ hp: 40 });
    hero.heal("enemy1", 999);
    expect(hero.hp).toBe(40);
  });
});

it("hp and armor are always finite across 10 mixed damage+heal events", () => {
  const hero = makeHero({ hp: 100, armor: 30 });
  for (let i = 0; i < 10; i++) {
    if (Math.random() < 0.5) hero.damage("hero", Math.random() * 40);
    else hero.heal("hero", Math.random() * 20);
    expect(Number.isFinite(hero.hp)).toBe(true);
    expect(Number.isFinite(hero.armor)).toBe(true);
    expect(hero.hp).toBeGreaterThanOrEqual(0);
    expect(hero.armor).toBeGreaterThanOrEqual(0);
  }
});
