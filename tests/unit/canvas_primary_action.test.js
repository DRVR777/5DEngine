import { describe, expect, it, vi } from "vitest";
import { handleCanvasPrimaryAction } from "../../src/systems/canvas_primary_action.js";

function event(overrides = {}) {
  return { button: 0, clientX: 50, clientY: 50, shiftKey: false, preventDefault: vi.fn(), ...overrides };
}

function renderer() {
  return { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } };
}

function makeDeps(overrides = {}) {
  const state = {
    buildMode: false, worldBuilder: null, pointerLocked: false, builderMultiList: null,
    mouseMode: false, activeMouseScreen: null, mouseModeCursor: { x: 0, y: 0 },
    inventoryOpen: false, computerOpen: false, computerEntering: false,
    inCar: false, activeVehicleId: null, activeVehicleDef: null,
    ...overrides.state,
  };
  const get = Object.fromEntries(Object.keys(state).map(k => [k, () => state[k]]));
  const actions = {
    playSfx: vi.fn(),
    getScreenMesh: vi.fn(() => null),
    getBuildConsoleHover: vi.fn(() => null),
    getBuildConsoleScreen: vi.fn(() => null),
    tryDroneShoot: vi.fn(),
    tryShoot: vi.fn(),
    ...overrides.actions,
  };
  return { renderer: renderer(), get, actions, state };
}

function run(e, deps) {
  return handleCanvasPrimaryAction(e, deps);
}

describe("handleCanvasPrimaryAction", () => {
  it("ignores non-primary buttons", () => {
    const deps = makeDeps();
    expect(run(event({ button: 2 }), deps)).toBe(false);
    expect(deps.actions.tryShoot).not.toHaveBeenCalled();
  });

  it("starts build axis drag when gizmo axis is hit", () => {
    const wb = { pickGizmoAxis: vi.fn(() => "x"), startAxisDrag: vi.fn(), pickAt: vi.fn(), getSelected: vi.fn(), select: vi.fn() };
    const deps = makeDeps({ state: { buildMode: true, worldBuilder: wb } });
    const e = event();
    expect(run(e, deps)).toBe(true);
    expect(wb.startAxisDrag).toHaveBeenCalledWith("x", { x: 0, y: 0 });
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("shift-click adds picked object to multi-select list and selects it", () => {
    const picked = { id: 1 };
    const list = [];
    const wb = { pickGizmoAxis: vi.fn(() => null), pickAt: vi.fn(() => picked), getSelected: vi.fn(() => null), select: vi.fn(), dragStart: vi.fn() };
    const deps = makeDeps({ state: { buildMode: true, worldBuilder: wb, builderMultiList: list } });
    expect(run(event({ shiftKey: true }), deps)).toBe(true);
    expect(list).toEqual([picked]);
    expect(wb.select).toHaveBeenCalledWith(picked);
    expect(deps.actions.playSfx).toHaveBeenCalledWith("blip", 0.2);
  });

  it("clicking already selected build object starts drag", () => {
    const picked = { id: 1 };
    const wb = { pickGizmoAxis: vi.fn(() => null), pickAt: vi.fn(() => picked), getSelected: vi.fn(() => picked), select: vi.fn(), dragStart: vi.fn() };
    const deps = makeDeps({ state: { buildMode: true, worldBuilder: wb } });
    expect(run(event(), deps)).toBe(true);
    expect(wb.dragStart).toHaveBeenCalled();
  });

  it("mouse-mode converts cursor pixels to UV and clicks region", () => {
    const onClick = vi.fn();
    const screen = { resolutionW: 200, resolutionH: 100 };
    const screenMesh = { hitTest: vi.fn(() => ({ onClick })) };
    const deps = makeDeps({ state: { mouseMode: true, activeMouseScreen: screen, mouseModeCursor: { x: 50, y: 25 } }, actions: { getScreenMesh: () => screenMesh } });
    const e = event();
    expect(run(e, deps)).toBe(true);
    expect(screenMesh.hitTest).toHaveBeenCalledWith(screen, { x: 0.25, y: 0.75 });
    expect(onClick).toHaveBeenCalledWith(screen);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it("does not shoot when pointer is not locked", () => {
    const deps = makeDeps();
    expect(run(event(), deps)).toBe(false);
    expect(deps.actions.tryShoot).not.toHaveBeenCalled();
  });

  it("does not shoot while inventory is open", () => {
    const deps = makeDeps({ state: { pointerLocked: true, inventoryOpen: true } });
    expect(run(event(), deps)).toBe(false);
    expect(deps.actions.tryShoot).not.toHaveBeenCalled();
  });

  it("shoots drone when in drone vehicle", () => {
    const deps = makeDeps({ state: { pointerLocked: true, inCar: true, activeVehicleId: "v1", activeVehicleDef: { type: "drone" } } });
    expect(run(event(), deps)).toBe(true);
    expect(deps.actions.tryDroneShoot).toHaveBeenCalled();
    expect(deps.actions.tryShoot).not.toHaveBeenCalled();
  });

  it("shoots current weapon when gameplay is unblocked", () => {
    const deps = makeDeps({ state: { pointerLocked: true } });
    expect(run(event(), deps)).toBe(true);
    expect(deps.actions.tryShoot).toHaveBeenCalled();
  });
});
