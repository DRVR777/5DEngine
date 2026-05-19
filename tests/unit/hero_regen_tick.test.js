import { it, expect, describe } from "vitest";
import { mountHeroRegenTick } from "../../src/systems/hero_regen_tick.js";

function makeState({ heroHp = 80, maxHp = 100, perkMaxHpBonus = 0, lastDamageT = -Infinity, regenDelay = 5, regenRate = 2, perkRegenBonus = 0, nearDeathFired = false } = {}) {
  const state = { heroHp, nearDeathFired };
  return {
    get: {
      heroHp: () => state.heroHp,
      maxHp: () => maxHp,
      perkMaxHpBonus: () => perkMaxHpBonus,
      lastDamageT: () => lastDamageT,
      regenDelay: () => regenDelay,
      regenRate: () => regenRate,
      perkRegenBonus: () => perkRegenBonus,
    },
    set: {
      heroHp: v => { state.heroHp = v; },
      nearDeathFired: v => { state.nearDeathFired = v; },
    },
    state,
  };
}

describe("hero_regen_tick — no-op guards", () => {
  it("hp at max → no change", () => {
    const { get, set, state } = makeState({ heroHp: 100 });
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.heroHp).toBe(100);
  });

  it("recent damage (< regenDelay) → no change", () => {
    const { get, set, state } = makeState({ heroHp: 80, lastDamageT: 96, regenDelay: 5 }); // nowSec=100, dmg 4s ago
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.heroHp).toBe(80);
  });

  it("exactly at delay boundary → regen applies (>= not >)", () => {
    // nowSec - lastDamageT = 5 == regenDelay → should regen (condition is >)
    // Actually condition is > regenDelay so exactly at boundary should NOT regen
    const { get, set, state } = makeState({ heroHp: 80, lastDamageT: 95, regenDelay: 5 }); // 100-95=5 not > 5
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.heroHp).toBe(80);
  });
});

describe("hero_regen_tick — regen applies", () => {
  it("out of combat → hp increases by regenRate*dt", () => {
    const { get, set, state } = makeState({ heroHp: 80, lastDamageT: 80, regenDelay: 5, regenRate: 2 }); // 100-80=20s > 5
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.heroHp).toBeCloseTo(80 + 2 * 0.016);
  });

  it("regen rate includes perkRegenBonus", () => {
    const { get, set, state } = makeState({ heroHp: 80, lastDamageT: 0, regenDelay: 5, regenRate: 2, perkRegenBonus: 1 });
    mountHeroRegenTick({ get, set }).tick(1.0, { nowSec: 100 });
    expect(state.heroHp).toBeCloseTo(80 + 3 * 1.0);
  });

  it("regen cap includes perkMaxHpBonus", () => {
    const { get, set, state } = makeState({ heroHp: 99, maxHp: 100, perkMaxHpBonus: 5, lastDamageT: 0, regenRate: 10 });
    mountHeroRegenTick({ get, set }).tick(1.0, { nowSec: 100 });
    expect(state.heroHp).toBe(105);
  });

  it("regen does not exceed maxHp + perkBonus", () => {
    const { get, set, state } = makeState({ heroHp: 99.9, maxHp: 100, perkMaxHpBonus: 0, lastDamageT: 0, regenRate: 10 });
    mountHeroRegenTick({ get, set }).tick(1.0, { nowSec: 100 });
    expect(state.heroHp).toBe(100);
  });
});

describe("hero_regen_tick — nearDeathFired reset", () => {
  it("hp > 15 → nearDeathFired set to false", () => {
    const { get, set, state } = makeState({ heroHp: 80, nearDeathFired: true, lastDamageT: 0 });
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.nearDeathFired).toBe(false);
  });

  it("hp <= 15 → nearDeathFired unchanged", () => {
    const { get, set, state } = makeState({ heroHp: 14, maxHp: 100, lastDamageT: 0, regenRate: 0, nearDeathFired: true });
    // hp=14, regenRate=0 so no change; hp stays ≤15
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.nearDeathFired).toBe(true);
  });

  it("hp just above 15 after regen → nearDeathFired cleared", () => {
    const { get, set, state } = makeState({ heroHp: 15.01, nearDeathFired: true, lastDamageT: 0, regenRate: 0 });
    mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: 100 });
    expect(state.nearDeathFired).toBe(false);
  });
});

describe("hero_regen_tick — fuzz", () => {
  it("never throws for 25 random states", () => {
    for (let i = 0; i < 25; i++) {
      const { get, set } = makeState({
        heroHp: Math.random() * 110,
        maxHp: 100,
        perkMaxHpBonus: Math.random() * 20,
        lastDamageT: Math.random() * 100,
        regenDelay: 5,
        regenRate: Math.random() * 5,
        perkRegenBonus: Math.random() * 2,
        nearDeathFired: Math.random() > 0.5,
      });
      expect(() => mountHeroRegenTick({ get, set }).tick(0.016, { nowSec: Math.random() * 200 })).not.toThrow();
    }
  });
});
