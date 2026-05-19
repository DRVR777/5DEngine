import { it, expect, describe } from "vitest";
import { mountWalkAnimTick } from "../../src/systems/walk_anim_tick.js";

function makeState(kickZ = 0, reloadX = 0) {
  let _kz = kickZ, _rx = reloadX;
  return {
    get: { gunKickZ: () => _kz, gunReloadX: () => _rx },
    set: { gunKickZ: v => { _kz = v; }, gunReloadX: v => { _rx = v; } },
    _kz: () => _kz,
    _rx: () => _rx,
  };
}

function makeActions(wc = { swing: 0, bob: 0, t: 0, speed: 0 }) {
  const calls = { thighs: null, shins: null, arms: null, gunMount: null, torsoY: null };
  return {
    actions: {
      walkCycle: (_dt, _gs) => wc,
      setThighs:   v          => { calls.thighs   = v; },
      setShins:    v          => { calls.shins    = v; },
      setArms:     (l, r)    => { calls.arms     = [l, r]; },
      setGunMount: (px,py,pz,rx,ry,rz) => { calls.gunMount = [px,py,pz,rx,ry,rz]; },
      setTorsoY:   y          => { calls.torsoY   = y; },
    },
    calls,
  };
}

function run(params = {}, wc = { swing: 0, bob: 0, t: 0, speed: 0 }, kickZ = 0, reloadX = 0) {
  const state = makeState(kickZ, reloadX);
  const { actions, calls } = makeActions(wc);
  const { tick } = mountWalkAnimTick({ ...state, actions });
  const base = { groundSpeed: 0, aimAmt: 0, reloading: false };
  tick(0.016, { ...base, ...params });
  return { calls, state };
}

describe("walk_anim_tick — thighs and shins", () => {
  it("setThighs called with wc.swing * 1.3", () => {
    const { calls } = run({}, { swing: 1.0, bob: 0, t: 0, speed: 0 });
    expect(calls.thighs).toBeCloseTo(1.3);
  });

  it("setShins called with same value as setThighs", () => {
    const { calls } = run({}, { swing: 0.5, bob: 0, t: 0, speed: 0 });
    expect(calls.shins).toBeCloseTo(calls.thighs);
  });

  it("zero swing → thighs and shins = 0", () => {
    const { calls } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 });
    expect(calls.thighs).toBeCloseTo(0);
    expect(calls.shins).toBeCloseTo(0);
  });

  it("negative swing propagates to setThighs/setShins", () => {
    const { calls } = run({}, { swing: -0.6, bob: 0, t: 0, speed: 0 });
    expect(calls.thighs).toBeCloseTo(-0.6 * 1.3);
  });
});

describe("walk_anim_tick — arms", () => {
  it("no aim → arms are mirror of swing×SWING×0.7", () => {
    const swing = 0.8;
    const { calls } = run({ aimAmt: 0 }, { swing, bob: 0, t: 0, speed: 0 });
    const expected = swing * 1.3 * 0.7;
    expect(calls.arms[0]).toBeCloseTo(-expected); // L
    expect(calls.arms[1]).toBeCloseTo(+expected); // R
  });

  it("full aim (aimAmt=1) → both arms at -PI/2", () => {
    const { calls } = run({ aimAmt: 1 }, { swing: 1.0, bob: 0, t: 0, speed: 0 });
    expect(calls.arms[0]).toBeCloseTo(-Math.PI / 2);
    expect(calls.arms[1]).toBeCloseTo(-Math.PI / 2);
  });

  it("half aim blends walk and aim raise correctly", () => {
    const swing = 0.5;
    const aimAmt = 0.5;
    const aimRaise = -Math.PI / 2 * aimAmt;
    const walkL = -swing * 1.3 * 0.7;
    const walkR =  swing * 1.3 * 0.7;
    const expectedL = walkL * (1 - aimAmt) + aimRaise;
    const expectedR = walkR * (1 - aimAmt) + aimRaise;
    const { calls } = run({ aimAmt }, { swing, bob: 0, t: 0, speed: 0 });
    expect(calls.arms[0]).toBeCloseTo(expectedL);
    expect(calls.arms[1]).toBeCloseTo(expectedR);
  });
});

describe("walk_anim_tick — gun kick spring", () => {
  it("gunKickZ decays toward 0 over time", () => {
    const { state } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 }, 0.5);
    expect(state._kz()).toBeLessThan(0.5);
    expect(state._kz()).toBeGreaterThan(0);
  });

  it("gunKickZ=0 stays 0", () => {
    const { state } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 }, 0);
    expect(state._kz()).toBeCloseTo(0);
  });

  it("large dt fully drains gunKickZ", () => {
    const state = makeState(0.8, 0);
    const { actions } = makeActions({ swing: 0, bob: 0, t: 0, speed: 0 });
    const { tick } = mountWalkAnimTick({ ...state, actions });
    tick(100, { groundSpeed: 0, aimAmt: 0, reloading: false });
    expect(state._kz()).toBeCloseTo(0);
  });
});

