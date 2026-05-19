import { it, expect, describe } from "vitest";
import { mountComboHudTick } from "../../src/systems/combo_hud_tick.js";

const { tick } = mountComboHudTick();

function makeEl() { return { style: { display: "", color: "", textShadow: "", transform: "", width: "" }, textContent: "" }; }
const NULL_ELS = { comboHud: null, comboMulText: null, comboFill: null };

describe("combo_hud_tick — null safety", () => {
  it("does not throw when comboHud is null", () => {
    expect(() => tick(1, 5, 0, 3, NULL_ELS)).not.toThrow();
  });

  it("does not throw when comboMulText and comboFill are null", () => {
    const hud = makeEl();
    expect(() => tick(1, 5, 0, 3, { comboHud: hud, comboMulText: null, comboFill: null })).not.toThrow();
  });
});

describe("combo_hud_tick — visibility", () => {
  it("hides HUD when comboCount < 2", () => {
    const hud = makeEl();
    tick(1, 1, 0, 3, { comboHud: hud, comboMulText: null, comboFill: null });
    expect(hud.style.display).toBe("none");
  });

  it("hides HUD when comboCount is 0", () => {
    const hud = makeEl();
    tick(1, 0, 0, 3, { comboHud: hud, comboMulText: null, comboFill: null });
    expect(hud.style.display).toBe("none");
  });

  it("shows HUD when comboCount is exactly 2", () => {
    const hud = makeEl();
    tick(1, 2, 0, 3, { comboHud: hud, comboMulText: null, comboFill: null });
    expect(hud.style.display).toBe("block");
  });

  it("shows HUD when comboCount is high", () => {
    const hud = makeEl();
    tick(1, 10, 0, 3, { comboHud: hud, comboMulText: null, comboFill: null });
    expect(hud.style.display).toBe("block");
  });
});

describe("combo_hud_tick — multiplier text", () => {
  it("sets multiplier text to x<mul>", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 4, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.textContent).toBe("x4");
  });

  it("caps multiplier display at 8", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 15, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.textContent).toBe("x8");
  });

  it("uses red color at mul >= 6", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 6, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.style.color).toBe("#ff4466");
  });

  it("uses orange color at mul 4-5", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 4, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.style.color).toBe("#ff8800");
  });

  it("uses yellow color at mul 2-3", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 3, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.style.color).toBe("#ffd166");
  });

  it("text shadow uses same hue as color", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 7, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.style.textShadow).toContain(mul.style.color.replace("#", ""));
  });

  it("transform contains scale()", () => {
    const hud = makeEl(), mul = makeEl();
    tick(1, 4, 0, 3, { comboHud: hud, comboMulText: mul, comboFill: null });
    expect(mul.style.transform).toMatch(/^scale\([\d.]+\)$/);
  });
});

describe("combo_hud_tick — fill bar", () => {
  it("fill is 100% when no time has elapsed", () => {
    const hud = makeEl(), fill = makeEl();
    tick(5, 3, 5, 3, { comboHud: hud, comboMulText: null, comboFill: fill });
    expect(fill.style.width).toBe("100.0%");
  });

  it("fill is 0% when fully decayed", () => {
    const hud = makeEl(), fill = makeEl();
    tick(10, 3, 5, 3, { comboHud: hud, comboMulText: null, comboFill: fill });
    expect(fill.style.width).toBe("0.0%");
  });

  it("fill is 50% at half decay", () => {
    const hud = makeEl(), fill = makeEl();
    tick(6.5, 3, 5, 3, { comboHud: hud, comboMulText: null, comboFill: fill });
    expect(fill.style.width).toBe("50.0%");
  });

  it("fill never goes negative", () => {
    const hud = makeEl(), fill = makeEl();
    tick(100, 3, 0, 3, { comboHud: hud, comboMulText: null, comboFill: fill });
    expect(parseFloat(fill.style.width)).toBeGreaterThanOrEqual(0);
  });
});

describe("combo_hud_tick — fuzz", () => {
  it("never throws for 20 random inputs, fill always 0-100%", () => {
    const hud = makeEl(), fill = makeEl(), mul = makeEl();
    for (let i = 0; i < 20; i++) {
      const nowSec    = Math.random() * 200;
      const count     = Math.floor(Math.random() * 20);
      const lastT     = Math.random() * 200;
      const decay     = 0.5 + Math.random() * 10;
      expect(() => tick(nowSec, count, lastT, decay, { comboHud: hud, comboMulText: mul, comboFill: fill })).not.toThrow();
      if (count >= 2) {
        const pct = parseFloat(fill.style.width);
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    }
  });
});
