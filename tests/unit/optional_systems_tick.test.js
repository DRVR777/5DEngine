import { it, expect, describe, vi } from "vitest";
import { mountOptionalSystemsTick } from "../../src/systems/optional_systems_tick.js";

const HERO = { u: 5, v: 3, y: 0 };
const CAM  = {};

function makeActions(overrides = {}) {
  return {
    getTriggerZones:  () => null,
    getSoundZones:    () => null,
    getCutscene:      () => null,
    getAchievements:  () => null,
    getDayNight:      () => null,
    getStatusEffects: () => null,
    getWaveManager:   () => null,
    getHeroPos:       () => HERO,
    getEnemyPos:      (id) => ({ u: 10, v: 10 }),
    getCamera:        () => CAM,
    waveHudTick:      vi.fn(),
    ...overrides,
  };
}

const BASE = { enemies: [], performanceNow: 1000 };

describe("optional_systems_tick — TriggerZones", () => {
  it("getTriggerZones=null → tz.tick not called", () => {
    const actions = makeActions();
    const sys = mountOptionalSystemsTick({ actions });
    // no error = pass; tz.tick would throw if accidentally called
    expect(() => sys.tick(0.016, BASE)).not.toThrow();
  });

  it("getTriggerZones defined → tz.tick called with hero in ents", () => {
    const tz = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getTriggerZones: () => tz }) });
    sys.tick(0.016, BASE);
    expect(tz.tick).toHaveBeenCalledOnce();
    const [ents] = tz.tick.mock.calls[0];
    expect(ents[0]).toEqual({ id: "hero", u: 5, v: 3, y: 0 });
  });

  it("live enemies included in ents", () => {
    const tz = { tick: vi.fn() };
    const enemies = [{ id: "en1", dead: false }, { id: "en2", dead: false }];
    const getEnemyPos = id => ({ u: id === "en1" ? 1 : 2, v: 0 });
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getTriggerZones: () => tz, getEnemyPos }) });
    sys.tick(0.016, { enemies, performanceNow: 0 });
    const [ents] = tz.tick.mock.calls[0];
    expect(ents.length).toBe(3); // hero + 2 enemies
  });

  it("dead enemies excluded from ents", () => {
    const tz = { tick: vi.fn() };
    const enemies = [{ id: "en1", dead: true }];
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getTriggerZones: () => tz }) });
    sys.tick(0.016, { enemies, performanceNow: 0 });
    const [ents] = tz.tick.mock.calls[0];
    expect(ents.length).toBe(1); // hero only
  });

  it("enemy with null pos excluded from ents", () => {
    const tz = { tick: vi.fn() };
    const enemies = [{ id: "en1", dead: false }];
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getTriggerZones: () => tz, getEnemyPos: () => null }) });
    sys.tick(0.016, { enemies, performanceNow: 0 });
    const [ents] = tz.tick.mock.calls[0];
    expect(ents.length).toBe(1); // hero only
  });
});

describe("optional_systems_tick — SoundZones", () => {
  it("getSoundZones=null → no call", () => {
    const sys = mountOptionalSystemsTick({ actions: makeActions() });
    expect(() => sys.tick(0.016, BASE)).not.toThrow();
  });

  it("getSoundZones defined → tick(heroU, heroV)", () => {
    const sz = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getSoundZones: () => sz }) });
    sys.tick(0.016, BASE);
    expect(sz.tick).toHaveBeenCalledWith(HERO.u, HERO.v);
  });
});

describe("optional_systems_tick — Cutscene", () => {
  it("getCutscene=null → no call", () => {
    const sys = mountOptionalSystemsTick({ actions: makeActions() });
    expect(() => sys.tick(0.016, BASE)).not.toThrow();
  });

  it("getCutscene defined → tick(dt, camera)", () => {
    const cu = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getCutscene: () => cu }) });
    sys.tick(0.1, BASE);
    expect(cu.tick).toHaveBeenCalledWith(0.1, CAM);
  });
});

describe("optional_systems_tick — Achievements / DayNight / StatusEffects", () => {
  it("Achievements.tick called with dt", () => {
    const ach = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getAchievements: () => ach }) });
    sys.tick(0.05, BASE);
    expect(ach.tick).toHaveBeenCalledWith(0.05);
  });

  it("DayNight.tick called with dt", () => {
    const dn = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getDayNight: () => dn }) });
    sys.tick(0.05, BASE);
    expect(dn.tick).toHaveBeenCalledWith(0.05);
  });

  it("StatusEffects.tick called with dt", () => {
    const se = { tick: vi.fn() };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getStatusEffects: () => se }) });
    sys.tick(0.05, BASE);
    expect(se.tick).toHaveBeenCalledWith(0.05);
  });
});

describe("optional_systems_tick — WaveManager", () => {
  it("getWaveManager=null → waveHudTick not called", () => {
    const waveHudTick = vi.fn();
    const sys = mountOptionalSystemsTick({ actions: makeActions({ waveHudTick }) });
    sys.tick(0.016, BASE);
    expect(waveHudTick).not.toHaveBeenCalled();
  });

  it("getWaveManager defined → wm.tick called then waveHudTick called", () => {
    const waveHudTick = vi.fn();
    const wm = { tick: vi.fn(), getState: () => ({ phase: "waiting" }) };
    const sys = mountOptionalSystemsTick({ actions: makeActions({ getWaveManager: () => wm, waveHudTick }) });
    sys.tick(0.016, { enemies: [], performanceNow: 999 });
    expect(wm.tick).toHaveBeenCalledWith(0.016);
    expect(waveHudTick).toHaveBeenCalledWith(0.016, { phase: "waiting" }, 999);
  });
});
