import { it, expect, describe } from "vitest";
import { mountHeroFaceTick } from "../../src/systems/hero_face_tick.js";

function makeState(rotY = 0) {
  let _y = rotY;
  return {
    get: { rotY: () => _y },
    set: { rotY: v => { _y = v; } },
    _y: () => _y,
  };
}

const FWD  = { x: 0, z: -1 };
const RIGHT = { x: 1, z:  0 };

function run(params, dt = 0.016, rotY = 0) {
  const state = makeState(rotY);
  const { tick } = mountHeroFaceTick(state);
  const base = { aiming: false, inputF: 0, inputR: 0, forward: FWD, right: RIGHT, camYaw: 0 };
  tick(dt, { ...base, ...params });
  return state._y();
}

describe("hero_face_tick — target facing", () => {
  it("idle with no input → target is camYaw", () => {
    // With large dt the final rotY should converge toward camYaw
    const state = makeState(0);
    const { tick } = mountHeroFaceTick(state);
    tick(100, { aiming: false, inputF: 0, inputR: 0, forward: FWD, right: RIGHT, camYaw: 1.5 });
    expect(state._y()).toBeCloseTo(1.5);
  });

  it("aiming → target is camYaw regardless of input", () => {
    const state = makeState(0);
    const { tick } = mountHeroFaceTick(state);
    tick(100, { aiming: true, inputF: 1, inputR: 0, forward: FWD, right: RIGHT, camYaw: 0.8 });
    expect(state._y()).toBeCloseTo(0.8);
  });

  it("moving without aiming → target is atan2 of movement direction", () => {
    const state = makeState(0);
    const { tick } = mountHeroFaceTick(state);
    // inputF=1, inputR=0, forward=(0,0,-1), right=(1,0,0)
    // targetY = atan2(0*1 + 1*0, -1*1 + 0*0) = atan2(0, -1) = PI
    tick(100, { aiming: false, inputF: 1, inputR: 0, forward: FWD, right: RIGHT, camYaw: 0 });
    expect(state._y()).toBeCloseTo(Math.PI);
  });

  it("strafing right: inputR=1 → atan2(1, 0) = PI/2", () => {
    const state = makeState(0);
    const { tick } = mountHeroFaceTick(state);
    tick(100, { aiming: false, inputF: 0, inputR: 1, forward: FWD, right: RIGHT, camYaw: 0 });
    expect(state._y()).toBeCloseTo(Math.PI / 2);
  });
});

describe("hero_face_tick — angle wrapping", () => {
  it("wraps diff > PI: approaching from -PI+ε should not overshoot", () => {
    // rotY = PI-0.1, camYaw = -(PI-0.1): diff = -2*(PI-0.1) < -PI → gets wrapped
    const rotY = Math.PI - 0.1;
    const camYaw = -(Math.PI - 0.1);
    const state = makeState(rotY);
    const { tick } = mountHeroFaceTick(state);
    tick(0.001, { aiming: false, inputF: 0, inputR: 0, forward: FWD, right: RIGHT, camYaw });
    // After wrapping the diff is small and positive; rotY should move slightly
    expect(Math.abs(state._y())).toBeLessThanOrEqual(Math.PI + 0.01);
  });

  it("wraps diff < -PI symmetrically", () => {
    const rotY = -(Math.PI - 0.1);
    const camYaw = Math.PI - 0.1;
    const state = makeState(rotY);
    const { tick } = mountHeroFaceTick(state);
    tick(0.001, { aiming: false, inputF: 0, inputR: 0, forward: FWD, right: RIGHT, camYaw });
    expect(Math.abs(state._y())).toBeLessThanOrEqual(Math.PI + 0.01);
  });

  it("small diff with no wrapping moves rotY toward target", () => {
    const result = run({ aiming: false, inputF: 0, inputR: 0, camYaw: 0.5 }, 0.016, 0);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.5);
  });
});

describe("hero_face_tick — turn rates", () => {
  it("aiming uses faster turn rate (25 vs 10)", () => {
    const sAim  = makeState(0);
    const sWalk = makeState(0);
    const tAim  = mountHeroFaceTick(sAim);
    const tWalk = mountHeroFaceTick(sWalk);
    const params = { inputF: 0, inputR: 0, forward: FWD, right: RIGHT, camYaw: 1.0 };
    tAim.tick( 0.016, { ...params, aiming: true  });
    tWalk.tick(0.016, { ...params, aiming: false });
    expect(sAim._y()).toBeGreaterThan(sWalk._y());
  });

  it("zero dt → rotY does not change", () => {
    const initial = 0.5;
    const result = run({ camYaw: 1.5 }, 0, initial);
    expect(result).toBeCloseTo(initial);
  });

  it("very large dt → converges fully to target", () => {
    const result = run({ camYaw: 2.0 }, 1000, 0);
    expect(result).toBeCloseTo(2.0);
  });

  it("already at target → no change", () => {
    const result = run({ camYaw: 0 }, 0.016, 0);
    expect(result).toBeCloseTo(0);
  });
});

describe("hero_face_tick — fuzz", () => {
  it("never throws for 25 random states", () => {
    for (let i = 0; i < 25; i++) {
      const state = makeState((Math.random() - 0.5) * Math.PI * 4);
      const { tick } = mountHeroFaceTick(state);
      const angle = Math.random() * Math.PI * 2;
      const params = {
        aiming:  Math.random() > 0.5,
        inputF:  (Math.random() - 0.5) * 2,
        inputR:  (Math.random() - 0.5) * 2,
        forward: { x: Math.cos(angle), z: Math.sin(angle) },
        right:   { x: -Math.sin(angle), z: Math.cos(angle) },
        camYaw:  (Math.random() - 0.5) * Math.PI * 4,
      };
      expect(() => tick(Math.random() * 0.1, params)).not.toThrow();
    }
  });
});
