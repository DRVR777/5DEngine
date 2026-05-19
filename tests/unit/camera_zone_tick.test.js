import { it, expect, describe } from "vitest";
import { mountCameraZoneTick } from "../../src/systems/camera_zone_tick.js";

function makeSpine(zone, heroVisible = true) {
  return { zone, params: { heroVisible } };
}

function makeActions({ spine = null, isDrone = false, heroLog = [], shadowLog = [], fpLog = [] } = {}) {
  return {
    evaluateSpine:        (_zoom, _max) => spine,
    isActiveDrone:        (_inCar) => isDrone,
    setHeroGroupVisible:  (v) => heroLog.push(v),
    setShadowBlobVisible: (v) => shadowLog.push(v),
    setFpGunGroupVisible: (v) => fpLog.push(v),
  };
}

function makeGet({ camDist = 4, aimAmt = 0, camDistMax = 10 } = {}) {
  return { camDist: () => camDist, aimAmt: () => aimAmt, camDistMax: () => camDistMax };
}

const BASE = { buildMode: false, inCar: false, computerOpen: false, heroDead: false };

describe("camera_zone_tick — dist computation", () => {
  it("not inCar → dist = camDist * (1 - 0.4*aimAmt)", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 4, aimAmt: 0.5 }), actions: makeActions() });
    const { dist } = sys.tick(0.016, BASE);
    expect(dist).toBeCloseTo(4 * (1 - 0.4 * 0.5)); // 4 * 0.8 = 3.2
  });

  it("inCar + camDist=2 → dist = max(2, 6) = 6", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 2 }), actions: makeActions() });
    const { dist } = sys.tick(0.016, { ...BASE, inCar: true });
    expect(dist).toBe(6);
  });

  it("inCar + camDist=8 → dist = max(8, 6) = 8", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 8 }), actions: makeActions() });
    const { dist } = sys.tick(0.016, { ...BASE, inCar: true });
    expect(dist).toBe(8);
  });
});

describe("camera_zone_tick — firstPerson", () => {
  it("dist < 0.5 → firstPerson true", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 0.3 }), actions: makeActions() });
    const { firstPerson } = sys.tick(0.016, BASE);
    expect(firstPerson).toBe(true);
  });

  it("dist >= 0.5 + no FP spine zone → firstPerson false", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ spine: makeSpine("THIRD_PERSON") }) });
    const { firstPerson } = sys.tick(0.016, BASE);
    expect(firstPerson).toBe(false);
  });

  it("spine zone FIRST_PERSON → firstPerson true", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ spine: makeSpine("FIRST_PERSON") }) });
    const { firstPerson } = sys.tick(0.016, BASE);
    expect(firstPerson).toBe(true);
  });

  it("spine zone INSIDE → firstPerson true", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ spine: makeSpine("INSIDE") }) });
    const { firstPerson } = sys.tick(0.016, BASE);
    expect(firstPerson).toBe(true);
  });

  it("inCar → firstPerson always false", () => {
    const sys = mountCameraZoneTick({ get: makeGet({ camDist: 0 }), actions: makeActions({ spine: makeSpine("FIRST_PERSON") }) });
    const { firstPerson } = sys.tick(0.016, { ...BASE, inCar: true });
    expect(firstPerson).toBe(false);
  });
});

describe("camera_zone_tick — hero visibility", () => {
  it("buildMode → hero visible", () => {
    const heroLog = [];
    mountCameraZoneTick({ get: makeGet(), actions: makeActions({ heroLog }) })
      .tick(0.016, { ...BASE, buildMode: true });
    expect(heroLog[0]).toBe(true);
  });

  it("firstPerson + no spine → hero hidden", () => {
    const heroLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 0.1 }), actions: makeActions({ heroLog }) })
      .tick(0.016, BASE);
    expect(heroLog[0]).toBe(false);
  });

  it("isDrone → hero hidden (even if not firstPerson)", () => {
    const heroLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ isDrone: true, heroLog }) })
      .tick(0.016, { ...BASE, inCar: true });
    expect(heroLog[0]).toBe(false);
  });

  it("spine heroVisible=true + third-person → hero visible", () => {
    const heroLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ spine: makeSpine("THIRD_PERSON", true), heroLog }) })
      .tick(0.016, BASE);
    expect(heroLog[0]).toBe(true);
  });
});

describe("camera_zone_tick — shadow + fpGun visibility", () => {
  it("firstPerson → shadow hidden", () => {
    const shadowLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 0.1 }), actions: makeActions({ shadowLog }) })
      .tick(0.016, BASE);
    expect(shadowLog[0]).toBe(false);
  });

  it("third-person + not inCar + not buildMode → shadow visible", () => {
    const shadowLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 4 }), actions: makeActions({ shadowLog }) })
      .tick(0.016, BASE);
    expect(shadowLog[0]).toBe(true);
  });

  it("firstPerson + not buildMode + not inCar + not dead → fpGunActive=true", () => {
    const fpLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 0.1 }), actions: makeActions({ fpLog }) })
      .tick(0.016, BASE);
    expect(fpLog[0]).toBe(true);
  });

  it("computerOpen → fpGunActive=false", () => {
    const fpLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 0.1 }), actions: makeActions({ fpLog }) })
      .tick(0.016, { ...BASE, computerOpen: true });
    expect(fpLog[0]).toBe(false);
  });

  it("heroDead → fpGunActive=false", () => {
    const fpLog = [];
    mountCameraZoneTick({ get: makeGet({ camDist: 0.1 }), actions: makeActions({ fpLog }) })
      .tick(0.016, { ...BASE, heroDead: true });
    expect(fpLog[0]).toBe(false);
  });
});
