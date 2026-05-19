import { it, expect, describe } from "vitest";
import { mountScreenMeshTick } from "../../src/systems/screen_mesh_tick.js";

function makeSM() {
  const calls = [];
  return {
    setState(sc, state) { calls.push({ type: "setState", sc, state }); },
    update(sc)          { calls.push({ type: "update", sc }); },
    _calls: calls,
  };
}

function makeCtx() {
  const ops = [];
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 0,
    fillRect(...a) { ops.push({ fn: "fillRect", args: a }); },
    beginPath()    { ops.push({ fn: "beginPath" }); },
    arc(...a)      { ops.push({ fn: "arc", args: a }); },
    stroke()       { ops.push({ fn: "stroke" }); },
    _ops: ops,
  };
}

function makeScreen() {
  const ctx = makeCtx();
  return { canvas: { getContext: () => ctx }, texture: { needsUpdate: false }, _ctx: ctx };
}

function makeActions({ SM = null, bcSc = null, bcMesh = null, hits = [], hoverLog = [] } = {}) {
  return {
    getScreenMesh:        () => SM,
    getBuildConsoleScreen:() => bcSc,
    getBuildConsoleMesh:  () => bcMesh,
    intersectMesh:        (_m) => hits,
    setHoverRegion:       (id) => hoverLog.push(id),
  };
}

const BASE = {
  buildMode: false, pointerLocked: false, mouseMode: false,
  spineZone: "THIRD_PERSON",
  jumbotronScreen: null, skyScreen: null, worldScreens: new Map(),
  activeMouseScreen: null, mouseModeCursor: { x: 100, y: 200 },
};

describe("screen_mesh_tick — null ScreenMesh", () => {
  it("returns early without throwing when getScreenMesh returns null", () => {
    const sys = mountScreenMeshTick({ actions: makeActions() });
    expect(() => sys.tick(0.016, BASE)).not.toThrow();
  });
});

describe("screen_mesh_tick — world screen updates", () => {
  it("jumbotronScreen → setState with spineZone + update", () => {
    const SM = makeSM();
    const jb = {};
    const sys = mountScreenMeshTick({ actions: makeActions({ SM }) });
    sys.tick(0.016, { ...BASE, jumbotronScreen: jb, spineZone: "FIRST_PERSON" });
    const setCall = SM._calls.find(c => c.type === "setState" && c.sc === jb);
    expect(setCall.state.spineZone).toBe("FIRST_PERSON");
    expect(SM._calls.some(c => c.type === "update" && c.sc === jb)).toBe(true);
  });

  it("skyScreen → update called", () => {
    const SM = makeSM();
    const sky = {};
    const sys = mountScreenMeshTick({ actions: makeActions({ SM }) });
    sys.tick(0.016, { ...BASE, skyScreen: sky });
    expect(SM._calls.some(c => c.type === "update" && c.sc === sky)).toBe(true);
  });

  it("worldScreens entry (not jb/sky) → update called", () => {
    const SM = makeSM();
    const other = {};
    const screens = new Map([["s1", { screen: other }]]);
    const sys = mountScreenMeshTick({ actions: makeActions({ SM }) });
    sys.tick(0.016, { ...BASE, worldScreens: screens });
    expect(SM._calls.some(c => c.type === "update" && c.sc === other)).toBe(true);
  });

  it("jumbotron in worldScreens → not double-updated by loop", () => {
    const SM = makeSM();
    const jb = {};
    const screens = new Map([["j", { screen: jb }]]);
    const sys = mountScreenMeshTick({ actions: makeActions({ SM }) });
    sys.tick(0.016, { ...BASE, jumbotronScreen: jb, worldScreens: screens });
    // jb should get exactly 1 update call (from the explicit branch, not the loop)
    expect(SM._calls.filter(c => c.type === "update" && c.sc === jb)).toHaveLength(1);
  });
});

