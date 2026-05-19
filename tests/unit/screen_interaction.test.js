import { describe, expect, it, vi } from "vitest";
import { mountScreenInteraction } from "../../src/systems/screen_interaction.js";

function makeTHREE() {
  return {
    Raycaster: vi.fn(function() { this.setFromCamera = vi.fn(); }),
    Vector2: vi.fn(function(x, y) { this.x = x; this.y = y; }),
  };
}

function makeScreen(overrides = {}) {
  return { widthM: 2, heightM: 1.5, resolutionW: 800, resolutionH: 480, ...overrides };
}

function makeState(overrides = {}) {
  return {
    worldScreens: null,
    camera: {},
    mouseMode: false,
    activeMouseScreen: null,
    mouseModeCursorX: 0,
    mouseModeCursorY: 0,
    ...overrides,
  };
}

function makeSys({ sm = null, state = makeState() } = {}) {
  const sys = mountScreenInteraction({
    THREE: makeTHREE(),
    getScreenMesh: () => sm,
    get: {
      worldScreens: () => state.worldScreens,
      camera: () => state.camera,
      mouseMode: () => state.mouseMode,
    },
    set: {
      activeMouseScreen: v => { state.activeMouseScreen = v; },
      mouseMode: v => { state.mouseMode = v; },
      mouseModeCursorX: v => { state.mouseModeCursorX = v; },
      mouseModeCursorY: v => { state.mouseModeCursorY = v; },
    },
  });
  return { sys, state };
}

describe("mountScreenInteraction", () => {
  it("returns false when ScreenMesh is not available", () => {
    const { sys } = makeSys({ sm: null });
    expect(sys.tryClickWorldScreen()).toBe(false);
  });

  it("returns false when worldScreens is empty", () => {
    const sm = { pickScreen: vi.fn(), hitTest: vi.fn() };
    const { sys } = makeSys({ sm, state: makeState({ worldScreens: new Map() }) });
    expect(sys.tryClickWorldScreen()).toBe(false);
  });

  it("returns false when raycast hits nothing", () => {
    const screen = makeScreen();
    const screens = new Map([["s1", { mesh: {}, screen }]]);
    const sm = { pickScreen: vi.fn(() => null), hitTest: vi.fn() };
    const { sys } = makeSys({ sm, state: makeState({ worldScreens: screens }) });
    expect(sys.tryClickWorldScreen()).toBe(false);
  });

  it("range limit is exactly 50m — rejects hit at distance > 50", () => {
    const screen = makeScreen();
    const screens = new Map([["s1", { mesh: {}, screen }]]);
    const sm = { pickScreen: vi.fn(() => ({ screen, distance: 51, uv: { x: 0.5, y: 0.5 } })), hitTest: vi.fn() };
    const { sys } = makeSys({ sm, state: makeState({ worldScreens: screens }) });
    expect(sys.tryClickWorldScreen()).toBe(false);
  });

  it("accepts hit at distance exactly 50", () => {
    const screen = makeScreen();
    const onClick = vi.fn();
    const region = { onClick };
    const screens = new Map([["s1", { mesh: {}, screen }]]);
    const sm = {
      pickScreen: vi.fn(() => ({ screen, distance: 50, uv: { x: 0.5, y: 0.5 } })),
      hitTest: vi.fn(() => region),
    };
    const { sys } = makeSys({ sm, state: makeState({ worldScreens: screens }) });
    expect(sys.tryClickWorldScreen()).toBe(true);
    expect(onClick).toHaveBeenCalledWith(screen);
  });

  it("big screen threshold is exactly 5m wide — enters mouse mode at widthM >= 5", () => {
    const screen = makeScreen({ widthM: 5 });
    const screens = new Map([["s1", { mesh: {}, screen }]]);
    const sm = { pickScreen: vi.fn(() => ({ screen, distance: 10, uv: { x: 0.5, y: 0.5 } })), hitTest: vi.fn() };
    const state = makeState({ worldScreens: screens, mouseMode: false });
    const { sys } = makeSys({ sm, state });
    const result = sys.tryClickWorldScreen();
    expect(result).toBe(true);
    expect(state.mouseMode).toBe(true);
    expect(state.activeMouseScreen).toBe(screen);
  });

  it("does not enter mouse mode for screen narrower than 5m", () => {
    const screen = makeScreen({ widthM: 4.99 });
    const onClick = vi.fn();
    const screens = new Map([["s1", { mesh: {}, screen }]]);
    const sm = {
      pickScreen: vi.fn(() => ({ screen, distance: 10, uv: { x: 0.5, y: 0.5 } })),
      hitTest: vi.fn(() => ({ onClick })),
    };
    const state = makeState({ worldScreens: screens });
    const { sys } = makeSys({ sm, state });
    sys.tryClickWorldScreen();
    expect(state.mouseMode).toBe(false);
    expect(onClick).toHaveBeenCalled();
  });

  it("enterScreenMouseMode seeds cursor at UV*resolution and sets mouseMode true", () => {
    const screen = makeScreen({ resolutionW: 800, resolutionH: 480 });
    const state = makeState();
    const { sys } = makeSys({ state });
    sys.enterScreenMouseMode(screen, { x: 0.25, y: 0.75 });
    expect(state.mouseMode).toBe(true);
    expect(state.activeMouseScreen).toBe(screen);
    expect(state.mouseModeCursorX).toBe(200);   // 0.25 * 800
    expect(state.mouseModeCursorY).toBe(120);   // (1 - 0.75) * 480
  });

  it("enterScreenMouseMode with null uv defaults cursor to center 0.5", () => {
    const screen = makeScreen({ resolutionW: 800, resolutionH: 480 });
    const state = makeState();
    const { sys } = makeSys({ state });
    sys.enterScreenMouseMode(screen, null);
    expect(state.mouseModeCursorX).toBe(400);   // 0.5 * 800
    expect(state.mouseModeCursorY).toBe(240);   // 0.5 * 480
  });

  it("exitScreenMouseMode clears activeMouseScreen and sets mouseMode false", () => {
    const screen = makeScreen();
    const state = makeState({ activeMouseScreen: screen, mouseMode: true });
    const { sys } = makeSys({ state });
    sys.exitScreenMouseMode();
    expect(state.mouseMode).toBe(false);
    expect(state.activeMouseScreen).toBeNull();
  });
});
