import { it, expect, describe } from "vitest";
import { mountVehicleDashTick } from "../../src/systems/vehicle_dash_tick.js";

const { tick } = mountVehicleDashTick();

function makeEl() { return { style: { display: "", color: "" }, textContent: "" }; }
const NULL_ELS = { vehicleDash: null, vdSpeed: null, vdGear: null };

function makeVState({ speed = 0, gearName = "D", altY = 0 } = {}) {
  return { speed, gearName, altY };
}

describe("vehicle_dash_tick — null safety", () => {
  it("does not throw when vehicleDash is null", () => {
    expect(() => tick(true, makeVState(), false, NULL_ELS)).not.toThrow();
  });

  it("does not throw when vdSpeed and vdGear are null", () => {
    const dash = makeEl();
    expect(() => tick(true, makeVState(), false, { vehicleDash: dash, vdSpeed: null, vdGear: null })).not.toThrow();
  });

  it("does not throw when vState is null", () => {
    const dash = makeEl();
    expect(() => tick(true, null, false, { vehicleDash: dash, vdSpeed: null, vdGear: null })).not.toThrow();
  });
});

describe("vehicle_dash_tick — visibility", () => {
  it("shows dash when active", () => {
    const dash = makeEl();
    tick(true, makeVState(), false, { vehicleDash: dash, vdSpeed: null, vdGear: null });
    expect(dash.style.display).toBe("block");
  });

  it("hides dash when not active", () => {
    const dash = makeEl();
    tick(false, makeVState(), false, { vehicleDash: dash, vdSpeed: null, vdGear: null });
    expect(dash.style.display).toBe("none");
  });
});

describe("vehicle_dash_tick — car mode", () => {
  it("speed is formatted in km/h (without unit label in car mode)", () => {
    const dash = makeEl(), speed = makeEl();
    tick(true, makeVState({ speed: 27.78 }), false, { vehicleDash: dash, vdSpeed: speed, vdGear: null });
    expect(speed.textContent).toBe("100"); // 27.78 m/s * 3.6 ≈ 100
  });

  it("speed is '0' when vState is null", () => {
    const dash = makeEl(), speed = makeEl();
    tick(true, null, false, { vehicleDash: dash, vdSpeed: speed, vdGear: null });
    expect(speed.textContent).toBe("0");
  });

  it("speed is absolute value (negative for reverse)", () => {
    const dash = makeEl(), speed = makeEl();
    tick(true, makeVState({ speed: -10 }), false, { vehicleDash: dash, vdSpeed: speed, vdGear: null });
    expect(parseFloat(speed.textContent)).toBeGreaterThanOrEqual(0);
  });

  it("gear shows gearName", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ gearName: "D" }), false, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.textContent).toBe("D");
  });

  it("gear defaults to N when gearName missing", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ gearName: "" }), false, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.textContent).toBe("N");
  });

  it("gear defaults to N when vState is null", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, null, false, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.textContent).toBe("N");
  });

  it("reverse gear color is red", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ gearName: "R" }), false, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.style.color).toBe("#ff4466");
  });

  it("forward gear color is yellow", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ gearName: "D" }), false, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.style.color).toBe("#ffd166");
  });
});

describe("vehicle_dash_tick — drone mode", () => {
  it("speed includes 'km/h' label in drone mode", () => {
    const dash = makeEl(), speed = makeEl();
    tick(true, makeVState({ speed: 10 }), true, { vehicleDash: dash, vdSpeed: speed, vdGear: null });
    expect(speed.textContent).toMatch(/km\/h$/);
  });

  it("gear shows altitude in drone mode", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ altY: 5.5 }), true, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.textContent).toBe("ALT 5.5m");
  });

  it("gear altitude defaults to 0.0m when vState is null", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, null, true, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.textContent).toBe("ALT 0.0m");
  });

  it("drone gear color is cyan", () => {
    const dash = makeEl(), gear = makeEl();
    tick(true, makeVState({ altY: 3 }), true, { vehicleDash: dash, vdSpeed: null, vdGear: gear });
    expect(gear.style.color).toBe("#00bbff");
  });
});

describe("vehicle_dash_tick — fuzz", () => {
  it("never throws for 20 random active/inactive states", () => {
    const dash = makeEl(), speed = makeEl(), gear = makeEl();
    for (let i = 0; i < 20; i++) {
      const active = Math.random() > 0.5;
      const vState = Math.random() > 0.3 ? makeVState({ speed: (Math.random() - 0.5) * 200, gearName: ["D","R","N","P"][Math.floor(Math.random()*4)], altY: Math.random() * 100 }) : null;
      const isDrone = Math.random() > 0.5;
      expect(() => tick(active, vState, isDrone, { vehicleDash: dash, vdSpeed: speed, vdGear: gear })).not.toThrow();
    }
  });
});
