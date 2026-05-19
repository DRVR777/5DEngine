import { it, expect, describe, vi } from "vitest";
import { mountVehiclePhysicsTick } from "../../src/systems/vehicle_physics_tick.js";

function makeVst() {
  return { altY: 0, speed: 0, heading: 0, gear: 1, gearName: "D" };
}

function makeActions({ keys = {}, camYaw = 0, posMap = {}, carStateLog = [], carPhysicsResult = null, platformDirty = [] } = {}) {
  return {
    key:            k => !!keys[k],
    getCamYaw:      () => camYaw,
    getPos:         id => posMap[id] || null,
    setPos:         vi.fn(),
    updateCarState: s => carStateLog.push({ ...s }),
    carPhysicsStep: vi.fn(() => carPhysicsResult || { speed: 5, heading: 0, gear: 2, gearName: "D" }),
    markPlatformDirty: () => platformDirty.push(1),
  };
}

describe("vehicle_physics_tick — drone: altY clamp", () => {
  it("Space pressed → altY increases", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { Space: true }, posMap: { drone1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    expect(vSt.altY).toBeGreaterThan(0);
  });

  it("KeyC pressed → altY decreases (clamped to 0)", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { KeyC: true }, posMap: { drone1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    expect(vSt.altY).toBe(0); // already at 0, clamped
  });

  it("altY cannot exceed 40", () => {
    const vSt = { ...makeVst(), altY: 39.9 };
    const actions = makeActions({ keys: { Space: true }, posMap: { drone1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 10); // large dt
    expect(vSt.altY).toBeLessThanOrEqual(40);
  });
});

describe("vehicle_physics_tick — drone: position update", () => {
  it("KeyW at camYaw=0 → moves along +z (v increases)", () => {
    const vSt = makeVst();
    const actions = makeActions({
      keys: { KeyW: true },
      camYaw: 0,
      posMap: { drone1: { u: 0, v: 0 } },
    });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    // camYaw=0 → dfz=cos(0)=1, so dv = 1 * mf * DRONE_H * dt = 1 * 15 * 0.1 = 1.5
    const heroCall = actions.setPos.mock.calls.find(c => c[0] === "hero");
    expect(heroCall).toBeDefined();
    expect(heroCall[5]).toBeCloseTo(1.5, 2); // v is index 5: (id, x, y, z, u, v)
  });

  it("no movement keys → drone stays in place", () => {
    const vSt = makeVst();
    const actions = makeActions({ posMap: { drone1: { u: 5, v: 7 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    const heroCall = actions.setPos.mock.calls.find(c => c[0] === "hero");
    expect(heroCall[4]).toBeCloseTo(5, 4); // u is index 4: (id, x, y, z, u, v)
    expect(heroCall[5]).toBeCloseTo(7, 4); // v is index 5
  });

  it("no pos → skips setPos call", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { KeyW: true } }); // posMap empty → returns null
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    expect(actions.setPos).not.toHaveBeenCalled();
  });

  it("moving → speed updated", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { KeyW: true }, posMap: { drone1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickDrone({ type: "drone" }, vSt, "drone1", 0.1);
    expect(vSt.speed).toBeGreaterThan(0);
  });
});

describe("vehicle_physics_tick — ground: delegates to carPhysicsStep", () => {
  it("calls carPhysicsStep with correct key-derived throttle", () => {
    const vSt = makeVst();
    const actions = makeActions({
      keys: { KeyW: true },
      posMap: { car1: { u: 3, v: 4 } },
      carPhysicsResult: { speed: 8, heading: 1.0, gear: 3, gearName: "D" },
    });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickGround({ type: "car", hitbox: { w: 2, d: 4 }, maxSpeed: 20, acceleration: 8, braking: 15, handling: 1.0 }, vSt, "car1", 0.016, []);
    expect(actions.carPhysicsStep).toHaveBeenCalledOnce();
    const call = actions.carPhysicsStep.mock.calls[0];
    expect(call[2]).toBe(1);  // throttle = 1 (KeyW)
    expect(call[3]).toBe(0);  // steerIn = 0 (no A or D)
  });

  it("KeyA → steerIn = +1", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { KeyA: true }, posMap: { car1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickGround({}, vSt, "car1", 0.016, []);
    const call = actions.carPhysicsStep.mock.calls[0];
    expect(call[3]).toBe(1); // steerIn
  });

  it("speed > 0.01 → markPlatformDirty called", () => {
    const platformDirty = [];
    const carPhysicsResult = { speed: 5, heading: 0, gear: 2, gearName: "D" };
    const actions = makeActions({ posMap: { car1: { u: 0, v: 0 } }, platformDirty, carPhysicsResult });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickGround({}, makeVst(), "car1", 0.016, []);
    expect(platformDirty.length).toBe(1);
  });

  it("speed = 0 → markPlatformDirty NOT called", () => {
    const platformDirty = [];
    const actions = makeActions({
      posMap: { car1: { u: 0, v: 0 } },
      platformDirty,
      carPhysicsResult: { speed: 0, heading: 0, gear: 1, gearName: "P" },
    });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickGround({}, makeVst(), "car1", 0.016, []);
    expect(platformDirty.length).toBe(0);
  });

  it("updates vSt from carPhysicsStep result", () => {
    const vSt = makeVst();
    const actions = makeActions({
      posMap: { car1: { u: 0, v: 0 } },
      carPhysicsResult: { speed: 12, heading: 2.1, gear: 4, gearName: "D" },
    });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tickGround({}, vSt, "car1", 0.016, []);
    expect(vSt.speed).toBe(12);
    expect(vSt.heading).toBe(2.1);
    expect(vSt.gear).toBe(4);
  });
});

describe("vehicle_physics_tick — tick dispatcher", () => {
  it("drone vDef → calls tickDrone path (altY changes)", () => {
    const vSt = makeVst();
    const actions = makeActions({ keys: { Space: true }, posMap: { v1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tick(0.1, { vDef: { type: "drone" }, vSt, activeVehicleId: "v1", blockers: [] });
    expect(vSt.altY).toBeGreaterThan(0);
  });

  it("ground vDef → calls carPhysicsStep", () => {
    const vSt = makeVst();
    const actions = makeActions({ posMap: { car1: { u: 0, v: 0 } } });
    const sys = mountVehiclePhysicsTick({ actions });
    sys.tick(0.016, { vDef: { type: "car" }, vSt, activeVehicleId: "car1", blockers: [] });
    expect(actions.carPhysicsStep).toHaveBeenCalled();
  });
});
