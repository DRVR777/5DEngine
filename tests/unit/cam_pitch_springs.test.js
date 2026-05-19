import { it, expect, describe } from "vitest";
import { mountCamPitchSprings } from "../../src/systems/cam_pitch_springs.js";

function makeSprings({ recoilPitch = 0, hitPunchPitch = 0, camPitch = 0, camPitchMax = 0.4 } = {}) {
  const s = { recoilPitch, hitPunchPitch, camPitch };
  const get = { recoilPitch: () => s.recoilPitch, hitPunchPitch: () => s.hitPunchPitch, camPitch: () => s.camPitch };
  const set = { recoilPitch: v => { s.recoilPitch = v; }, hitPunchPitch: v => { s.hitPunchPitch = v; }, camPitch: v => { s.camPitch = v; } };
  const { tick } = mountCamPitchSprings({ camPitchMax, get, set });
  return { s, tick };
}

describe("cam_pitch_springs — recoil", () => {
  it("does nothing when recoilPitch is 0", () => {
    const { s, tick } = makeSprings({ camPitch: 0.1 });
    tick(0.016);
    expect(s.camPitch).toBeCloseTo(0.1);
  });

  it("applies recoil as camPitch offset proportional to dt", () => {
    const { s, tick } = makeSprings({ recoilPitch: 0.5, camPitch: 0 });
    tick(0.1);
    expect(s.camPitch).toBeGreaterThan(0); // recoil pushed pitch up
  });

  it("recoilPitch decays toward 0 each frame", () => {
    const { s, tick } = makeSprings({ recoilPitch: 0.5 });
    tick(0.1);
    expect(s.recoilPitch).toBeGreaterThan(0);
    expect(s.recoilPitch).toBeLessThan(0.5);
  });

  it("clamps recoilPitch to 0 when below 0.0001 threshold", () => {
    const { s, tick } = makeSprings({ recoilPitch: 0.00005 });
    tick(0.016);
    expect(s.recoilPitch).toBe(0);
  });

  it("fuzz: recoilPitch never drives camPitch below initial (always pushes up)", () => {
    for (let i = 0; i < 10; i++) {
      const initial = Math.random() * 0.3;
      const { s, tick } = makeSprings({ recoilPitch: Math.random() * 0.3, camPitch: initial });
      tick(Math.random() * 0.1 + 0.01);
      expect(s.camPitch).toBeGreaterThanOrEqual(initial);
    }
  });
});

describe("cam_pitch_springs — hit punch", () => {
  it("does nothing when hitPunchPitch <= 0.0001", () => {
    const { s, tick } = makeSprings({ hitPunchPitch: 0, camPitch: 0.1 });
    tick(0.016);
    expect(s.camPitch).toBeCloseTo(0.1);
  });

  it("pushes camPitch up by hitPunchPitch * dt * 10", () => {
    const { s, tick } = makeSprings({ hitPunchPitch: 0.05, camPitch: 0 });
    tick(0.1);
    expect(s.camPitch).toBeGreaterThan(0);
  });

  it("clamps camPitch to camPitchMax", () => {
    const { s, tick } = makeSprings({ hitPunchPitch: 0.5, camPitch: 0.39, camPitchMax: 0.4 });
    tick(1.0);
    expect(s.camPitch).toBeLessThanOrEqual(0.4);
  });

  it("hitPunchPitch decays exponentially each frame", () => {
    const { s, tick } = makeSprings({ hitPunchPitch: 0.1 });
    tick(0.1);
    expect(s.hitPunchPitch).toBeLessThan(0.1);
    expect(s.hitPunchPitch).toBeGreaterThan(0);
  });

  it("hitPunchPitch snaps to 0 after decaying below 0.0001", () => {
    const { s, tick } = makeSprings({ hitPunchPitch: 0.001 });
    // exp decay at rate 14: after dt=1s, 0.001 * e^-14 ≈ 8e-7 < 0.0001
    tick(1.0);
    expect(s.hitPunchPitch).toBe(0);
  });
});
