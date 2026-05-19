import { it, expect, describe } from "vitest";
import { mountVehicleRenderTick } from "../../src/systems/vehicle_render_tick.js";

function makeMesh({ type = "car", speed = 0, heading = 0 } = {}) {
  const pos = { x: 0, y: 0, z: 0 };
  const mesh = {
    visible: false,
    rotation: { x: 0, y: 0, z: 0 },
    position: { set: (x, y, z) => { pos.x = x; pos.y = y; pos.z = z; } },
    _pos: pos,
  };
  if (type === "drone") {
    const rotors = [{ rotation: { y: 0 } }, { rotation: { y: 0 } }];
    mesh._rotors = rotors;
  }
  if (type === "mech") {
    mesh._legs = [
      { thighM: { rotation: { x: 0 } } },
      { thighM: { rotation: { x: 0 } } },
    ];
  }
  if (type === "car") {
    mesh._wheels = [{ rotation: { x: 0 } }, { rotation: { x: 0 } }];
  }
  return mesh;
}

function makeState({ vehicleDefs, states, renderPos, activeVehicleId = null, inCar = false, keys = {} } = {}) {
  const vehicleMeshes = new Map();
  const vehicleStates = new Map();
  for (const vDef of vehicleDefs) {
    vehicleMeshes.set(vDef.id, makeMesh({ type: vDef.type, ...(states && states[vDef.id]) }));
    vehicleStates.set(vDef.id, { heading: 0, speed: 0, ...(states && states[vDef.id]) });
  }
  return {
    vehicleDefs,
    vehicleMeshes,
    vehicleStates,
    activeVehicleId,
    inCar,
    keys,
    toRenderPos: id => renderPos && renderPos[id] ? renderPos[id] : { x: 0, y: 0, z: 1 },
    vehicleMeshes,
    vehicleStates,
  };
}

describe("vehicle_render_tick — position update", () => {
  it("sets group position from toRenderPos", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs, renderPos: { car1: { x: 3, y: 1, z: 5 } } });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("car1")._pos).toEqual({ x: 3, y: 1, z: 5 });
  });

  it("skips vehicle when toRenderPos returns null/undefined", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs });
    state.toRenderPos = () => null;
    expect(() => mountVehicleRenderTick().tick(0.016, state)).not.toThrow();
  });

  it("skips vehicle when no mesh in vehicleMeshes", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs });
    state.vehicleMeshes.delete("car1");
    expect(() => mountVehicleRenderTick().tick(0.016, state)).not.toThrow();
  });
});

describe("vehicle_render_tick — car behavior", () => {
  it("car visible = true", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("car1").visible).toBe(true);
  });

  it("car rotation.y = vst.heading", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs, states: { car1: { heading: 1.23, speed: 0 } } });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("car1").rotation.y).toBeCloseTo(1.23);
  });

  it("car wheels spin when speed > 0", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs, states: { car1: { heading: 0, speed: 10 } } });
    mountVehicleRenderTick().tick(0.016, state);
    const wheels = state.vehicleMeshes.get("car1")._wheels;
    expect(wheels[0].rotation.x).not.toBe(0);
  });

  it("car wheels don't spin when speed = 0", () => {
    const vDefs = [{ id: "car1", type: "car" }];
    const state = makeState({ vehicleDefs: vDefs, states: { car1: { heading: 0, speed: 0 } } });
    mountVehicleRenderTick().tick(0.016, state);
    const wheels = state.vehicleMeshes.get("car1")._wheels;
    expect(wheels[0].rotation.x).toBe(0);
  });
});

