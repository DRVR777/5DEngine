import { it, expect, describe } from "vitest";
import { mountScopeFovTick } from "../../src/systems/scope_fov_tick.js";

function makeScope({ aimAmt = 0, sprintFovAmt = 0, wasSniperScope = false, sniperSavedCamDist = 7, camDist = 7 } = {}) {
  const s = { aimAmt, sprintFovAmt, wasSniperScope, sniperSavedCamDist, camDist };
  const fovLog = [];
  const get = {
    aimAmt:            () => s.aimAmt,
    sprintFovAmt:      () => s.sprintFovAmt,
    wasSniperScope:    () => s.wasSniperScope,
    sniperSavedCamDist:() => s.sniperSavedCamDist,
    camDist:           () => s.camDist,
  };
  const set = {
    aimAmt:            v => { s.aimAmt = v; },
    sprintFovAmt:      v => { s.sprintFovAmt = v; },
    wasSniperScope:    v => { s.wasSniperScope = v; },
    sniperSavedCamDist:v => { s.sniperSavedCamDist = v; },
    camDist:           v => { s.camDist = v; },
  };
  const actions = {
    setFov: fov => { fovLog.push(fov); },
    updateProjectionMatrix: () => {},
  };
  const { tick } = mountScopeFovTick({ get, set, actions });
  return { s, fovLog, tick };
}

const BASE = { aiming: false, computerOpen: false, computerEntering: false, isSprinting: false,
               heroDead: false, buildMode: false, inCar: false, currentWeaponId: "pistol" };

describe("scope_fov_tick — aim spring", () => {
  it("aimAmt springs toward 1 when aiming", () => {
    const { s, tick } = makeScope({ aimAmt: 0 });
    tick(0.016, { ...BASE, aiming: true });
    expect(s.aimAmt).toBeGreaterThan(0);
    expect(s.aimAmt).toBeLessThan(1);
  });

  it("aimAmt springs toward 0 when not aiming", () => {
    const { s, tick } = makeScope({ aimAmt: 1 });
    tick(0.016, { ...BASE, aiming: false });
    expect(s.aimAmt).toBeGreaterThan(0); // not instant
    expect(s.aimAmt).toBeLessThan(1);
  });

  it("aimAmt does not update when computerOpen even if aiming", () => {
    const { s, tick } = makeScope({ aimAmt: 0 });
    tick(0.016, { ...BASE, aiming: true, computerOpen: true });
    expect(s.aimAmt).toBeCloseTo(0); // target is 0 (computer blocks aim)
  });
});

describe("scope_fov_tick — sprint FOV spring", () => {
  it("sprintFovAmt springs toward 1 while sprinting normally", () => {
    const { s, tick } = makeScope({ sprintFovAmt: 0 });
    tick(0.016, { ...BASE, isSprinting: true });
    expect(s.sprintFovAmt).toBeGreaterThan(0);
  });

  it("sprintFovAmt does not increase when aiming+sprinting", () => {
    const { s, tick } = makeScope({ sprintFovAmt: 0 });
    tick(0.016, { ...BASE, isSprinting: true, aiming: true });
    expect(s.sprintFovAmt).toBeCloseTo(0); // target=0 when aiming
  });

  it("sprintFovAmt blocked when heroDead", () => {
    const { s, tick } = makeScope({ sprintFovAmt: 0 });
    tick(0.016, { ...BASE, isSprinting: true, heroDead: true });
    expect(s.sprintFovAmt).toBeCloseTo(0);
  });
});

describe("scope_fov_tick — sniper scope", () => {
  it("returns isSniperScope=true when aiming with sniper, not buildMode", () => {
    const { tick } = makeScope();
    const { isSniperScope } = tick(0.016, { ...BASE, aiming: true, currentWeaponId: "sniper" });
    expect(isSniperScope).toBe(true);
  });

  it("returns isSniperScope=false when aiming with pistol", () => {
    const { tick } = makeScope();
    const { isSniperScope } = tick(0.016, { ...BASE, aiming: true, currentWeaponId: "pistol" });
    expect(isSniperScope).toBe(false);
  });

  it("entering scope saves camDist and snaps to 0.01", () => {
    const { s, tick } = makeScope({ camDist: 5, wasSniperScope: false });
    tick(0.016, { ...BASE, aiming: true, currentWeaponId: "sniper" });
    expect(s.sniperSavedCamDist).toBeCloseTo(5);
    expect(s.camDist).toBeCloseTo(0.01);
  });

  it("exiting scope restores saved camDist", () => {
    const { s, tick } = makeScope({ camDist: 0.01, wasSniperScope: true, sniperSavedCamDist: 5 });
    tick(0.016, { ...BASE, aiming: false, currentWeaponId: "sniper" });
    expect(s.camDist).toBeCloseTo(5);
  });

  it("scope blocked in buildMode", () => {
    const { tick } = makeScope();
    const { isSniperScope } = tick(0.016, { ...BASE, aiming: true, currentWeaponId: "sniper", buildMode: true });
    expect(isSniperScope).toBe(false);
  });
});

describe("scope_fov_tick — FOV output", () => {
  it("FOV = 20 when sniperScope active", () => {
    const { fovLog, tick } = makeScope({ sprintFovAmt: 0 });
    tick(0.016, { ...BASE, aiming: true, currentWeaponId: "sniper" });
    expect(fovLog[0]).toBe(20);
  });

  it("FOV = 60 when not sprinting and not scoped", () => {
    const { fovLog, tick } = makeScope({ sprintFovAmt: 0 });
    tick(0.016, BASE);
    expect(fovLog[0]).toBeCloseTo(60);
  });

  it("FOV > 60 when sprintFovAmt > 0", () => {
    const { fovLog, tick } = makeScope({ sprintFovAmt: 1 });
    tick(0.016, BASE);
    expect(fovLog[0]).toBeGreaterThan(60); // 60 + sprintFovAmt*8 (spring still > 0)
  });
});

describe("scope_fov_tick — fuzz", () => {
  it("never throws for 25 random inputs", () => {
    for (let i = 0; i < 25; i++) {
      const { tick } = makeScope({
        aimAmt: Math.random(), sprintFovAmt: Math.random(),
        wasSniperScope: Math.random() > 0.5, camDist: Math.random() * 10,
      });
      expect(() => tick(0.016, {
        aiming: Math.random() > 0.5, computerOpen: Math.random() > 0.7,
        computerEntering: Math.random() > 0.9, isSprinting: Math.random() > 0.5,
        heroDead: Math.random() > 0.8, buildMode: Math.random() > 0.9,
        inCar: Math.random() > 0.8, currentWeaponId: Math.random() > 0.5 ? "sniper" : "pistol",
      })).not.toThrow();
    }
  });
});
