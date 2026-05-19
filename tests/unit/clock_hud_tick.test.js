import { it, expect, describe } from "vitest";
import { mountClockHudTick } from "../../src/systems/clock_hud_tick.js";

function makeEl() {
  return { textContent: "", style: { color: "" } };
}
function makeTick(dayNightHour = null) {
  const { tick } = mountClockHudTick({ actions: { getDayNightHour: () => dayNightHour } });
  return tick;
}

describe("clock_hud_tick — null safety", () => {
  it("does not throw when el is null", () => {
    const tick = makeTick(12);
    expect(() => tick(0, 0.5, null)).not.toThrow();
  });
});

describe("clock_hud_tick — DayNight module path (hour provided)", () => {
  it("formats noon as 12:00 PM", () => {
    const el = makeEl();
    makeTick(12)(0, 0.5, el);
    expect(el.textContent).toMatch(/12:00 PM/);
  });

  it("formats midnight as 12:00 AM", () => {
    const el = makeEl();
    makeTick(0)(0, 0.5, el);
    expect(el.textContent).toMatch(/12:00 AM/);
  });

  it("formats 6:30 AM correctly", () => {
    const el = makeEl();
    makeTick(6.5)(0, 0.5, el);
    expect(el.textContent).toMatch(/06:30 AM/);
  });

  it("formats 18:45 as 06:45 PM", () => {
    const el = makeEl();
    makeTick(18.75)(0, 0.5, el);
    expect(el.textContent).toMatch(/06:45 PM/);
  });

  it("shows sun icon at hour=12 (dayMix near max)", () => {
    const el = makeEl();
    makeTick(12)(0, 0, el);
    // At noon dayMix = 1 - |12 - 12.5| / 6.5 = ~0.923
    expect(el.textContent).toMatch(/☀/);
  });

  it("shows moon icon at hour=0 (night)", () => {
    const el = makeEl();
    makeTick(0)(0, 0, el);
    // Hour 0 is outside [6,19) so dayMix = 0
    expect(el.textContent).toMatch(/🌙/);
  });

  it("applies gold color during day (dayMix > 0.5)", () => {
    const el = makeEl();
    makeTick(12)(0, 0, el);
    expect(el.style.color).toBe("#ffd166");
  });

  it("applies blue color during night (dayMix <= 0.5)", () => {
    const el = makeEl();
    makeTick(0)(0, 0, el);
    expect(el.style.color).toBe("#6699cc");
  });
});

describe("clock_hud_tick — fallback path (no DayNight module)", () => {
  it("derives time from 'now' when getDayNightHour returns null", () => {
    const el = makeEl();
    const tick = makeTick(null);
    // now=0: dayFrac=0, gameH=0, gameM=0 → 12:00 AM
    tick(0, 0, el);
    expect(el.textContent).toMatch(/12:00 AM/);
  });

  it("uses dayMixFallback for color when DayNight unavailable", () => {
    const el = makeEl();
    const tick = makeTick(null);
    tick(0, 1.0, el); // dayMixFallback = 1.0 → gold
    expect(el.style.color).toBe("#ffd166");

    const el2 = makeEl();
    tick(0, 0.0, el2); // dayMixFallback = 0.0 → blue
    expect(el2.style.color).toBe("#6699cc");
  });

  it("advances time as now increases", () => {
    const el1 = makeEl();
    const el2 = makeEl();
    const tick = makeTick(null);
    tick(0, 0, el1);             // midnight
    tick(30_000, 0, el2);        // 30s = half of 60s day → noon
    expect(el1.textContent).not.toBe(el2.textContent);
  });
});
