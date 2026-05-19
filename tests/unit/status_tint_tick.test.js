import { it, expect, describe } from "vitest";
import { mountStatusTintTick } from "../../src/systems/status_tint_tick.js";

function makeEl() {
  return { style: { background: "", opacity: "", display: "" }, innerHTML: "" };
}

function makeInstance({ heroBlindT = 0, heroFireT = 0, heroEmpT = 0, sfxList = [] } = {}) {
  const s = { heroBlindT, heroFireT, heroEmpT };
  const get = { heroBlindT: () => s.heroBlindT, heroFireT: () => s.heroFireT, heroEmpT: () => s.heroEmpT };
  const set = { heroBlindT: v => { s.heroBlindT = v; } };
  const actions = { getActiveEffects: () => sfxList };
  const { tick } = mountStatusTintTick({ get, set, actions });
  return { s, tick };
}

const NO_EFFECTS = [];
const POISON_SFX = [{ id: "poison", timeLeft: 3.5 }];
const BURNING_SFX = [{ id: "burning" }];

describe("status_tint_tick — blind flash", () => {
  it("sets white background while heroBlindT > 0", () => {
    const tint = makeEl();
    const { tick } = makeInstance({ heroBlindT: 1.0 });
    tick(0.1, 0, tint, null);
    expect(tint.style.background).toMatch(/rgba\(255,255,255/);
    expect(tint.style.opacity).toBe("1");
  });

  it("decrements heroBlindT each frame", () => {
    const { s, tick } = makeInstance({ heroBlindT: 1.0 });
    tick(0.3, 0, makeEl(), null);
    expect(s.heroBlindT).toBeCloseTo(0.7);
  });

  it("fade is clamped to [0, 1]", () => {
    const tint = makeEl();
    const { tick } = makeInstance({ heroBlindT: 0.1 });
    tick(0.05, 0, tint, null); // heroBlindT → 0.05, fade = min(1, 0.075) = 0.075
    const opacity = parseFloat(tint.style.background.match(/[\d.]+\)/)[0]);
    expect(opacity).toBeGreaterThanOrEqual(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it("blind takes priority over poison/burning tint", () => {
    const tint = makeEl();
    const { tick } = makeInstance({ heroBlindT: 1.0, sfxList: POISON_SFX });
    tick(0.1, 1000, tint, null);
    expect(tint.style.background).toMatch(/rgba\(255,255,255/);
  });
});

describe("status_tint_tick — poison/burn tint", () => {
  it("shows tint when poisoned", () => {
    const tint = makeEl();
    const { tick } = makeInstance({ sfxList: POISON_SFX });
    tick(0.016, 1000, tint, null);
    expect(tint.style.background).toMatch(/radial-gradient/);
    expect(tint.style.background).toMatch(/rgba\(0,180,0/);
  });

  it("shows orange tint when burning (heroFireT > 0)", () => {
    const tint = makeEl();
    const { tick } = makeInstance({ heroFireT: 2.0 });
    tick(0.016, 1000, tint, null);
    expect(tint.style.background).toMatch(/rgba\(255,/);
  });

  it("hides tint when no effects", () => {
    const tint = makeEl();
    const { tick } = makeInstance();
    tick(0.016, 1000, tint, null);
    expect(tint.style.opacity).toBe("0");
  });

  it("is null-safe when tintEl is null", () => {
    const { tick } = makeInstance({ sfxList: POISON_SFX });
    expect(() => tick(0.016, 1000, null, null)).not.toThrow();
  });
});

describe("status_tint_tick — HUD pills", () => {
  it("shows poison pill with time remaining", () => {
    const hud = makeEl();
    const { tick } = makeInstance({ sfxList: POISON_SFX });
    tick(0.016, 1000, null, hud);
    expect(hud.innerHTML).toMatch(/POISON/);
    expect(hud.innerHTML).toMatch(/4s/); // ceil(3.5) = 4
  });

  it("shows burning pill with heroFireT duration", () => {
    const hud = makeEl();
    const { tick } = makeInstance({ heroFireT: 2.7 });
    tick(0.016, 1000, null, hud);
    expect(hud.innerHTML).toMatch(/BURNING/);
    expect(hud.innerHTML).toMatch(/3s/); // ceil(2.7) = 3
  });

  it("shows EMP pill with time remaining", () => {
    const hud = makeEl();
    const { tick } = makeInstance({ heroEmpT: 1.4 });
    tick(0.016, 1000, null, hud);
    expect(hud.innerHTML).toMatch(/EMP/);
    expect(hud.innerHTML).toMatch(/2s/); // ceil(1.4) = 2
  });

  it("hides HUD when no active effects", () => {
    const hud = makeEl();
    const { tick } = makeInstance();
    tick(0.016, 1000, null, hud);
    expect(hud.style.display).toBe("none");
  });

  it("shows HUD as flex when effects active", () => {
    const hud = makeEl();
    const { tick } = makeInstance({ sfxList: POISON_SFX });
    tick(0.016, 1000, null, hud);
    expect(hud.style.display).toBe("flex");
  });

  it("is null-safe when hudEl is null", () => {
    const { tick } = makeInstance({ sfxList: POISON_SFX });
    expect(() => tick(0.016, 1000, null, null)).not.toThrow();
  });

  it("multiple pills can be active simultaneously", () => {
    const hud = makeEl();
    const { tick } = makeInstance({ heroFireT: 1.0, sfxList: POISON_SFX });
    tick(0.016, 1000, null, hud);
    expect(hud.innerHTML).toMatch(/POISON/);
    expect(hud.innerHTML).toMatch(/BURNING/);
  });
});
