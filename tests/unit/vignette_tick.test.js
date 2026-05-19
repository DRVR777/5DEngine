import { it, expect, describe } from "vitest";
import { mountVignetteTick } from "../../src/systems/vignette_tick.js";

function makeInstance(vignetteAmt = 0) {
  const s = { vignetteAmt };
  const get = { vignetteAmt: () => s.vignetteAmt };
  const set = { vignetteAmt: v => { s.vignetteAmt = v; } };
  const { tick } = mountVignetteTick({ get, set });
  return { s, tick };
}

describe("vignette_tick — low-HP pulse", () => {
  it("springs toward 0 when HP is above 30% threshold", () => {
    const { s, tick } = makeInstance(0.5); // starts high
    tick(1.0, 0, 80, 100, null); // 80% HP, no pulse
    expect(s.vignetteAmt).toBeLessThan(0.5);
  });

  it("springs toward non-zero pulse when HP < 30%", () => {
    const { s, tick } = makeInstance(0); // starts at 0
    // HP=25/100 → 25% < 30%, sin(0/350)=0 → pulse = 0.22
    tick(1.0, 0, 25, 100, null);
    expect(s.vignetteAmt).toBeGreaterThan(0);
  });

  it("pulse is 0 at exactly 30% HP (boundary)", () => {
    const { s, tick } = makeInstance(0);
    tick(0.016, 0, 30, 100, null); // exactly at threshold — NOT < 0.3
    expect(s.vignetteAmt).toBeCloseTo(0, 3);
  });

  it("vignetteAmt fully closes gap with large dt (dt=1 → factor=min(1,6)=1)", () => {
    const { s, tick } = makeInstance(0.5);
    tick(1.0, 0, 100, 100, null); // pulse=0, dt=1 → factor=1, vignetteAmt→0
    expect(s.vignetteAmt).toBeCloseTo(0, 3);
  });

  it("vignetteAmt does partial spring with small dt", () => {
    const { s, tick } = makeInstance(0.6);
    tick(0.1, 0, 100, 100, null); // pulse=0, factor=min(1, 0.6)=0.6
    expect(s.vignetteAmt).toBeCloseTo(0.6 * (1 - 0.6), 3);
  });
});

describe("vignette_tick — DOM update", () => {
  it("sets el.style.opacity to vignetteAmt formatted to 3 decimal places", () => {
    const el = { style: { opacity: "" } };
    const { tick } = makeInstance(0.5);
    tick(1.0, 0, 100, 100, el); // spring to 0 in one step
    expect(el.style.opacity).toBe("0.000");
  });

  it("opacity reflects updated vignetteAmt after spring", () => {
    const el = { style: { opacity: "" } };
    const { s, tick } = makeInstance(0);
    tick(0.016, 0, 25, 100, el); // low HP, small dt
    expect(parseFloat(el.style.opacity)).toBeCloseTo(s.vignetteAmt, 3);
  });

  it("is null-safe when el is null", () => {
    const { tick } = makeInstance(0);
    expect(() => tick(0.016, 0, 25, 100, null)).not.toThrow();
  });
});

describe("vignette_tick — fuzz", () => {
  it("vignetteAmt stays in [0, 1] for random inputs", () => {
    for (let i = 0; i < 20; i++) {
      const init = Math.random();
      const { s, tick } = makeInstance(init);
      const hp = Math.random() * 100;
      tick(Math.random() * 0.5, Math.random() * 5000, hp, 100, null);
      expect(s.vignetteAmt).toBeGreaterThanOrEqual(0);
      expect(s.vignetteAmt).toBeLessThanOrEqual(1.01); // pulse max = 0.22 + 0.12 = 0.34
    }
  });
});
