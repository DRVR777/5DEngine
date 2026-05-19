import { describe, it, expect, vi, afterEach } from "vitest";
import { computeBulletDamage } from "../../src/combat/bullet_damage.js";

const DMG_MUL = { robot: { pistol: 0.5, shotgun: 1.2 }, boss: { pistol: 0.8 } };

function bullet(overrides = {}) {
  return { posY: 0.9, dirU: 0, dirV: 1, weaponId: "pistol", damage: 100, falloff: 0, traveled: 0, range: 50, ...overrides };
}
function enemy(overrides = {}) {
  return { heading: 0, type: "grunt", ...overrides };
}

describe("computeBulletDamage — hit types", () => {
  it("normal hit → dmg = damage * 1.0 * 1.0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // no crit
    const { dmg, headshot, backstab, frontalBlock, isCrit } =
      computeBulletDamage({ bullet: bullet({ dirV: 0 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1 });
    expect(headshot).toBe(false);
    expect(backstab).toBe(false);
    expect(frontalBlock).toBe(false);
    expect(isCrit).toBe(false);
    expect(dmg).toBe(100);
    vi.restoreAllMocks();
  });

  it("headshot (posY > 1.35) → 1.85x multiplier", () => {
    const { dmg, headshot } = computeBulletDamage({
      bullet: bullet({ posY: 1.5 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(headshot).toBe(true);
    expect(dmg).toBe(Math.round(100 * 1.85));
  });

  it("backstab (bsDot > 0.55) → 1.5x multiplier", () => {
    // dirU=0, dirV=1, heading=0 → bsDot = 0*sin(0) + 1*cos(0) = 1.0 > 0.55
    const { dmg, backstab } = computeBulletDamage({
      bullet: bullet({ posY: 0.5 }), enemy: enemy({ heading: 0 }), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(backstab).toBe(true);
    expect(dmg).toBe(Math.round(100 * 1.5));
  });

  it("frontalBlock on boss (bsDot < -0.55) → 0.5x multiplier", () => {
    // dirU=0, dirV=-1, heading=0 → bsDot = 0 + (-1)*1 = -1 < -0.55
    const { dmg, frontalBlock } = computeBulletDamage({
      bullet: bullet({ posY: 0.5, dirV: -1 }), enemy: enemy({ heading: 0, type: "boss" }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(frontalBlock).toBe(true);
    expect(dmg).toBe(Math.round(100 * 0.5));
  });

  it("frontalBlock on heavy → 0.5x multiplier", () => {
    const { frontalBlock } = computeBulletDamage({
      bullet: bullet({ posY: 0.5, dirV: -1 }), enemy: enemy({ heading: 0, type: "heavy" }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(frontalBlock).toBe(true);
  });

  it("frontalBlock NOT triggered on grunt", () => {
    const { frontalBlock } = computeBulletDamage({
      bullet: bullet({ posY: 0.5, dirV: -1 }), enemy: enemy({ heading: 0, type: "grunt" }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(frontalBlock).toBe(false);
  });

  it("headshot takes priority over backstab geometry", () => {
    const { headshot, backstab } = computeBulletDamage({
      bullet: bullet({ posY: 1.5 }), enemy: enemy({ heading: 0 }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(headshot).toBe(true);
    expect(backstab).toBe(false);
  });
});

describe("computeBulletDamage — crit", () => {
  afterEach(() => vi.restoreAllMocks());

  it("isCrit when Math.random < 0.10, no other special", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.05);
    const { isCrit, dmg } = computeBulletDamage({
      bullet: bullet({ posY: 0.5, dirV: 0 }), enemy: enemy({ heading: 0 }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(isCrit).toBe(true);
    expect(dmg).toBe(Math.round(100 * 2.5));
  });

  it("no crit when Math.random >= 0.10", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.15);
    const { isCrit } = computeBulletDamage({
      bullet: bullet({ posY: 0.5, dirV: 0 }), enemy: enemy({ heading: 0 }),
      dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(isCrit).toBe(false);
  });

  it("isCrit suppressed on headshot", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    const { isCrit, headshot } = computeBulletDamage({
      bullet: bullet({ posY: 1.5 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(headshot).toBe(true);
    expect(isCrit).toBe(false);
  });
});

describe("computeBulletDamage — multipliers", () => {
  it("dmgMul weapon resistance applied", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // no crit
    const { dmg } = computeBulletDamage({
      bullet: bullet({ dirV: 0 }), enemy: enemy({ type: "robot" }), dmgMul: DMG_MUL, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(dmg).toBe(Math.round(100 * 0.5));
    vi.restoreAllMocks();
  });

  it("lvlDmgMul applied", () => {
    const { dmg } = computeBulletDamage({
      bullet: bullet({ dirV: 0 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1.5, perkDmgMul: 1
    });
    expect(dmg).toBe(Math.round(100 * 1.5));
  });

  it("perkDmgMul applied", () => {
    const { dmg } = computeBulletDamage({
      bullet: bullet({ dirV: 0 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 2
    });
    expect(dmg).toBe(Math.round(100 * 2));
  });

  it("falloff reduces damage, clamped to 0.15", () => {
    // traveled=50, range=50, falloff=1 → raw = 1 - 1*1 = 0 → clamped to 0.15
    vi.spyOn(Math, "random").mockReturnValue(0.5); // suppress crit
    const { dmg } = computeBulletDamage({
      bullet: bullet({ dirV: 0, falloff: 1, traveled: 50, range: 50 }),
      enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    vi.restoreAllMocks();
    expect(dmg).toBe(Math.round(100 * 0.15));
  });

  it("no falloff (falloff=0) → falloffMul=1", () => {
    const { dmg } = computeBulletDamage({
      bullet: bullet({ dirV: 0, falloff: 0 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(dmg).toBe(100);
  });

  it("dmg is Math.round'd", () => {
    const { dmg } = computeBulletDamage({
      bullet: bullet({ damage: 33, dirV: 0 }), enemy: enemy(), dmgMul: {}, lvlDmgMul: 1, perkDmgMul: 1
    });
    expect(Number.isInteger(dmg)).toBe(true);
  });
});