describe("walk_anim_tick — gun reload spring", () => {
  it("reloading=true drives gunReloadX toward 0.75", () => {
    const { state } = run({ reloading: true }, { swing: 0, bob: 0, t: 0, speed: 0 }, 0, 0);
    expect(state._rx()).toBeGreaterThan(0);
    expect(state._rx()).toBeLessThanOrEqual(0.75);
  });

  it("reloading=false drives gunReloadX toward 0", () => {
    const { state } = run({ reloading: false }, { swing: 0, bob: 0, t: 0, speed: 0 }, 0, 0.5);
    expect(state._rx()).toBeLessThan(0.5);
  });

  it("large dt with reloading=true snaps to 0.75", () => {
    const state = makeState(0, 0);
    const { actions } = makeActions({ swing: 0, bob: 0, t: 0, speed: 0 });
    const { tick } = mountWalkAnimTick({ ...state, actions });
    tick(100, { groundSpeed: 0, aimAmt: 0, reloading: true });
    expect(state._rx()).toBeCloseTo(0.75);
  });
});

describe("walk_anim_tick — gun mount position and rotation", () => {
  it("setGunMount posX=0 always", () => {
    const { calls } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 });
    expect(calls.gunMount[0]).toBe(0);
  });

  it("setGunMount posY includes bob contribution", () => {
    const { calls } = run({}, { swing: 0, bob: 0.1, t: 0, speed: 0 });
    expect(calls.gunMount[1]).toBeCloseTo(-0.7 + 0.1 * 0.3);
  });

  it("setGunMount posZ = 0.2 + kz", () => {
    const { calls } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 }, 0.2);
    // kz decays: kz' = 0.2 + (0 - 0.2)*min(1, 0.016*18) ≈ 0.2 - 0.2*0.288 ≈ 0.1424
    const kzAfter = 0.2 + (0 - 0.2) * Math.min(1, 0.016 * 18);
    expect(calls.gunMount[2]).toBeCloseTo(0.2 + kzAfter);
  });

  it("setGunMount rotX = gunReloadX after spring step", () => {
    const rx0 = 0.3;
    const { calls } = run({ reloading: false }, { swing: 0, bob: 0, t: 0, speed: 0 }, 0, rx0);
    const rxAfter = rx0 + (0 - rx0) * Math.min(1, 0.016 * 10);
    expect(calls.gunMount[3]).toBeCloseTo(rxAfter);
  });

  it("setGunMount rotY = 0 always", () => {
    const { calls } = run({}, { swing: 0.5, bob: 0.2, t: 1.0, speed: 1.0 });
    expect(calls.gunMount[4]).toBe(0);
  });

  it("setGunMount rotZ includes gun sway from wc.t and wc.speed", () => {
    const wc = { swing: 0, bob: 0, t: 1.0, speed: 2.0 };
    const { calls } = run({}, wc);
    const expectedSway = Math.sin(1.0 * 2.2 + Math.PI) * 2.0 * 0.018;
    expect(calls.gunMount[5]).toBeCloseTo(expectedSway);
  });
});

describe("walk_anim_tick — torso Y", () => {
  it("setTorsoY = 1.25 + wc.bob", () => {
    const { calls } = run({}, { swing: 0, bob: 0.15, t: 0, speed: 0 });
    expect(calls.torsoY).toBeCloseTo(1.25 + 0.15);
  });

  it("zero bob → torsoY = 1.25", () => {
    const { calls } = run({}, { swing: 0, bob: 0, t: 0, speed: 0 });
    expect(calls.torsoY).toBeCloseTo(1.25);
  });
});

describe("walk_anim_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    for (let i = 0; i < 25; i++) {
      const wc = {
        swing: (Math.random() - 0.5) * 2,
        bob:   (Math.random() - 0.5) * 0.4,
        t:     Math.random() * 100,
        speed: Math.random() * 10,
      };
      const state = makeState(Math.random(), Math.random());
      const { actions } = makeActions(wc);
      const { tick } = mountWalkAnimTick({ ...state, actions });
      const params = {
        groundSpeed: Math.random() * 8,
        aimAmt:      Math.random(),
        reloading:   Math.random() > 0.5,
      };
      expect(() => tick(Math.random() * 0.05, params)).not.toThrow();
    }
  });
});