describe("vehicle_render_tick — drone behavior", () => {
  it("drone visible = true", () => {
    const vDefs = [{ id: "d1", type: "drone" }];
    const state = makeState({ vehicleDefs: vDefs });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("d1").visible).toBe(true);
  });

  it("drone rotors spin", () => {
    const vDefs = [{ id: "d1", type: "drone" }];
    const state = makeState({ vehicleDefs: vDefs, states: { d1: { heading: 0, speed: 0 } } });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("d1")._rotors[0].rotation.y).toBeGreaterThan(0);
  });

  it("drone rotors spin faster at speed > 0.5", () => {
    const vDefs = [{ id: "d1", type: "drone" }];
    const slowState = makeState({ vehicleDefs: vDefs, states: { d1: { heading: 0, speed: 0 } } });
    const fastState = makeState({ vehicleDefs: vDefs, states: { d1: { heading: 0, speed: 1 } } });
    mountVehicleRenderTick().tick(0.016, slowState);
    mountVehicleRenderTick().tick(0.016, fastState);
    expect(fastState.vehicleMeshes.get("d1")._rotors[0].rotation.y)
      .toBeGreaterThan(slowState.vehicleMeshes.get("d1")._rotors[0].rotation.y);
  });

  it("drone tilt applied when inCar + activeVehicleId + speed > 0.3 + KeyW", () => {
    const vDefs = [{ id: "d1", type: "drone" }];
    const state = makeState({ vehicleDefs: vDefs, states: { d1: { heading: 0, speed: 0.5 } }, inCar: true, activeVehicleId: "d1", keys: { "KeyW": true } });
    const mesh = makeMesh({ type: "drone" });
    state.vehicleMeshes.set("d1", mesh);
    mesh.rotation.x = 0;
    mountVehicleRenderTick().tick(0.016, state);
    expect(mesh.rotation.x).toBeLessThan(0); // forward tilt is negative x
  });
});

describe("vehicle_render_tick — mech behavior", () => {
  it("mech visible = true", () => {
    const vDefs = [{ id: "m1", type: "mech" }];
    const state = makeState({ vehicleDefs: vDefs, states: { m1: { heading: 0, speed: 2 } } });
    mountVehicleRenderTick().tick(0.016, state);
    expect(state.vehicleMeshes.get("m1").visible).toBe(true);
  });

  it("mech legs swing when speed > 0", () => {
    const vDefs = [{ id: "m1", type: "mech" }];
    const state = makeState({ vehicleDefs: vDefs, states: { m1: { heading: 0, speed: 3 } } });
    mountVehicleRenderTick().tick(0.5, state); // larger dt to get visible swing
    const legs = state.vehicleMeshes.get("m1")._legs;
    expect(Math.abs(legs[0].thighM.rotation.x) + Math.abs(legs[1].thighM.rotation.x)).toBeGreaterThan(0);
  });

  it("mech legs swing in opposition", () => {
    const vDefs = [{ id: "m1", type: "mech" }];
    const state = makeState({ vehicleDefs: vDefs, states: { m1: { heading: 0, speed: 5 } } });
    mountVehicleRenderTick().tick(0.1, state);
    const legs = state.vehicleMeshes.get("m1")._legs;
    // leg0 and leg1 should be opposite sign
    expect(legs[0].thighM.rotation.x * legs[1].thighM.rotation.x).toBeLessThanOrEqual(0);
  });
});

describe("vehicle_render_tick — empty / fuzz", () => {
  it("empty vehicleDefs → no throw", () => {
    const state = makeState({ vehicleDefs: [] });
    expect(() => mountVehicleRenderTick().tick(0.016, state)).not.toThrow();
  });

  it("never throws for 20 random vehicle states", () => {
    const types = ["car", "drone", "mech", "bike"];
    for (let i = 0; i < 20; i++) {
      const vDefs = Array.from({ length: Math.floor(Math.random() * 4) }, (_, j) => ({
        id: `v${j}`, type: types[Math.floor(Math.random() * types.length)],
      }));
      const states = {};
      for (const v of vDefs) states[v.id] = { heading: Math.random() * 6, speed: (Math.random() - 0.5) * 10 };
      const state = makeState({ vehicleDefs: vDefs, states, inCar: Math.random() > 0.5, activeVehicleId: vDefs[0]?.id || null, keys: { "KeyW": Math.random() > 0.5, "KeyS": Math.random() > 0.5, "KeyA": Math.random() > 0.5, "KeyD": Math.random() > 0.5 } });
      expect(() => mountVehicleRenderTick().tick(0.016, state)).not.toThrow();
    }
  });
});
