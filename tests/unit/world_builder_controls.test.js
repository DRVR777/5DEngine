import { describe, expect, it, vi } from "vitest";
import { mountWorldBuilderControls, wireInspectorInputs } from "../../src/builder/world_builder_controls.js";

function makeEl(id = "") {
  const listeners = {};
  return {
    id,
    value: "",
    dataset: {},
    innerHTML: "",
    textContent: "",
    selected: false,
    files: [],
    style: {},
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    dispatch: (type, event = {}) => listeners[type]?.(event),
    appendChild: vi.fn(),
    click: vi.fn(),
    blur: vi.fn(),
    remove: vi.fn(),
    closest: vi.fn(),
  };
}

function makeDocument() {
  const ids = [
    "bPosX", "bPosY", "bPosZ", "bRotX", "bRotY", "bRotZ", "bSclX", "bSclY", "bSclZ",
    "bDelete", "bClone", "bColor", "bIntensity", "bIntensityVal", "bUndo", "bRedo",
    "bScriptApply", "bScriptClear", "bScript", "bScriptError", "bSceneList",
    "bSceneSave", "bSceneName", "bSceneLoad", "bSceneDel", "bExport", "bImport", "bImportFile",
  ];
  const map = new Map(ids.map(id => [id, makeEl(id)]));
  const spawnBtn = makeEl("spawn-cube");
  spawnBtn.dataset.kind = "cube";
  return {
    body: { appendChild: vi.fn() },
    querySelectorAll: vi.fn(sel => sel === ".b-spawn" ? [spawnBtn] : []),
    getElementById: vi.fn(id => map.get(id) || null),
    createElement: vi.fn(tag => makeEl(tag)),
    el: id => map.get(id),
    spawnBtn,
  };
}

function makeBuilder(overrides = {}) {
  return {
    spawnPrimitive: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    deleteSelected: vi.fn(),
    cloneSelected: vi.fn(() => true),
    setColor: vi.fn(),
    setIntensity: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    getSelected: vi.fn(() => ({ uuid: "mesh-1" })),
    setScript: vi.fn(),
    listNamed: vi.fn(() => [{ name: "arena", count: 2 }]),
    saveNamed: vi.fn(() => ({ ok: true })),
    loadNamed: vi.fn(() => ({ ok: true })),
    deleteNamed: vi.fn(() => true),
    exportSceneJSON: vi.fn(() => "{}"),
    importSceneJSON: vi.fn(() => ({ ok: true })),
    loadState: vi.fn(() => []),
    rehydrate: vi.fn(),
    ...overrides,
  };
}

describe("world builder controls", () => {
  it("spawns primitive two meters in camera-forward direction", () => {
    const doc = makeDocument();
    const builder = makeBuilder();
    const playSfx = vi.fn();
    mountWorldBuilderControls({
      documentRef: doc,
      worldBuilder: builder,
      get: { heroPos: () => ({ u: 10, v: 20 }), camYaw: () => Math.PI / 2 },
      actions: { playSfx, info: vi.fn(), getScriptRunner: () => null },
    });

    doc.spawnBtn.dispatch("click");
    expect(doc.spawnBtn.blur).toHaveBeenCalled();
    expect(builder.spawnPrimitive).toHaveBeenCalledWith("cube", { x: 12, y: 1.0, z: 20 });
    expect(playSfx).toHaveBeenCalledWith("blip", 0.4);
  });

  it("wireInspectorInputs writes position, rotation in radians, and scale", () => {
    const doc = makeDocument();
    const builder = makeBuilder();
    doc.el("bPosX").value = "1";
    doc.el("bPosY").value = "2";
    doc.el("bPosZ").value = "3";
    doc.el("bRotX").value = "90";
    doc.el("bRotY").value = "180";
    doc.el("bRotZ").value = "45";
    doc.el("bSclX").value = "1.5";
    doc.el("bSclY").value = "2.5";
    doc.el("bSclZ").value = "3.5";

    wireInspectorInputs({ document: doc, worldBuilder: builder });
    doc.el("bPosX").dispatch("change");

    expect(builder.setPosition).toHaveBeenCalledWith(1, 2, 3);
    expect(builder.setRotation).toHaveBeenCalledWith(Math.PI / 2, Math.PI, Math.PI / 4);
    expect(builder.setScale).toHaveBeenCalledWith(1.5, 2.5, 3.5);
  });

  it("script apply writes script, clears cache, clears error, and plays blip", () => {
    const doc = makeDocument();
    const builder = makeBuilder();
    const playSfx = vi.fn();
    const runner = { clearCache: vi.fn() };
    doc.el("bScript").value = "spin()";
    doc.el("bScriptError").textContent = "ERR";

    mountWorldBuilderControls({
      documentRef: doc,
      worldBuilder: builder,
      get: { heroPos: () => ({ u: 0, v: 0 }), camYaw: () => 0 },
      actions: { playSfx, info: vi.fn(), getScriptRunner: () => runner },
    });
    doc.el("bScriptApply").dispatch("click");

    expect(builder.setScript).toHaveBeenCalledWith({ uuid: "mesh-1" }, "spin()");
    expect(runner.clearCache).toHaveBeenCalledWith("mesh-1");
    expect(doc.el("bScriptError").textContent).toBe("");
    expect(playSfx).toHaveBeenCalledWith("blip", 0.3);
  });

  it("scene save refreshes list and preserves option labels", () => {
    const doc = makeDocument();
    const builder = makeBuilder();
    const playSfx = vi.fn();
    doc.el("bSceneName").value = "arena";

    mountWorldBuilderControls({
      documentRef: doc,
      worldBuilder: builder,
      get: { heroPos: () => ({ u: 0, v: 0 }), camYaw: () => 0 },
      actions: { playSfx, info: vi.fn(), getScriptRunner: () => null },
    });
    doc.el("bSceneSave").dispatch("click");

    expect(builder.saveNamed).toHaveBeenCalledWith("arena");
    expect(doc.el("bSceneList").innerHTML).toBe('<option value="">— select —</option>');
    expect(doc.createElement).toHaveBeenCalledWith("option");
    expect(playSfx).toHaveBeenCalledWith("blip", 0.4);
  });

  it("rehydrates saved state and logs restored primitive count", () => {
    const doc = makeDocument();
    const builder = makeBuilder({
      loadState: vi.fn(() => [{ id: 1 }]),
      rehydrate: vi.fn(() => ({ ok: true, restored: 2, skipped: 1 })),
    });
    const info = vi.fn();

    mountWorldBuilderControls({
      documentRef: doc,
      worldBuilder: builder,
      get: { heroPos: () => ({ u: 0, v: 0 }), camYaw: () => 0 },
      actions: { playSfx: vi.fn(), info, getScriptRunner: () => null },
    });

    expect(builder.rehydrate).toHaveBeenCalledWith([{ id: 1 }]);
    expect(info).toHaveBeenCalledWith("Builder: rehydrated 2 primitives (skipped 1 non-primitives)");
  });
});
