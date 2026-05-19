import { it, expect, describe } from "vitest";
import { mountCamShakeTick } from "../../src/systems/cam_shake_tick.js";

function makeState(camShakeAmt = 0) {
  let _v = camShakeAmt;
  return {
    get: { camShakeAmt: () => _v },
    set: { camShakeAmt: v => { _v = v; } },
    _v: () => _v,
  };
}

function makeActions() {
  const calls = { offsets: [] };
  return {
    actions: { offsetCamera: (dx, dy) => { calls.offsets.push([dx, dy]); } },
    calls,
  };
}

function run(amt, dt = 0.016) {
  const state = makeState(amt);
  const { actions, calls } = makeActions();
  const { tick } = mountCamShakeTick({ ...state, actions });
  tick(dt);
  return { state, calls };
}

describe("cam_shake_tick — above threshold", () => {
  it("calls offsetCamera when camShakeAmt > 0.005", () => {
    const { calls } = run(0.5);
    expect(calls.offsets.length).toBe(1);
  });

  it("offsets are within [-0.09, 0.09] for amt=1.0 (max = 0.5*1.0*0.18)", () => {
    for (let i = 0; i < 30; i++) {
      const { calls } = run(1.0);
      const [dx, dy] = calls.offsets[0];
      expect(Math.abs(dx)).toBeLessThanOrEqual(0.5 * 1.0 * 0.18 + 1e-9);
      expect(Math.abs(dy)).toBeLessThanOrEqual(0.5 * 1.0 * 0.18 + 1e-9);
    }
  });

  it("camShakeAmt decays via exp(-dt*14)", () => {
    const dt = 0.016;
    const initial = 0.5;
    const { state } = run(initial, dt);
    expect(state._v()).toBeCloseTo(initial * Math.exp(-dt * 14));
  });

  it("decay with dt=0 → no change to camShakeAmt", () => {
    const { state } = run(0.5, 0);
    expect(state._v()).toBeCloseTo(0.5);
  });

  it("large dt produces strong decay", () => {
    const { state } = run(0.5, 1.0);
    expect(state._v()).toBeLessThan(0.001);
  });
});

describe("cam_shake_tick — below threshold", () => {
  it("camShakeAmt = 0 → no offsetCamera call", () => {
    const { calls } = run(0);
    expect(calls.offsets.length).toBe(0);
  });

  it("camShakeAmt = 0.005 → set to exactly 0", () => {
    const { state } = run(0.005);
    expect(state._v()).toBe(0);
  });

  it("camShakeAmt = 0.001 → set to 0, no offset", () => {
    const { calls, state } = run(0.001);
    expect(state._v()).toBe(0);
    expect(calls.offsets.length).toBe(0);
  });

  it("camShakeAmt just above threshold decays, not zeroed", () => {
    const { state } = run(0.006);
    expect(state._v()).toBeGreaterThan(0);
    expect(state._v()).toBeLessThan(0.006);
  });
});

describe("cam_shake_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState(Math.random() * 2);
      const { actions } = makeActions();
      const { tick } = mountCamShakeTick({ ...state, actions });
      expect(() => tick(Math.random() * 0.1)).not.toThrow();
    }
  });

  it("camShakeAmt never goes negative", () => {
    for (let i = 0; i < 20; i++) {
      const state = makeState(Math.random() * 0.01);
      const { actions } = makeActions();
      const { tick } = mountCamShakeTick({ ...state, actions });
      tick(Math.random() * 0.1);
      expect(state._v()).toBeGreaterThanOrEqual(0);
    }
  });
});
