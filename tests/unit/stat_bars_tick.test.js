import { it, expect, describe } from "vitest";
import { mountStatBarsTick } from "../../src/systems/stat_bars_tick.js";

function makeEl() { return { style: { width: "", background: "", display: "" }, textContent: "" }; }

function makeInstance(hpGhost = 100) {
  const s = { hpGhost };
  const get = { hpGhost: () => s.hpGhost };
  const set = { hpGhost: v => { s.hpGhost = v; } };
  const { tick } = mountStatBarsTick({ get, set });
  return { s, tick };
}

const BASE_CTX = { heroHp: 100, heroMaxHp: 100, heroArmor: 0, heroMaxArmor: 100, stamina: 100, staminaMax: 100, staminaExtraMax: 0, staminaLockout: 30, apexMode: false, perkMaxHpBonus: 0 };
const NULL_ELS = { hbGhost: null, hbFill: null, hbVal: null, armorBar: null, arFill: null, arVal: null, stFill: null };

describe("stat_bars_tick — HP ghost", () => {
  it("springs hpGhost toward heroHp", () => {
    const { s, tick } = makeInstance(0);
    tick(1.0, { ...BASE_CTX, heroHp: 100 }, NULL_ELS);
    expect(s.hpGhost).toBeCloseTo(100, 0);
  });

  it("fully converges with dt=1.0 (factor=min(1, 2.2)=1)", () => {
    const { s, tick } = makeInstance(50);
    tick(1.0, { ...BASE_CTX, heroHp: 80 }, NULL_ELS);
    expect(s.hpGhost).toBeCloseTo(80, 3);
  });

  it("partially springs with small dt", () => {
    const { s, tick } = makeInstance(100);
    tick(0.016, { ...BASE_CTX, heroHp: 60 }, NULL_ELS);
    expect(s.hpGhost).toBeLessThan(100);
    expect(s.hpGhost).toBeGreaterThan(60);
  });

  it("sets hbGhost width as percentage of effMaxHp", () => {
    const el = makeEl();
    const { tick } = makeInstance(75);
    tick(1.0, { ...BASE_CTX, heroHp: 75, heroMaxHp: 100 }, { ...NULL_ELS, hbGhost: el });
    expect(el.style.width).toBe("75.0%");
  });
});

describe("stat_bars_tick — HP fill bar", () => {
  it("sets hbFill width to HP fraction", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroHp: 50 }, { ...NULL_ELS, hbFill: fill });
    expect(fill.style.width).toBe("50.0%");
  });

  it("uses green gradient above 50% HP", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroHp: 80 }, { ...NULL_ELS, hbFill: fill });
    expect(fill.style.background).toContain("#00ffaa");
  });

  it("uses yellow gradient at 30% HP (25-50%)", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroHp: 30 }, { ...NULL_ELS, hbFill: fill });
    expect(fill.style.background).toContain("#ffd166");
  });

  it("uses red gradient below 25% HP", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroHp: 20 }, { ...NULL_ELS, hbFill: fill });
    expect(fill.style.background).toContain("#ff4466");
  });

  it("sets hbVal to ceil(heroHp)", () => {
    const val = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroHp: 73.7 }, { ...NULL_ELS, hbVal: val });
    expect(val.textContent).toBe("74");
  });

  it("accounts for perkMaxHpBonus in HP fraction", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    // heroMaxHp=100, bonus=50 → effMax=150, heroHp=75 → 50%
    tick(0.016, { ...BASE_CTX, heroHp: 75, heroMaxHp: 100, perkMaxHpBonus: 50 }, { ...NULL_ELS, hbFill: fill });
    expect(fill.style.width).toBe("50.0%");
  });
});

describe("stat_bars_tick — armor bar", () => {
  it("hides armor bar when heroArmor is 0", () => {
    const bar = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroArmor: 0 }, { ...NULL_ELS, armorBar: bar });
    expect(bar.style.display).toBe("none");
  });

  it("shows armor bar as flex when heroArmor > 0", () => {
    const bar = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroArmor: 50 }, { ...NULL_ELS, armorBar: bar });
    expect(bar.style.display).toBe("flex");
  });

  it("sets arFill width as percentage", () => {
    const bar = makeEl(), fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroArmor: 50, heroMaxArmor: 100 }, { ...NULL_ELS, armorBar: bar, arFill: fill });
    expect(fill.style.width).toBe("50.0%");
  });

  it("sets arVal to ceil(heroArmor)", () => {
    const bar = makeEl(), val = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, heroArmor: 24.3, heroMaxArmor: 100 }, { ...NULL_ELS, armorBar: bar, arVal: val });
    expect(val.textContent).toBe("25");
  });
});

describe("stat_bars_tick — stamina bar", () => {
  it("uses depleted gradient when stamina < lockout", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, stamina: 20, staminaLockout: 30 }, { ...NULL_ELS, stFill: fill });
    expect(fill.style.background).toContain("#ff4444");
  });

  it("uses gold gradient in apex mode", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, stamina: 80, apexMode: true }, { ...NULL_ELS, stFill: fill });
    expect(fill.style.background).toContain("#ffcc00");
  });

  it("uses blue gradient normally", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    tick(0.016, { ...BASE_CTX, stamina: 80 }, { ...NULL_ELS, stFill: fill });
    expect(fill.style.background).toContain("#44aaff");
  });

  it("accounts for staminaExtraMax in width", () => {
    const fill = makeEl();
    const { tick } = makeInstance();
    // stamina=100, max=100, extra=100 → 100/200 = 50%
    tick(0.016, { ...BASE_CTX, stamina: 100, staminaMax: 100, staminaExtraMax: 100 }, { ...NULL_ELS, stFill: fill });
    expect(fill.style.width).toBe("50.0%");
  });

  it("is null-safe when stFill is null", () => {
    const { tick } = makeInstance();
    expect(() => tick(0.016, BASE_CTX, NULL_ELS)).not.toThrow();
  });
});
