import { it, expect, describe, vi, beforeEach, afterEach } from "vitest";
import { mountCrouchSpeedTick } from "../../src/systems/crouch_speed_tick.js";

function makeActions(spawnLog = []) {
  return { spawnSprintTrail: () => spawnLog.push(1) };
}

const BASE = { buildMode: false, inCar: false, computerOpen: false, heroDead: false, aiming: false, isSprinting: false, isMoving: false, pointerLocked: true };

describe("mountCrouchSpeedTick — crouching flag", () => {
  it("ControlLeft + no flags → crouching=true", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: { ControlLeft: true } });
    expect(crouching).toBe(true);
  });

  it("ControlRight → crouching=true", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: { ControlRight: true } });
    expect(crouching).toBe(true);
  });

  it("buildMode=true → crouching=false", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: { ControlLeft: true }, buildMode: true });
    expect(crouching).toBe(false);
  });

  it("inCar=true → crouching=false", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: { ControlLeft: true }, inCar: true });
    expect(crouching).toBe(false);
  });

  it("computerOpen=true → crouching=false", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: { ControlLeft: true }, computerOpen: true });
    expect(crouching).toBe(false);
  });

  it("no ctrl key → crouching=false", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouching } = sys.tick(0.016, { ...BASE, keys: {} });
    expect(crouching).toBe(false);
  });
});

describe("mountCrouchSpeedTick — crouchAmt spring", () => {
  it("crouching with large dt → crouchAmt reaches 1", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouchAmt } = sys.tick(100, { ...BASE, keys: { ControlLeft: true } });
    expect(crouchAmt).toBeCloseTo(1, 5);
  });

  it("not crouching after being crouched → crouchAmt returns toward 0", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    sys.tick(100, { ...BASE, keys: { ControlLeft: true } }); // fully crouched
    const { crouchAmt } = sys.tick(0.016, { ...BASE, keys: {} });
    expect(crouchAmt).toBeLessThan(1); // started decreasing
    expect(crouchAmt).toBeGreaterThan(0);
  });

  it("crouchAmt persists across ticks (stateful spring)", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const first = sys.tick(0.05, { ...BASE, keys: { ControlLeft: true } });
    const second = sys.tick(0.05, { ...BASE, keys: { ControlLeft: true } });
    expect(second.crouchAmt).toBeGreaterThan(first.crouchAmt);
  });
});

describe("mountCrouchSpeedTick — crouchSpeedMul", () => {
  it("fully standing → crouchSpeedMul=1", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouchSpeedMul } = sys.tick(0.016, { ...BASE, keys: {} });
    expect(crouchSpeedMul).toBeCloseTo(1, 5);
  });

  it("fully crouched → crouchSpeedMul=0.6", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { crouchSpeedMul } = sys.tick(100, { ...BASE, keys: { ControlLeft: true } });
    expect(crouchSpeedMul).toBeCloseTo(0.6, 5);
  });
});

describe("mountCrouchSpeedTick — moveSpreadTarget", () => {
  it("aiming → 0", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { moveSpreadTarget } = sys.tick(0.016, { ...BASE, keys: {}, aiming: true, isSprinting: true, isMoving: true });
    expect(moveSpreadTarget).toBe(0);
  });

  it("isSprinting (not aiming) → 1", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { moveSpreadTarget } = sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: true });
    expect(moveSpreadTarget).toBe(1);
  });

  it("isMoving + crouching → 0.18", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { moveSpreadTarget } = sys.tick(0.016, { ...BASE, keys: { ControlLeft: true }, isMoving: true });
    expect(moveSpreadTarget).toBe(0.18);
  });

  it("isMoving + not crouching → 0.45", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { moveSpreadTarget } = sys.tick(0.016, { ...BASE, keys: {}, isMoving: true });
    expect(moveSpreadTarget).toBe(0.45);
  });

  it("idle (not moving, not sprinting) → 0", () => {
    const sys = mountCrouchSpeedTick({ actions: makeActions() });
    const { moveSpreadTarget } = sys.tick(0.016, { ...BASE, keys: {} });
    expect(moveSpreadTarget).toBe(0);
  });
});

describe("mountCrouchSpeedTick — sprint trail", () => {
  let restoreRandom;

  beforeEach(() => {
    restoreRandom = Math.random;
    Math.random = () => 0.1; // always triggers trail
  });

  afterEach(() => {
    Math.random = restoreRandom;
  });

  it("isSprinting+isMoving+alive+locked → spawns trail", () => {
    const log = [];
    const sys = mountCrouchSpeedTick({ actions: makeActions(log) });
    sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: true, pointerLocked: true });
    expect(log.length).toBe(1);
  });

  it("heroDead=true → no trail", () => {
    const log = [];
    const sys = mountCrouchSpeedTick({ actions: makeActions(log) });
    sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: true, heroDead: true });
    expect(log.length).toBe(0);
  });

  it("pointerLocked=false → no trail", () => {
    const log = [];
    const sys = mountCrouchSpeedTick({ actions: makeActions(log) });
    sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: true, pointerLocked: false });
    expect(log.length).toBe(0);
  });

  it("isMoving=false → no trail", () => {
    const log = [];
    const sys = mountCrouchSpeedTick({ actions: makeActions(log) });
    sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: false });
    expect(log.length).toBe(0);
  });

  it("random >= 0.45 → no trail", () => {
    Math.random = () => 0.5;
    const log = [];
    const sys = mountCrouchSpeedTick({ actions: makeActions(log) });
    sys.tick(0.016, { ...BASE, keys: {}, isSprinting: true, isMoving: true });
    expect(log.length).toBe(0);
  });
});
