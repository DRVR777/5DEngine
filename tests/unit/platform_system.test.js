import { it, expect, describe } from "vitest";
import { mountPlatformSystem } from "../../src/systems/platform_system.js";

function makeVehicle(id, { u = 0, v = 0, hitbox } = {}) {
  return { id, pos: { u, v }, hitbox };
}

describe("platform_system — getSupport before any tick", () => {
  it("returns ground (topY=0) when no vehicles loaded", () => {
    const sys = mountPlatformSystem();
    expect(sys.getSupport(0, 0, 0).topY).toBe(0);
    expect(sys.getSupport(0, 0, 0).label).toBe("ground");
  });
});

describe("platform_system — dirty flag", () => {
  it("starts dirty — first tick always rebuilds cache", () => {
    const sys = mountPlatformSystem();
    const veh = makeVehicle("car1", { u: 0, v: 0 });
    sys.tick(0.016, { vehicles: [veh] });
    // After tick: hero standing on roof of car at u=0,v=0
    const sup = sys.getSupport(0, 0, 1.41);
    expect(sup.topY).toBeGreaterThan(0);
  });

  it("cache not rebuilt when clean (markDirty not called)", () => {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [makeVehicle("car1", { u: 0, v: 0 })] });
    // Now clean — second tick with empty vehicles should NOT clear cache
    sys.tick(0.016, { vehicles: [] });
    const sup = sys.getSupport(0, 0, 1.41);
    expect(sup.topY).toBeGreaterThan(0); // still has car1 platforms
  });

  it("markDirty forces rebuild on next tick", () => {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [makeVehicle("car1", { u: 0, v: 0 })] });
    sys.markDirty();
    sys.tick(0.016, { vehicles: [] }); // rebuild with no vehicles
    const sup = sys.getSupport(0, 0, 1.41);
    expect(sup.topY).toBe(0); // cache cleared
  });
});

describe("platform_system — getSupport hit/miss", () => {
  function buildSys(vehU = 0, vehV = 0, hitbox) {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [makeVehicle("v1", { u: vehU, v: vehV, hitbox })] });
    return sys;
  }

  it("hero directly on top of car at low Y → returns hood topY=0.9", () => {
    const sys = buildSys(0, 0);
    const sup = sys.getSupport(0, 0, 0.9);
    expect(sup.topY).toBe(0.9);
    expect(sup.label).toBe("v1_hood");
  });

  it("hero on roof surface → returns roof topY=1.4", () => {
    const sys = buildSys(0, 0);
    // roof: v = v + d*0.1, halfD = vd*0.4/2; with default vd=4: v=0.4, halfD=0.8
    const sup = sys.getSupport(0, 0.4, 1.4);
    expect(sup.topY).toBe(1.4);
    expect(sup.label).toBe("v1_roof");
  });

  it("hero above the platform ceiling cutoff (currentY + 0.3 < topY) → skipped", () => {
    const sys = buildSys(0, 0);
    // currentY = 0, topY = 0.9, condition: topY > currentY + 0.3 → 0.9 > 0.3 → skipped
    const sup = sys.getSupport(0, 0, 0);
    expect(sup.topY).toBe(0); // can't pop up through platform
  });

  it("hero outside platform footprint → returns ground", () => {
    const sys = buildSys(0, 0);
    // car at u=0 v=0, very far hero
    const sup = sys.getSupport(100, 100, 1.41);
    expect(sup.topY).toBe(0);
    expect(sup.label).toBe("ground");
  });

  it("custom hitbox dimensions used", () => {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [makeVehicle("truck", { u: 0, v: 0, hitbox: { w: 4, d: 8 } })] });
    // hood: w = 4*0.8=3.2, d = 8*0.5=4; halfW=1.6, halfD=2
    const sup = sys.getSupport(0, 0, 0.9);
    expect(sup.topY).toBe(0.9);
  });

  it("vehicle with no pos → skipped, no crash", () => {
    const sys = mountPlatformSystem();
    expect(() => sys.tick(0.016, { vehicles: [{ id: "ghost", pos: null }] })).not.toThrow();
  });
});

describe("platform_system — multiple vehicles", () => {
  it("two vehicles → hero on whichever platform it's standing on", () => {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [
      makeVehicle("car1", { u: 0, v: 0 }),
      makeVehicle("car2", { u: 10, v: 0 }),
    ]});
    const sup1 = sys.getSupport(0, 0, 0.9);
    const sup2 = sys.getSupport(10, 0, 0.9);
    expect(sup1.topY).toBe(0.9);
    expect(sup2.topY).toBe(0.9);
  });

  it("empty vehicles array → all ground", () => {
    const sys = mountPlatformSystem();
    sys.tick(0.016, { vehicles: [] });
    expect(sys.getSupport(0, 0, 5).topY).toBe(0);
  });
});

describe("platform_system — fuzz", () => {
  it("never throws for 25 random hero/vehicle combinations", () => {
    for (let i = 0; i < 25; i++) {
      const sys = mountPlatformSystem();
      const vehicles = Array.from({ length: Math.floor(Math.random() * 4) }, (_, j) => ({
        id: `v${j}`, pos: Math.random() > 0.1 ? { u: Math.random() * 10, v: Math.random() * 10 } : null,
        hitbox: Math.random() > 0.5 ? { w: Math.random() * 4 + 1, d: Math.random() * 6 + 2 } : undefined,
      }));
      sys.tick(0.016, { vehicles });
      expect(() => sys.getSupport(Math.random() * 10, Math.random() * 10, Math.random() * 3)).not.toThrow();
    }
  });
});
