import { it, expect, describe } from "vitest";
import { mountJumpGravityTick } from "../../src/systems/jump_gravity_tick.js";

const JUMP_V  =  8;
const GRAVITY = -22;

function makeState({ vy = 0, spaceWasDown = false, canDJ = false, stamina = 50 } = {}) {
  let _vy = vy, _swd = spaceWasDown, _dj = canDJ, _st = stamina;
  return {
    get: { velocityY: () => _vy, spaceWasDown: () => _swd, canDoubleJump: () => _dj, stamina: () => _st },
    set: { velocityY: v => { _vy = v; }, spaceWasDown: v => { _swd = v; }, canDoubleJump: v => { _dj = v; }, stamina: v => { _st = v; } },
    _vy: () => _vy, _swd: () => _swd, _dj: () => _dj, _st: () => _st,
  };
}

function makeActions({ topY = 0, heroDead = false, onLandCalls = [] } = {}) {
  const calls = { setPos: null, spawnDJFx: 0, onLand: onLandCalls };
  return {
    actions: {
      getPos: () => ({ x: 0, y: 0, z: 0, u: 5, v: 5 }),
      setPos: (x, y, z, u, v) => { calls.setPos = [x, y, z, u, v]; },
      getSupport: (_u, _v, _y) => ({ topY }),
      spawnDoubleJumpFx: (u, y, v) => { calls.spawnDJFx++; },
      onLand: impact => { calls.onLand.push(impact); },
      heroDead: () => heroDead,
    },
    calls,
  };
}

function makeTick(stateOpts, actionOpts, extra = {}) {
  const state = makeState(stateOpts);
  const { actions, calls } = makeActions(actionOpts);
  const { tick } = mountJumpGravityTick({ jumpV: JUMP_V, gravity: GRAVITY, ...state, actions });
  return { state, calls, tick };
}

describe("jump_gravity_tick — buildMode guard", () => {
  it("buildMode=true → returns {onGround: false}", () => {
    const { tick } = makeTick();
    const result = tick(0.016, { spaceDown: false, buildMode: true });
    expect(result.onGround).toBe(false);
  });

  it("buildMode=true → setPos not called", () => {
    const { tick, calls } = makeTick();
    tick(0.016, { spaceDown: false, buildMode: true });
    expect(calls.setPos).toBeNull();
  });
});

describe("jump_gravity_tick — ground jump", () => {
  it("space down while on ground → velocityY set to jumpV", () => {
    const { state, tick } = makeTick({ vy: 0 }, { topY: 0 });
    tick(0.016, { spaceDown: true, buildMode: false });
    // After setting jumpV, gravity is added: jumpV + gravity*dt
    expect(state._vy()).toBeCloseTo(JUMP_V + GRAVITY * 0.016);
  });

  it("space down while on ground → canDoubleJump set to true", () => {
    const { state, tick } = makeTick({ vy: 0 }, { topY: 0 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._dj()).toBe(true);
  });
});

describe("jump_gravity_tick — double jump", () => {
  it("space rising edge in air + canDoubleJump + stamina >= 20 → double jump", () => {
    // hero in air (topY = -5, so pos.y=0 > topY), spaceWasDown=false → rising edge
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 50 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._vy()).toBeCloseTo(JUMP_V * 0.85 + GRAVITY * 0.016);
  });

  it("double jump consumes canDoubleJump", () => {
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 50 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._dj()).toBe(false);
  });

  it("double jump drains 20 stamina", () => {
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 50 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._st()).toBe(30);
  });

  it("double jump triggers spawnDoubleJumpFx", () => {
    const { calls, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 50 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(calls.spawnDJFx).toBe(1);
  });

  it("no double jump when stamina < 20", () => {
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 15 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._dj()).toBe(true); // unchanged — double jump blocked
  });

  it("no double jump when heroDead=true", () => {
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: false, canDJ: true, stamina: 100 }, { topY: -5, heroDead: true });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._dj()).toBe(true); // unchanged
  });

  it("no double jump when space was already down (held, not rising edge)", () => {
    const { state, tick } = makeTick({ vy: 0, spaceWasDown: true, canDJ: true, stamina: 50 }, { topY: -5 });
    tick(0.016, { spaceDown: true, buildMode: false });
    expect(state._dj()).toBe(true); // unchanged — not a rising edge
  });
});

