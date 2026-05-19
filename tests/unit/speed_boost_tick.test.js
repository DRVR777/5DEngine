import { it, expect, describe } from "vitest";
import { mountSpeedBoostTick } from "../../src/systems/speed_boost_tick.js";

function makeBoost({ speedBoostT = 0, speedTrailT = 0 } = {}) {
  const s = { speedBoostT, speedTrailT };
  const trail = [];
  const get = { speedBoostT: () => s.speedBoostT, speedTrailT: () => s.speedTrailT };
  const set = { speedBoostT: v => { s.speedBoostT = v; }, speedTrailT: v => { s.speedTrailT = v; } };
  const actions = { spawnTrail: () => trail.push(1) };
  const { tick } = mountSpeedBoostTick({ get, set, actions });
  return { s, trail, tick };
}

const ACTIVE = { isMoving: true, inCar: false, buildMode: false, heroDead: false };

describe("speed_boost_tick — inactive", () => {
  it("returns 1.0 multiplier when speedBoostT is 0", () => {
    const { tick } = makeBoost({ speedBoostT: 0 });
    expect(tick(0.1, ACTIVE)).toBe(1.0);
  });

  it("does not decrement speedBoostT when already 0", () => {
    const { s, tick } = makeBoost({ speedBoostT: 0 });
    tick(0.5, ACTIVE);
    expect(s.speedBoostT).toBe(0);
  });

  it("spawns no trail when inactive", () => {
    const { trail, tick } = makeBoost({ speedBoostT: 0 });
    tick(1.0, ACTIVE);
    expect(trail).toHaveLength(0);
  });
});

describe("speed_boost_tick — active", () => {
  it("returns 1.5 multiplier while speedBoostT > 0", () => {
    const { tick } = makeBoost({ speedBoostT: 2.0 });
    expect(tick(0.1, ACTIVE)).toBe(1.5);
  });

  it("decrements speedBoostT by dt each frame", () => {
    const { s, tick } = makeBoost({ speedBoostT: 2.0 });
    tick(0.5, ACTIVE);
    expect(s.speedBoostT).toBeCloseTo(1.5);
  });

  it("returns 1.0 in the frame speedBoostT crosses 0", () => {
    const { tick } = makeBoost({ speedBoostT: 0.1 });
    expect(tick(0.5, ACTIVE)).toBe(1.0); // 0.1 - 0.5 = -0.4 → not > 0
  });

  it("spawns trail particle when speedTrailT crosses 0 while moving", () => {
    const { trail, tick } = makeBoost({ speedBoostT: 2.0, speedTrailT: 0.05 });
    tick(0.1, ACTIVE); // 0.05 - 0.1 = -0.05 → fires trail
    expect(trail).toHaveLength(1);
  });

  it("resets speedTrailT to 0.08 after trail fires", () => {
    const { s, tick } = makeBoost({ speedBoostT: 2.0, speedTrailT: 0.05 });
    tick(0.1, ACTIVE);
    expect(s.speedTrailT).toBeCloseTo(0.08);
  });

  it("does not spawn trail when not moving", () => {
    const { trail, tick } = makeBoost({ speedBoostT: 2.0, speedTrailT: 0.0 });
    tick(0.1, { ...ACTIVE, isMoving: false });
    expect(trail).toHaveLength(0);
  });

  it("does not spawn trail when inCar", () => {
    const { trail, tick } = makeBoost({ speedBoostT: 2.0, speedTrailT: 0.0 });
    tick(0.1, { ...ACTIVE, inCar: true });
    expect(trail).toHaveLength(0);
  });

  it("does not spawn trail when heroDead", () => {
    const { trail, tick } = makeBoost({ speedBoostT: 2.0, speedTrailT: 0.0 });
    tick(0.1, { ...ACTIVE, heroDead: true });
    expect(trail).toHaveLength(0);
  });

  it("fuzz: multiplier is always 1.0 or 1.5, never another value", () => {
    for (let i = 0; i < 15; i++) {
      const { tick } = makeBoost({ speedBoostT: Math.random() * 3 });
      const mul = tick(Math.random() * 0.5, ACTIVE);
      expect([1.0, 1.5]).toContain(mul);
    }
  });
});
