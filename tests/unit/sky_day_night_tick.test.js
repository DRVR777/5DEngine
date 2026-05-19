import { it, expect, describe } from "vitest";
import { mountSkyDayNightTick } from "../../src/render/sky_day_night_tick.js";

function makeLog() {
  const calls = {};
  const actions = {
    setTopColor:     (r, g, b) => { calls.top    = [r, g, b]; },
    setBottomColor:  (r, g, b) => { calls.bottom = [r, g, b]; },
    setFogColor:     (r, g, b) => { calls.fog    = [r, g, b]; },
    setSunPos:       (x, y, z) => { calls.sunPos = [x, y, z]; },
    setSunIntensity: (v)       => { calls.sunInt = v; },
  };
  return { calls, actions };
}

function makeDn({ dayMix = 1, sunX = 0, sunY = 0.8, sunZ = 0, skyR = 0.5, skyG = 0.6, skyB = 0.8 } = {}) {
  return { dayMix, sun: { x: sunX, y: sunY, z: sunZ }, sky: { r: skyR, g: skyG, b: skyB } };
}

describe("sky_day_night_tick — sun intensity", () => {
  it("sun intensity = 0.3 at night (dayMix=0)", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 0, sunY: 0.8 }));
    expect(calls.sunInt).toBeCloseTo(0.3);
  });

  it("sun intensity = 1.3 at full day (dayMix=1)", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 1, sunY: 0.8 }));
    expect(calls.sunInt).toBeCloseTo(1.3);
  });

  it("sun intensity scales linearly with dayMix", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 0.5, sunY: 0.8 }));
    expect(calls.sunInt).toBeCloseTo(0.8);
  });
});

describe("sky_day_night_tick — sun position", () => {
  it("sun position is scaled x30", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ sunX: 1, sunY: 0.8, sunZ: 0.5 }));
    expect(calls.sunPos[0]).toBeCloseTo(30);
    expect(calls.sunPos[2]).toBeCloseTo(15);
  });

  it("sun Y position clamped to minimum 2", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ sunY: 0 })); // 0 * 30 = 0 → clamp to 2
    expect(calls.sunPos[1]).toBe(2);
  });

  it("sun Y position not clamped when above 2", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ sunY: 0.5 })); // 0.5 * 30 = 15
    expect(calls.sunPos[1]).toBeCloseTo(15);
  });
});

describe("sky_day_night_tick — fog color", () => {
  it("fog color matches sky rgb from dn", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ skyR: 0.2, skyG: 0.4, skyB: 0.9 }));
    expect(calls.fog[0]).toBeCloseTo(0.2);
    expect(calls.fog[1]).toBeCloseTo(0.4);
    expect(calls.fog[2]).toBeCloseTo(0.9);
  });
});

describe("sky_day_night_tick — sunset mix", () => {
  it("sunsetMix is 0 when sun.y >= 0.3", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 0, sunY: 0.5 }));
    // no sunset: topColor at full night = base values
    expect(calls.top[0]).toBeCloseTo(0.05);
    expect(calls.top[1]).toBeCloseTo(0.07);
  });

  it("sunsetMix > 0 when sun.y close to 0", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    // sun.y = 0.1 < 0.3, abs(0.1)*5=0.5, 1-0.5=0.5 → sunsetMix=0.5
    tick(makeDn({ dayMix: 0, sunY: 0.1 }));
    expect(calls.top[0]).toBeGreaterThan(0.05); // 0.05 + 0.4*0.5 = 0.25
  });

  it("sunsetMix is 0 for negative sun.y (underground)", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    // sun.y = -0.1 → abs = 0.1, 1-0.5=0.5, but -0.1 < 0.3 so multiply 0.5 * 1
    // Actually sun.y = -0.5 → abs=0.5, 1-2.5 = -1.5 → max(0,-1.5) = 0
    tick(makeDn({ dayMix: 0, sunY: -0.5 }));
    expect(calls.top[0]).toBeCloseTo(0.05); // no sunset contribution
  });
});

describe("sky_day_night_tick — top/bottom colors at full day", () => {
  it("top color R at full day (dayMix=1, no sunset)", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 1, sunY: 0.8 })); // sunY>=0.3 → sunsetMix=0
    expect(calls.top[0]).toBeCloseTo(0.05 + 0.48);
    expect(calls.top[1]).toBeCloseTo(0.07 + 0.73);
    expect(calls.top[2]).toBeCloseTo(0.18 + 0.74);
  });

  it("bottom color at full day (dayMix=1, no sunset)", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    tick(makeDn({ dayMix: 1, sunY: 0.8 }));
    expect(calls.bottom[0]).toBeCloseTo(0.10 + 0.85);
    expect(calls.bottom[1]).toBeCloseTo(0.15 + 0.70);
    expect(calls.bottom[2]).toBeCloseTo(0.30 + 0.50);
  });
});

describe("sky_day_night_tick — fuzz", () => {
  it("never throws for 20 random day-night states", () => {
    const { calls, actions } = makeLog();
    const { tick } = mountSkyDayNightTick({ actions });
    for (let i = 0; i < 20; i++) {
      const dn = makeDn({
        dayMix: Math.random(),
        sunX: (Math.random() - 0.5) * 2,
        sunY: (Math.random() - 0.5) * 2,
        sunZ: (Math.random() - 0.5) * 2,
        skyR: Math.random(), skyG: Math.random(), skyB: Math.random(),
      });
      expect(() => tick(dn)).not.toThrow();
      expect(calls.sunInt).toBeGreaterThanOrEqual(0);
    }
  });
});
