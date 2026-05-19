import { it, expect, describe } from "vitest";
import { mountFpGunPosTick } from "../../src/systems/fp_gun_pos_tick.js";

function makeState(switchT = 0) {
  let _switchT = switchT;
  return {
    get: { weaponSwitchT: () => _switchT },
    set: { weaponSwitchT: v => { _switchT = v; } },
    _getSwitchT: () => _switchT,
  };
}

function makeActions() {
  const calls = { pos: null, rot: null };
  return {
    actions: {
      setPosition: (x, y, z) => { calls.pos = [x, y, z]; },
      setRotation: (x, y, z) => { calls.rot = [x, y, z]; },
    },
    calls,
  };
}

const BASE_PARAMS = {
  active: true, aiming: false, reloading: false, reloadStart: 0, reloadDur: 1.5,
  canSprint: false, gunBobPhase: 0, gunKickZ: 0, gunReloadX: 0, meleeSwing: 0,
};

function tick612(params = {}, switchT = 0) {
  const state = makeState(switchT);
  const { actions, calls } = makeActions();
  const { tick } = mountFpGunPosTick({ ...state, actions });
  tick(0.016, 1000, { ...BASE_PARAMS, ...params });
  return { calls, state };
}

describe("fp_gun_pos_tick — null safety", () => {
  it("does not throw when active=false", () => {
    const state = makeState();
    const { actions } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    expect(() => tick(0.016, 0, { ...BASE_PARAMS, active: false })).not.toThrow();
  });

  it("does not call setPosition when active=false", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    tick(0.016, 0, { ...BASE_PARAMS, active: false });
    expect(calls.pos).toBeNull();
  });
});

describe("fp_gun_pos_tick — reload animation (rdAmt)", () => {
  it("rdAmt=0 when not reloading → Z position = -0.45", () => {
    const { calls } = tick612({ reloading: false, gunKickZ: 0 });
    expect(calls.pos[2]).toBeCloseTo(-0.45);
  });

  it("rdAmt in first 20% (rdPct=0.10): rdAmt=0.5", () => {
    // rdPct = (now - reloadStart) / reloadDur = (1000 - 850) / 1500 = 0.1
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    tick(0.016, 1000, { ...BASE_PARAMS, reloading: true, reloadStart: 850, reloadDur: 1500 });
    // rdAmt = 0.1/0.2 = 0.5
    // posX = 0.22 + 0 + 0.5*0.10 = 0.27
    expect(calls.pos[0]).toBeCloseTo(0.27);
  });

  it("rdAmt=1.0 at mid reload (rdPct=0.5)", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    // reloadStart=250, reloadDur=1000, now=750: rdPct=0.5 → rdAmt=1.0
    tick(0.016, 750, { ...BASE_PARAMS, reloading: true, reloadStart: 250, reloadDur: 1000 });
    // posX = 0.22 + 0 + 1.0*0.10 = 0.32
    expect(calls.pos[0]).toBeCloseTo(0.32);
  });

  it("rdAmt=0.5 at last 20% (rdPct=0.9)", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    // reloadStart=100, reloadDur=1000, now=1000: rdPct=0.9 → 1-(0.9-0.8)/0.2 = 0.5
    tick(0.016, 1000, { ...BASE_PARAMS, reloading: true, reloadStart: 100, reloadDur: 1000 });
    expect(calls.pos[0]).toBeCloseTo(0.27);
  });

  it("rotation X includes rdAmt contribution (0.42)", () => {
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    // rdPct = 0.5 → rdAmt = 1.0; rotX = 1.0*0.42
    tick(0.016, 750, { ...BASE_PARAMS, reloading: true, reloadStart: 250, reloadDur: 1000 });
    expect(calls.rot[0]).toBeCloseTo(0.42);
  });
});

