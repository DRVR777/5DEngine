import { it, expect, describe } from "vitest";
import { mountHeroMoveTick } from "../../src/systems/hero_move_tick.js";

const FWD   = { x: 0, z: 1 };
const RIGHT = { x: 1, z: 0 };
const SPRINT_SPD = 8;

function makeState({ slideT = 0, slideDU = 0, slideDV = 0, ctrlWasDown = false } = {}) {
  let _sT = slideT, _dU = slideDU, _dV = slideDV, _cwd = ctrlWasDown;
  return {
    get: { slideT: () => _sT, slideDU: () => _dU, slideDV: () => _dV, ctrlWasDown: () => _cwd },
    set: { slideT: v => { _sT = v; }, slideDU: v => { _dU = v; }, slideDV: v => { _dV = v; }, ctrlWasDown: v => { _cwd = v; } },
    _sT: () => _sT, _dU: () => _dU, _dV: () => _dV, _cwd: () => _cwd,
  };
}

function makeActions() {
  const calls = { slideMove: [], applyMove: [], playSlideSound: 0, spawnTrail: 0 };
  return {
    actions: {
      playSlideSound: () => { calls.playSlideSound++; },
      slideMove: (du, dv, bl) => { calls.slideMove.push({ du, dv }); },
      spawnTrail: () => { calls.spawnTrail++; },
      applyMove: (f, r, fwd, right, spd, dt, bl) => { calls.applyMove.push({ f, r, spd }); },
    },
    calls,
  };
}

const BASE = { inputF: 0, inputR: 0, forward: FWD, right: RIGHT, speed: 5, sprintSpeed: SPRINT_SPD,
               canSprint: false, isMoving: false, heroDead: false, buildMode: false, ctrlDown: false, blockers: [] };

describe("hero_move_tick — slide initiation", () => {
  it("ctrl rising edge + canSprint + isMoving → sets slideT to 0.6", () => {
    const state = makeState();
    const { actions } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, canSprint: true, isMoving: true, ctrlDown: true, sprintSpeed: SPRINT_SPD });
    expect(state._sT()).toBeCloseTo(0.6 - 0.016); // slideT set to 0.6 then decremented during slide tick
  });

  it("ctrl rising edge + canSprint + isMoving → plays slide sound", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, canSprint: true, isMoving: true, ctrlDown: true, sprintSpeed: SPRINT_SPD });
    expect(calls.playSlideSound).toBe(1);
  });

  it("ctrl held (not rising edge) → does not re-initiate slide", () => {
    const state = makeState({ ctrlWasDown: true }); // was already down
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, canSprint: true, isMoving: true, ctrlDown: true });
    expect(calls.playSlideSound).toBe(0);
  });

  it("no slide when not canSprint", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, canSprint: false, isMoving: true, ctrlDown: true });
    expect(calls.playSlideSound).toBe(0);
  });

  it("no slide when not isMoving", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, canSprint: true, isMoving: false, ctrlDown: true });
    expect(calls.playSlideSound).toBe(0);
  });

  it("no slide when heroDead", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, canSprint: true, isMoving: true, heroDead: true, ctrlDown: true });
    expect(calls.playSlideSound).toBe(0);
  });

  it("slide DU set proportional to sprintSpeed * 1.5 along forward axis", () => {
    const state = makeState();
    const { actions } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, inputR: 0, canSprint: true, isMoving: true, ctrlDown: true, sprintSpeed: SPRINT_SPD });
    // forward.z = 1, so dv = 1 * 1 = 1, du = 0; normalized dv=1, du=0
    // slideDV = (1/1) * 8 * 1.5 = 12; slideDU = 0
    expect(state._dV()).toBeCloseTo(SPRINT_SPD * 1.5);
    expect(state._dU()).toBeCloseTo(0);
  });
});

describe("hero_move_tick — slide tick", () => {
  it("active slide → slideMove called", () => {
    const state = makeState({ slideT: 0.3, slideDU: 4, slideDV: 8 });
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE });
    expect(calls.slideMove.length).toBe(1);
  });

  it("active slide → spawnTrail called", () => {
    const state = makeState({ slideT: 0.3 });
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE });
    expect(calls.spawnTrail).toBe(1);
  });

  it("active slide → applyMove called with speed=0, inputF=0, inputR=0", () => {
    const state = makeState({ slideT: 0.3 });
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, inputR: 1, speed: 5 });
    expect(calls.applyMove[0].f).toBe(0);
    expect(calls.applyMove[0].r).toBe(0);
    expect(calls.applyMove[0].spd).toBe(0);
  });

  it("slide decays: slideT decremented by dt", () => {
    const state = makeState({ slideT: 0.3 });
    const { actions } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE });
    expect(state._sT()).toBeCloseTo(0.284);
  });

  it("slide finished (slideT=0): applyMove gets real inputF/speed", () => {
    const state = makeState({ slideT: 0 });
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1, speed: 5 });
    expect(calls.applyMove[0].f).toBe(1);
    expect(calls.applyMove[0].spd).toBe(5);
  });
});

describe("hero_move_tick — normal move", () => {
  it("no slide → applyMove always called once", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, inputF: 1 });
    expect(calls.applyMove.length).toBe(1);
  });

  it("ctrlWasDown updated each tick", () => {
    const state = makeState({ ctrlWasDown: false });
    const { actions } = makeActions();
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, ctrlDown: true });
    expect(state._cwd()).toBe(true);
    mountHeroMoveTick({ ...state, actions }).tick(0.016, { ...BASE, ctrlDown: false });
    expect(state._cwd()).toBe(false);
  });
});

describe("hero_move_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState({
        slideT:     Math.max(0, (Math.random() - 0.3) * 0.8),
        slideDU:    (Math.random() - 0.5) * 12,
        slideDV:    (Math.random() - 0.5) * 12,
        ctrlWasDown: Math.random() > 0.5,
      });
      const { actions } = makeActions();
      expect(() => mountHeroMoveTick({ ...state, actions }).tick(0.016, {
        inputF: (Math.random() - 0.5) * 2,
        inputR: (Math.random() - 0.5) * 2,
        forward: FWD, right: RIGHT,
        speed: Math.random() * 10,
        sprintSpeed: SPRINT_SPD,
        canSprint: Math.random() > 0.5,
        isMoving: Math.random() > 0.5,
        heroDead: Math.random() > 0.8,
        buildMode: Math.random() > 0.9,
        ctrlDown: Math.random() > 0.5,
        blockers: [],
      })).not.toThrow();
    }
  });
});
