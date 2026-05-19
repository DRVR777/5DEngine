import { it, expect, describe } from "vitest";
import { mountHeroKnockbackTick } from "../../src/systems/hero_knockback_tick.js";

function makeState({ kbT = 0, kbU = 0, kbV = 0 } = {}) {
  let _t = kbT, _u = kbU, _v = kbV;
  return {
    get: { kbT: () => _t, kbU: () => _u, kbV: () => _v },
    set: { kbT: v => { _t = v; }, kbU: v => { _u = v; }, kbV: v => { _v = v; } },
    _t: () => _t, _u: () => _u, _v: () => _v,
  };
}

function makeActions(pos = { x: 0, y: 0, z: 0, u: 5, v: 10 }) {
  const calls = { getPos: 0, setPos: null, resolveMove: null };
  return {
    actions: {
      getPos: () => { calls.getPos++; return { ...pos }; },
      setPos: (x, y, z, u, v) => { calls.setPos = [x, y, z, u, v]; },
      resolveMove: (mover, du, dv) => {
        calls.resolveMove = [du, dv];
        mover.u += du;
        mover.v += dv;
      },
    },
    calls,
  };
}

describe("hero_knockback_tick — inactive (kbT <= 0)", () => {
  it("kbT=0 → getPos not called", () => {
    const state = makeState({ kbT: 0, kbU: 1, kbV: 1 });
    const { actions, calls } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(calls.getPos).toBe(0);
  });

  it("kbT=0 → setPos not called", () => {
    const state = makeState({ kbT: 0, kbU: 1, kbV: 1 });
    const { actions, calls } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(calls.setPos).toBeNull();
  });

  it("kbT=0 → kbU and kbV unchanged", () => {
    const state = makeState({ kbT: 0, kbU: 3, kbV: 2 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(state._u()).toBe(3);
    expect(state._v()).toBe(2);
  });
});

describe("hero_knockback_tick — active (kbT > 0)", () => {
  it("kbT decremented by dt", () => {
    const state = makeState({ kbT: 0.5, kbU: 1, kbV: 0 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(state._t()).toBeCloseTo(0.484);
  });

  it("resolveMove called with kbU*dt and kbV*dt", () => {
    const state = makeState({ kbT: 1, kbU: 3, kbV: 2 });
    const { actions, calls } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(calls.resolveMove[0]).toBeCloseTo(3 * 0.016);
    expect(calls.resolveMove[1]).toBeCloseTo(2 * 0.016);
  });

  it("setPos called with resolved mover position", () => {
    const pos = { x: 1, y: 2, z: 3, u: 5, v: 10 };
    const state = makeState({ kbT: 1, kbU: 10, kbV: 0 });
    const { actions, calls } = makeActions(pos);
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.016);
    expect(calls.setPos[0]).toBe(pos.x);
    expect(calls.setPos[1]).toBe(pos.y);
    expect(calls.setPos[2]).toBe(pos.z);
    expect(calls.setPos[3]).toBeCloseTo(pos.u + 10 * 0.016);
  });

  it("kbU decays: kbU * max(0, 1 - dt*8)", () => {
    const dt = 0.016;
    const state = makeState({ kbT: 1, kbU: 4, kbV: 0 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(dt);
    expect(state._u()).toBeCloseTo(4 * Math.max(0, 1 - dt * 8));
  });

  it("kbV decays symmetrically with kbU", () => {
    const dt = 0.016;
    const state = makeState({ kbT: 1, kbU: 0, kbV: 6 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(dt);
    expect(state._v()).toBeCloseTo(6 * Math.max(0, 1 - dt * 8));
  });

  it("dt=0.125 → factor = 1 - 0.125*8 = 0 → kbU/kbV clamped to 0", () => {
    const state = makeState({ kbT: 1, kbU: 5, kbV: 5 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.125);
    expect(state._u()).toBeCloseTo(0);
    expect(state._v()).toBeCloseTo(0);
  });

  it("dt > 0.125 → decay clamped at 0, kbU/kbV do not go negative", () => {
    const state = makeState({ kbT: 1, kbU: 5, kbV: 5 });
    const { actions } = makeActions();
    const { tick } = mountHeroKnockbackTick({ ...state, actions });
    tick(0.5);
    expect(state._u()).toBe(0);
    expect(state._v()).toBe(0);
  });
});

describe("hero_knockback_tick — fuzz", () => {
  it("never throws for 25 random states", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState({
        kbT: (Math.random() - 0.2) * 0.5,
        kbU: (Math.random() - 0.5) * 10,
        kbV: (Math.random() - 0.5) * 10,
      });
      const { actions } = makeActions({ x: 0, y: 0, z: 0, u: Math.random() * 50, v: Math.random() * 50 });
      const { tick } = mountHeroKnockbackTick({ ...state, actions });
      expect(() => tick(Math.random() * 0.05)).not.toThrow();
    }
  });

  it("kbU/kbV never go negative", () => {
    for (let i = 0; i < 20; i++) {
      const state = makeState({ kbT: 1, kbU: Math.random() * 10, kbV: Math.random() * 10 });
      const { actions } = makeActions();
      const { tick } = mountHeroKnockbackTick({ ...state, actions });
      tick(Math.random() * 0.5);
      expect(state._u()).toBeGreaterThanOrEqual(0);
      expect(state._v()).toBeGreaterThanOrEqual(0);
    }
  });
});