describe("fp_gun_pos_tick — weapon swap dip", () => {
  it("swapDrop=0 when weaponSwitchT=0", () => {
    const { calls } = tick612({ gunBobPhase: 0 }, 0);
    // posY = -0.24 + 0 (swapDrop=0, bobY=0)
    expect(calls.pos[1]).toBeCloseTo(-0.24);
  });

  it("swapDrop is negative (gun dips) when switch in progress", () => {
    const state = makeState(0.20); // switchT > swDur/2=0.15 → first half
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    tick(0.016, 0, { ...BASE_PARAMS, gunBobPhase: 0 });
    expect(calls.pos[1]).toBeLessThan(-0.24); // swapDrop < 0
  });

  it("weaponSwitchT decremented by dt", () => {
    const state = makeState(0.20);
    const { actions } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    tick(0.016, 0, BASE_PARAMS);
    expect(state._getSwitchT()).toBeCloseTo(0.184);
  });

  it("weaponSwitchT clamped to 0", () => {
    const state = makeState(0.005);
    const { actions } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    tick(0.016, 0, BASE_PARAMS); // dt=0.016 > switchT=0.005
    expect(state._getSwitchT()).toBe(0);
  });
});

describe("fp_gun_pos_tick — aiming", () => {
  it("aimShift=-0.08 when aiming → posX offset", () => {
    const { calls: c1 } = tick612({ aiming: false, gunBobPhase: 0 });
    const { calls: c2 } = tick612({ aiming: true,  gunBobPhase: 0 });
    expect(c2.pos[0] - c1.pos[0]).toBeCloseTo(-0.08);
  });

  it("bobScale=0.25 when aiming (smaller bob)", () => {
    // With gunBobPhase=Math.PI/2: bobY = sin(π/2) * vol * 0.25; vol = 0.013
    const state = makeState();
    const { actions, calls } = makeActions();
    const { tick } = mountFpGunPosTick({ ...state, actions });
    const phase = Math.PI / 2;
    tick(0, 0, { ...BASE_PARAMS, aiming: true, gunBobPhase: phase, canSprint: false });
    const aimBobY = Math.sin(phase) * 0.013 * 0.25;
    expect(calls.pos[1]).toBeCloseTo(-0.24 + aimBobY);
  });
});

describe("fp_gun_pos_tick — bob and kick", () => {
  it("sprint bob amplitude is larger than walk bob amplitude", () => {
    const sprintState = makeState();
    const walkState = makeState();
    const { actions: sA, calls: sCalls } = makeActions();
    const { actions: wA, calls: wCalls } = makeActions();
    const phase = Math.PI / 2; // sin=1 → max bob
    mountFpGunPosTick({ ...sprintState, actions: sA }).tick(0, 0, { ...BASE_PARAMS, canSprint: true,  gunBobPhase: phase });
    mountFpGunPosTick({ ...walkState,   actions: wA }).tick(0, 0, { ...BASE_PARAMS, canSprint: false, gunBobPhase: phase });
    const sprintBob = sCalls.pos[1] - (-0.24); // remove base offset to isolate bob contribution
    const walkBob   = wCalls.pos[1] - (-0.24);
    expect(sprintBob).toBeGreaterThan(walkBob);
  });

  it("gunKickZ contributes to Z position", () => {
    const { calls: c1 } = tick612({ gunKickZ: 0 });
    const { calls: c2 } = tick612({ gunKickZ: 0.1 });
    expect(c2.pos[2] - c1.pos[2]).toBeCloseTo(0.06);
  });

  it("meleeSwing contributes to rotation Z", () => {
    const { calls } = tick612({ meleeSwing: 1.0 });
    expect(calls.rot[2]).toBeCloseTo(0.9);
  });
});

describe("fp_gun_pos_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const state = makeState(Math.random() * 0.5);
      const { actions } = makeActions();
      const { tick } = mountFpGunPosTick({ ...state, actions });
      const params = {
        active: Math.random() > 0.2,
        aiming: Math.random() > 0.5,
        reloading: Math.random() > 0.5,
        reloadStart: Math.random() * 10000,
        reloadDur: 500 + Math.random() * 2000,
        canSprint: Math.random() > 0.5,
        gunBobPhase: Math.random() * Math.PI * 2,
        gunKickZ: (Math.random() - 0.5) * 0.5,
        gunReloadX: (Math.random() - 0.5) * 0.5,
        meleeSwing: (Math.random() - 0.5) * 0.5,
      };
      expect(() => tick(0.016, Math.random() * 30000, params)).not.toThrow();
    }
  });
});