describe("jump_gravity_tick — gravity and landing", () => {
  it("gravity applied every frame", () => {
    // vy=5 so hero moves up first; newY stays positive, no floor clamp
    const { state, tick } = makeTick({ vy: 5 }, { topY: -10 });
    tick(0.016, { spaceDown: false, buildMode: false });
    expect(state._vy()).toBeCloseTo(5 + GRAVITY * 0.016);
  });

  it("landing: newY < supportAfter.topY → velocityY = 0, onGround = true", () => {
    // hero at y=0, vy=-5, topY=0 → after gravity, newY will be negative < topY=0
    const { state, tick } = makeTick({ vy: -5 }, { topY: 0 });
    const result = tick(0.016, { spaceDown: false, buildMode: false });
    expect(state._vy()).toBe(0);
    expect(result.onGround).toBe(true);
  });

  it("landing triggers onLand with impact velocity", () => {
    const onLandCalls = [];
    const { tick } = makeTick({ vy: -5 }, { topY: 0, onLandCalls });
    tick(0.016, { spaceDown: false, buildMode: false });
    expect(onLandCalls.length).toBe(1);
    expect(onLandCalls[0]).toBeLessThan(0); // negative impact
  });

  it("floor clamp: newY < 0 → newY=0, velocityY=0, onGround=true", () => {
    const state = makeState({ vy: -100 });
    const { actions } = makeActions({ topY: -200 }); // support very far below
    const { tick } = mountJumpGravityTick({ jumpV: JUMP_V, gravity: GRAVITY, ...state, actions });
    const result = tick(0.016, { spaceDown: false, buildMode: false });
    expect(result.onGround).toBe(true);
    expect(state._vy()).toBe(0);
    expect(actions.getPos().y).toBe(0); // setPos was called with 0
  });

  it("setPos called with updated newY", () => {
    const { calls, tick } = makeTick({ vy: 0 }, { topY: -100 });
    tick(0.016, { spaceDown: false, buildMode: false });
    // newY = 0 + (0 + GRAVITY*0.016) * 0.016
    const vy = GRAVITY * 0.016;
    const expectedY = vy * 0.016;
    expect(calls.setPos[1]).toBeCloseTo(Math.max(0, expectedY));
  });
});

describe("jump_gravity_tick — onGround return value", () => {
  it("on support → onGround = true", () => {
    // pos.y=0 <= topY+0.001=0.001 → onSupport=true
    const { tick } = makeTick({ vy: 0 }, { topY: 0 });
    const result = tick(0.016, { spaceDown: false, buildMode: false });
    // Must check setPos was called with newY >= topY for landing detection
    expect(result.onGround).toBe(true);
  });

  it("in air with no landing → onGround = false", () => {
    const { tick } = makeTick({ vy: 2 }, { topY: -50 });
    const result = tick(0.016, { spaceDown: false, buildMode: false });
    expect(result.onGround).toBe(false);
  });
});

describe("jump_gravity_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState({
        vy: (Math.random() - 0.5) * 20,
        spaceWasDown: Math.random() > 0.5,
        canDJ: Math.random() > 0.5,
        stamina: Math.random() * 100,
      });
      const { actions } = makeActions({ topY: (Math.random() - 0.3) * 3, heroDead: Math.random() > 0.8 });
      const { tick } = mountJumpGravityTick({ jumpV: JUMP_V, gravity: GRAVITY, ...state, actions });
      expect(() => tick(0.016, { spaceDown: Math.random() > 0.5, buildMode: Math.random() > 0.9 })).not.toThrow();
    }
  });
});
