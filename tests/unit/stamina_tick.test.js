import { it, expect, describe } from "vitest";
import { mountStaminaTick } from "../../src/systems/stamina_tick.js";

const CONSTS = { STAMINA_DRAIN: 28, STAMINA_REGEN: 18, STAMINA_MAX: 100, STAMINA_LOCKOUT: 30 };

function makeStamina({ stamina = 100, heroEmpT = 0, heroExtraStaminaMax = 0 } = {}) {
  const s = { stamina, heroEmpT, heroExtraStaminaMax };
  const get = { stamina: () => s.stamina, heroEmpT: () => s.heroEmpT, heroExtraStaminaMax: () => s.heroExtraStaminaMax };
  const set = { stamina: v => { s.stamina = v; }, heroEmpT: v => { s.heroEmpT = v; } };
  const { tick } = mountStaminaTick({ ...CONSTS, get, set });
  return { s, tick };
}

const SPRINT_CTX = { wantsSprint: true, isSprinting: true, inputMoving: true };
const IDLE_CTX   = { wantsSprint: false, isSprinting: false, inputMoving: false };

describe("stamina_tick — drain", () => {
  it("drains stamina while canSprint and inputMoving", () => {
    const { s, tick } = makeStamina({ stamina: 80 });
    tick(1.0, SPRINT_CTX);
    expect(s.stamina).toBeCloseTo(80 - CONSTS.STAMINA_DRAIN, 1);
  });

  it("floors stamina at 0", () => {
    const { s, tick } = makeStamina({ stamina: 1 });
    tick(1.0, SPRINT_CTX);
    expect(s.stamina).toBe(0);
  });

  it("does not drain when inputMoving is false (standing still while shifted)", () => {
    const { s, tick } = makeStamina({ stamina: 80 });
    tick(1.0, { ...SPRINT_CTX, inputMoving: false });
    expect(s.stamina).toBeGreaterThanOrEqual(80); // no drain; might regen
  });
});

describe("stamina_tick — regen", () => {
  it("regens stamina when not wanting to sprint", () => {
    const { s, tick } = makeStamina({ stamina: 50 });
    tick(1.0, IDLE_CTX);
    expect(s.stamina).toBeCloseTo(50 + CONSTS.STAMINA_REGEN, 1);
  });

  it("regens stamina when stamina is 0 even if wantsSprint", () => {
    const { s, tick } = makeStamina({ stamina: 0 });
    tick(1.0, { ...SPRINT_CTX, isSprinting: false }); // canSprint=false (stamina<LOCKOUT)
    expect(s.stamina).toBeGreaterThan(0);
  });

  it("caps stamina at STAMINA_MAX + heroExtraStaminaMax", () => {
    const { s, tick } = makeStamina({ stamina: 99, heroExtraStaminaMax: 0 });
    tick(1.0, IDLE_CTX);
    expect(s.stamina).toBeCloseTo(100, 0);
  });

  it("uses heroExtraStaminaMax for regen cap", () => {
    const { s, tick } = makeStamina({ stamina: 105, heroExtraStaminaMax: 10 });
    tick(1.0, IDLE_CTX);
    expect(s.stamina).toBeLessThanOrEqual(110);
  });
});

describe("stamina_tick — canSprint return value", () => {
  it("returns true when wantsSprint, sufficient stamina, no EMP", () => {
    const { tick } = makeStamina({ stamina: 100, heroEmpT: 0 });
    expect(tick(0.016, SPRINT_CTX)).toBe(true);
  });

  it("returns false when EMP active", () => {
    const { tick } = makeStamina({ stamina: 100, heroEmpT: 1.0 });
    expect(tick(0.016, SPRINT_CTX)).toBe(false);
  });

  it("returns false when not wanting to sprint", () => {
    const { tick } = makeStamina({ stamina: 100 });
    expect(tick(0.016, IDLE_CTX)).toBe(false);
  });

  it("requires STAMINA_LOCKOUT to start sprinting (isSprinting=false, stamina=25)", () => {
    const { tick } = makeStamina({ stamina: 25 }); // < LOCKOUT=30
    expect(tick(0.016, { wantsSprint: true, isSprinting: false, inputMoving: true })).toBe(false);
  });

  it("allows continuing sprint with only 1 stamina (isSprinting=true)", () => {
    const { tick } = makeStamina({ stamina: 1 });
    expect(tick(0.016, { wantsSprint: true, isSprinting: true, inputMoving: true })).toBe(true);
  });
});

describe("stamina_tick — EMP", () => {
  it("decrements heroEmpT each frame", () => {
    const { s, tick } = makeStamina({ heroEmpT: 2.0 });
    tick(0.5, IDLE_CTX);
    expect(s.heroEmpT).toBeCloseTo(1.5);
  });

  it("heroEmpT guard prevents further decrement once negative/zero next frame", () => {
    const { s, tick } = makeStamina({ heroEmpT: 0.1 });
    tick(0.1, IDLE_CTX); // heroEmpT → 0.0
    tick(0.1, IDLE_CTX); // guard: <= 0, no further decrement
    expect(s.heroEmpT).toBeCloseTo(0, 3);
  });
});
