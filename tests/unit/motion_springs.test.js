import { it, expect, describe } from "vitest";
import { mountMotionSprings } from "../../src/systems/motion_springs.js";

function makeSprings({ moveSpread = 0, gunBobPhase = 0, strafeRollAmt = 0 } = {}) {
  const s = { moveSpread, gunBobPhase, strafeRollAmt };
  const get = { moveSpread: () => s.moveSpread, gunBobPhase: () => s.gunBobPhase, strafeRollAmt: () => s.strafeRollAmt };
  const set = { moveSpread: v => { s.moveSpread = v; }, gunBobPhase: v => { s.gunBobPhase = v; }, strafeRollAmt: v => { s.strafeRollAmt = v; } };
  const { tick } = mountMotionSprings({ get, set });
  return { s, tick };
}

const BASE = { moveSpreadTarget: 0, isMoving: false, inCar: false, buildMode: false, heroDead: false, canSprint: false, inputR: 0, aiming: false };

describe("motion_springs — moveSpread", () => {
  it("springs moveSpread toward target", () => {
    const { s, tick } = makeSprings({ moveSpread: 0 });
    tick(0.05, { ...BASE, moveSpreadTarget: 1 }); // factor = min(1, 0.05*5)=0.25 → partial
    expect(s.moveSpread).toBeGreaterThan(0);
    expect(s.moveSpread).toBeLessThan(1);
  });

  it("moveSpread reaches near-target after large dt", () => {
    const { s, tick } = makeSprings({ moveSpread: 0 });
    tick(10, { ...BASE, moveSpreadTarget: 1 });
    expect(s.moveSpread).toBeCloseTo(1, 3);
  });

  it("moveSpread decays to 0 when target is 0", () => {
    const { s, tick } = makeSprings({ moveSpread: 1 });
    tick(10, { ...BASE, moveSpreadTarget: 0 });
    expect(s.moveSpread).toBeCloseTo(0, 3);
  });
});

describe("motion_springs — gunBobPhase", () => {
  it("advances gunBobPhase at walk rate (7/s) when moving", () => {
    const { s, tick } = makeSprings({ gunBobPhase: 0 });
    tick(1.0, { ...BASE, isMoving: true, canSprint: false });
    expect(s.gunBobPhase).toBeCloseTo(7, 3);
  });

  it("advances gunBobPhase at sprint rate (11/s) when canSprint", () => {
    const { s, tick } = makeSprings({ gunBobPhase: 0 });
    tick(1.0, { ...BASE, isMoving: true, canSprint: true });
    expect(s.gunBobPhase).toBeCloseTo(11, 3);
  });

  it("decays gunBobPhase exponentially when not moving", () => {
    const { s, tick } = makeSprings({ gunBobPhase: 5 });
    tick(0.2, { ...BASE, isMoving: false });
    expect(s.gunBobPhase).toBeLessThan(5);
    expect(s.gunBobPhase).toBeGreaterThan(0);
  });

  it("does not advance when inCar", () => {
    const { s, tick } = makeSprings({ gunBobPhase: 0 });
    tick(0.5, { ...BASE, isMoving: true, inCar: true });
    expect(s.gunBobPhase).toBeLessThan(0.01); // decay from 0 stays near 0
  });

  it("does not advance when heroDead", () => {
    const { s, tick } = makeSprings({ gunBobPhase: 0 });
    tick(0.5, { ...BASE, isMoving: true, heroDead: true });
    expect(s.gunBobPhase).toBeLessThan(0.01);
  });

  it("fuzz: gunBobPhase never negative regardless of inputs", () => {
    for (let i = 0; i < 15; i++) {
      const { s, tick } = makeSprings({ gunBobPhase: Math.random() * 10 });
      tick(Math.random() * 0.5 + 0.01, { ...BASE, isMoving: Math.random() > 0.5 });
      expect(s.gunBobPhase).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("motion_springs — strafeRollAmt", () => {
  it("springs toward inputR when not aiming", () => {
    const { s, tick } = makeSprings({ strafeRollAmt: 0 });
    tick(10, { ...BASE, inputR: 1, aiming: false });
    expect(s.strafeRollAmt).toBeCloseTo(1, 3);
  });

  it("springs toward inputR * 0.3 when aiming", () => {
    const { s, tick } = makeSprings({ strafeRollAmt: 0 });
    tick(10, { ...BASE, inputR: 1, aiming: true });
    expect(s.strafeRollAmt).toBeCloseTo(0.3, 3);
  });

  it("decays to 0 when inputR is 0", () => {
    const { s, tick } = makeSprings({ strafeRollAmt: 0.8 });
    tick(10, { ...BASE, inputR: 0 });
    expect(s.strafeRollAmt).toBeCloseTo(0, 3);
  });
});
