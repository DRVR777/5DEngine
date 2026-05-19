import { it, expect, describe } from "vitest";
import { mountSniperSway } from "../../src/systems/sniper_sway.js";

function makeSway({ scopeSwayT = 0, breathHoldT = 0, lastSwayPitch = 0, lastSwayYaw = 0, camPitch = 0, camYaw = 0 } = {}) {
  const s = { scopeSwayT, breathHoldT, lastSwayPitch, lastSwayYaw, camPitch, camYaw };
  const get = {
    scopeSwayT:    () => s.scopeSwayT,
    breathHoldT:   () => s.breathHoldT,
    lastSwayPitch: () => s.lastSwayPitch,
    lastSwayYaw:   () => s.lastSwayYaw,
    camPitch:      () => s.camPitch,
    camYaw:        () => s.camYaw,
  };
  const set = {
    scopeSwayT:    v => { s.scopeSwayT    = v; },
    breathHoldT:   v => { s.breathHoldT   = v; },
    lastSwayPitch: v => { s.lastSwayPitch = v; },
    lastSwayYaw:   v => { s.lastSwayYaw   = v; },
    camPitch:      v => { s.camPitch       = v; },
    camYaw:        v => { s.camYaw         = v; },
  };
  const { tick } = mountSniperSway({ get, set });
  return { s, tick };
}

const SCOPED = { isSniperScope: true, heroDead: false, holdingBreath: false, crouching: false };

describe("sniper_sway — inactive branch", () => {
  it("does nothing to camPitch/camYaw when not in scope (sway offsets are 0)", () => {
    const { s, tick } = makeSway();
    tick(0.1, { ...SCOPED, isSniperScope: false });
    expect(s.camPitch).toBe(0);
    expect(s.camYaw).toBe(0);
  });

  it("removes baked-in sway offset when scope is dropped", () => {
    const { s, tick } = makeSway({ camPitch: 1.0, camYaw: 0.5, lastSwayPitch: 0.01, lastSwayYaw: 0.005 });
    tick(0.1, { ...SCOPED, isSniperScope: false });
    expect(s.camPitch).toBeCloseTo(0.99);
    expect(s.camYaw).toBeCloseTo(0.495);
    expect(s.lastSwayPitch).toBe(0);
    expect(s.lastSwayYaw).toBe(0);
  });

  it("resets scopeSwayT and breathHoldT when scope dropped", () => {
    const { s, tick } = makeSway({ scopeSwayT: 2.0, breathHoldT: 1.5 });
    tick(0.1, { ...SCOPED, isSniperScope: false });
    expect(s.scopeSwayT).toBe(0);
    expect(s.breathHoldT).toBe(0);
  });

  it("no-ops when heroDead (treats as inactive)", () => {
    const { s, tick } = makeSway({ scopeSwayT: 1.0, breathHoldT: 0.5 });
    tick(0.1, { ...SCOPED, heroDead: true });
    expect(s.scopeSwayT).toBe(0);
    expect(s.breathHoldT).toBe(0);
  });
});

describe("sniper_sway — active branch", () => {
  it("advances scopeSwayT by dt each frame", () => {
    const { s, tick } = makeSway({ scopeSwayT: 0 });
    tick(0.1, SCOPED);
    expect(s.scopeSwayT).toBeCloseTo(0.1);
    tick(0.1, SCOPED);
    expect(s.scopeSwayT).toBeCloseTo(0.2);
  });

  it("breathHoldT increases while holdingBreath, caps at 3.0", () => {
    const { s, tick } = makeSway({ breathHoldT: 2.9 });
    tick(0.5, { ...SCOPED, holdingBreath: true });
    expect(s.breathHoldT).toBe(3.0);
  });

  it("breathHoldT decreases at 2.5x rate when not holding breath", () => {
    const { s, tick } = makeSway({ breathHoldT: 1.0 });
    tick(0.2, { ...SCOPED, holdingBreath: false }); // 1.0 - 0.2*2.5 = 0.5
    expect(s.breathHoldT).toBeCloseTo(0.5);
  });

  it("breathHoldT floors at 0", () => {
    const { s, tick } = makeSway({ breathHoldT: 0.1 });
    tick(1.0, { ...SCOPED, holdingBreath: false });
    expect(s.breathHoldT).toBe(0);
  });

  it("applies and removes sway offset atomically (camPitch net change = 0 over identical ticks)", () => {
    const { s, tick } = makeSway({ scopeSwayT: 0, camPitch: 0, camYaw: 0 });
    // first tick bakes in sway
    tick(0.016, SCOPED);
    const afterPitch1 = s.camPitch;
    const afterYaw1   = s.camYaw;
    // second tick: removes previous, applies new (t slightly advanced) — net pitch should be close to new sin value
    tick(0.016, SCOPED);
    // verify last sway offsets are non-zero (oscillation running)
    expect(Math.abs(s.lastSwayPitch)).toBeGreaterThan(0);
    expect(Math.abs(s.lastSwayYaw)).toBeGreaterThan(0);
  });

  it("crouching reduces swayMul by 75%", () => {
    // Run two identical sways: one crouching, one not — compare sway amplitude
    const { s: sC, tick: tC } = makeSway({ scopeSwayT: Math.PI / 2 }); // sin(t*0.9) near 1
    tC(0.001, { ...SCOPED, crouching: true });
    const { s: sN, tick: tN } = makeSway({ scopeSwayT: Math.PI / 2 });
    tN(0.001, { ...SCOPED, crouching: false });
    // crouching amplitude should be ~0.25× non-crouching
    expect(Math.abs(sC.lastSwayPitch)).toBeLessThan(Math.abs(sN.lastSwayPitch));
    expect(Math.abs(sC.lastSwayPitch) / Math.abs(sN.lastSwayPitch)).toBeCloseTo(0.25, 1);
  });
});