describe("screen_mesh_tick — build console cursor", () => {
  it("not buildMode → intersectMesh never called", () => {
    const SM = makeSM();
    const intersected = [];
    const actions = { ...makeActions({ SM }), intersectMesh: () => { intersected.push(1); return []; } };
    mountScreenMeshTick({ actions }).tick(0.016, { ...BASE, buildMode: false, pointerLocked: true });
    expect(intersected).toHaveLength(0);
  });

  it("buildMode + pointerLocked + bcSc + bcMesh → intersectMesh called", () => {
    const SM = makeSM();
    const bcSc = { resolutionW: 100, resolutionH: 100, hitRegions: [] };
    let intersected = false;
    const actions = { ...makeActions({ SM, bcSc, bcMesh: {} }), intersectMesh: () => { intersected = true; return []; } };
    mountScreenMeshTick({ actions }).tick(0.016, { ...BASE, buildMode: true, pointerLocked: true });
    expect(intersected).toBe(true);
  });

  it("hit with uv → setState with correct cursor coords", () => {
    const SM = makeSM();
    const bcSc = { resolutionW: 100, resolutionH: 100, hitRegions: [] };
    const hits = [{ uv: { x: 0.5, y: 0.75 } }];
    mountScreenMeshTick({ actions: makeActions({ SM, bcSc, bcMesh: {}, hits }) })
      .tick(0.016, { ...BASE, buildMode: true, pointerLocked: true });
    const call = SM._calls.find(c => c.type === "setState" && c.sc === bcSc);
    expect(call.state.cursorX).toBe(50);   // Math.round(0.5 * 100)
    expect(call.state.cursorY).toBe(25);   // Math.round((1 - 0.75) * 100)
  });

  it("hit inside hitRegion → correct hoverBtn returned", () => {
    const SM = makeSM();
    const hoverLog = [];
    const bcSc = {
      resolutionW: 100, resolutionH: 100,
      hitRegions: [{ id: "btn1", x: 45, y: 20, w: 10, h: 10 }],
    };
    const hits = [{ uv: { x: 0.5, y: 0.75 } }]; // cx=50,cy=25 inside btn1 (45-55, 20-30)
    mountScreenMeshTick({ actions: makeActions({ SM, bcSc, bcMesh: {}, hits, hoverLog }) })
      .tick(0.016, { ...BASE, buildMode: true, pointerLocked: true });
    expect(hoverLog[0]).toBe("btn1");
  });

  it("no hit → setState (-1,-1,null) and setHoverRegion(null)", () => {
    const SM = makeSM();
    const hoverLog = [];
    const bcSc = { resolutionW: 100, resolutionH: 100, hitRegions: [] };
    mountScreenMeshTick({ actions: makeActions({ SM, bcSc, bcMesh: {}, hits: [], hoverLog }) })
      .tick(0.016, { ...BASE, buildMode: true, pointerLocked: true });
    const call = SM._calls.find(c => c.type === "setState" && c.sc === bcSc);
    expect(call.state.cursorX).toBe(-1);
    expect(call.state.hoverBtn).toBeNull();
    expect(hoverLog[0]).toBeNull();
  });

  it("not buildMode + bcSc present → clears cursor to (-1,-1,null)", () => {
    const SM = makeSM();
    const bcSc = { resolutionW: 100, resolutionH: 100, hitRegions: [] };
    mountScreenMeshTick({ actions: makeActions({ SM, bcSc }) })
      .tick(0.016, { ...BASE, buildMode: false });
    const call = SM._calls.find(c => c.type === "setState" && c.sc === bcSc);
    expect(call).toBeTruthy();
    expect(call.state.cursorX).toBe(-1);
  });
});

describe("screen_mesh_tick — mouse cursor overlay", () => {
  it("mouseMode + screen → canvas draw ops made", () => {
    const SM = makeSM();
    const screen = makeScreen();
    mountScreenMeshTick({ actions: makeActions({ SM }) })
      .tick(0.016, { ...BASE, mouseMode: true, activeMouseScreen: screen, mouseModeCursor: { x: 50, y: 60 } });
    expect(screen._ctx._ops.some(o => o.fn === "fillRect")).toBe(true);
    expect(screen._ctx._ops.some(o => o.fn === "arc")).toBe(true);
  });

  it("mouseMode + screen → texture.needsUpdate set true", () => {
    const SM = makeSM();
    const screen = makeScreen();
    mountScreenMeshTick({ actions: makeActions({ SM }) })
      .tick(0.016, { ...BASE, mouseMode: true, activeMouseScreen: screen });
    expect(screen.texture.needsUpdate).toBe(true);
  });

  it("mouseMode false → no canvas draw calls", () => {
    const SM = makeSM();
    const screen = makeScreen();
    mountScreenMeshTick({ actions: makeActions({ SM }) })
      .tick(0.016, { ...BASE, mouseMode: false, activeMouseScreen: screen });
    expect(screen._ctx._ops).toHaveLength(0);
  });

  it("no canvas on screen → does not throw", () => {
    const SM = makeSM();
    const screen = { canvas: null, texture: null };
    const sys = mountScreenMeshTick({ actions: makeActions({ SM }) });
    expect(() => sys.tick(0.016, { ...BASE, mouseMode: true, activeMouseScreen: screen })).not.toThrow();
  });
});
