import { it, expect, describe } from "vitest";
import { mountDodgeTick } from "../../src/systems/dodge_tick.js";

function makeState({ cooldown = 0, dodgeT = 0, velU = 0, velV = 0, bashDone = false } = {}) {
  let _cd = cooldown, _dt = dodgeT, _vu = velU, _vv = velV, _bd = bashDone;
  return {
    get: { dodgeCooldown: () => _cd, dodgeT: () => _dt, dodgeVelU: () => _vu, dodgeVelV: () => _vv, dodgeBashDone: () => _bd },
    set: { dodgeCooldown: v => { _cd = v; }, dodgeT: v => { _dt = v; }, dodgeBashDone: v => { _bd = v; } },
    _cd: () => _cd, _dt: () => _dt, _bd: () => _bd,
  };
}

function makeActions({ bashResult = false, pos = { x: 0, y: 0, z: 0, u: 5, v: 10 } } = {}) {
  const calls = { setPos: null, spawnTrail: 0, tryBash: 0 };
  return {
    actions: {
      getPos: () => ({ ...pos }),
      setPos: (x, y, z, u, v) => { calls.setPos = [x, y, z, u, v]; },
      spawnTrail: (u, y, v) => { calls.spawnTrail++; },
      tryBash: (heroPos) => { calls.tryBash++; return bashResult; },
    },
    calls,
  };
}

describe("dodge_tick — cooldown only (dodgeT=0)", () => {
  it("cooldown > 0 → decremented", () => {
    const state = makeState({ cooldown: 0.5 });
    const { actions } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._cd()).toBeCloseTo(0.484);
  });

  it("cooldown = 0 → stays 0 (no negative)", () => {
    const state = makeState({ cooldown: 0 });
    const { actions } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._cd()).toBeCloseTo(0);
  });

  it("dodgeT = 0 → dodgeBashDone reset to false", () => {
    const state = makeState({ dodgeT: 0, bashDone: true });
    const { actions } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._bd()).toBe(false);
  });

  it("dodgeT = 0 → setPos not called", () => {
    const state = makeState({ dodgeT: 0 });
    const { actions, calls } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.setPos).toBeNull();
  });

  it("dodgeT = 0 → tryBash not called", () => {
    const state = makeState({ dodgeT: 0 });
    const { actions, calls } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.tryBash).toBe(0);
  });
});

describe("dodge_tick — active dodge (dodgeT > 0)", () => {
  it("dodgeT decremented by dt", () => {
    const state = makeState({ dodgeT: 0.3 });
    const { actions } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._dt()).toBeCloseTo(0.284);
  });

  it("setPos called with hero pos + velocity*dt", () => {
    const pos = { x: 1, y: 0, z: 2, u: 5, v: 10 };
    const state = makeState({ dodgeT: 0.5, velU: 3, velV: 4 });
    const { actions, calls } = makeActions({ pos });
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.setPos[3]).toBeCloseTo(5 + 3 * 0.016);
    expect(calls.setPos[4]).toBeCloseTo(10 + 4 * 0.016);
  });

  it("setPos preserves x, y, z from getPos", () => {
    const pos = { x: 7, y: 1.5, z: 3, u: 0, v: 0 };
    const state = makeState({ dodgeT: 0.5, velU: 1, velV: 1 });
    const { actions, calls } = makeActions({ pos });
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.setPos[0]).toBe(7);
    expect(calls.setPos[1]).toBe(1.5);
    expect(calls.setPos[2]).toBe(3);
  });

  it("spawnTrail called once per active tick", () => {
    const state = makeState({ dodgeT: 0.5 });
    const { actions, calls } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.spawnTrail).toBe(1);
  });

  it("tryBash not called when dodgeBashDone=true", () => {
    const state = makeState({ dodgeT: 0.5, bashDone: true });
    const { actions, calls } = makeActions();
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.tryBash).toBe(0);
  });

  it("tryBash called when dodgeBashDone=false", () => {
    const state = makeState({ dodgeT: 0.5, bashDone: false });
    const { actions, calls } = makeActions({ bashResult: false });
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(calls.tryBash).toBe(1);
  });

  it("dodgeBashDone set to true when tryBash returns true", () => {
    const state = makeState({ dodgeT: 0.5, bashDone: false });
    const { actions } = makeActions({ bashResult: true });
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._bd()).toBe(true);
  });

  it("dodgeBashDone stays false when tryBash returns false", () => {
    const state = makeState({ dodgeT: 0.5, bashDone: false });
    const { actions } = makeActions({ bashResult: false });
    mountDodgeTick({ ...state, actions }).tick(0.016);
    expect(state._bd()).toBe(false);
  });
});

describe("dodge_tick — fuzz", () => {
  it("never throws for 25 random states", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState({
        cooldown: (Math.random() - 0.1) * 0.5,
        dodgeT:   (Math.random() - 0.3) * 0.5,
        velU:     (Math.random() - 0.5) * 8,
        velV:     (Math.random() - 0.5) * 8,
        bashDone: Math.random() > 0.5,
      });
      const { actions } = makeActions({ bashResult: Math.random() > 0.5 });
      expect(() => mountDodgeTick({ ...state, actions }).tick(Math.random() * 0.05)).not.toThrow();
    }
  });
});
