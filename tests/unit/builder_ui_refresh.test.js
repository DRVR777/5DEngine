import { describe, expect, it, vi } from "vitest";
import { mountBuilderUiRefresh, refreshBuilderUi } from "../../src/builder/builder_ui_refresh.js";

function makeEl(id = "") {
  const classes = new Set();
  return {
    id,
    style: {},
    value: "",
    textContent: "",
    classList: {
      toggle: vi.fn((name, on) => on ? classes.add(name) : classes.delete(name)),
      contains: vi.fn(name => classes.has(name)),
      remove: vi.fn(name => classes.delete(name)),
      add: vi.fn(name => classes.add(name)),
    },
    _classes: classes,
  };
}

function makeDocument(ids = []) {
  const elements = new Map(ids.map(id => [id, makeEl(id)]));
  return {
    activeElement: null,
    getElementById: vi.fn(id => elements.get(id) || null),
    el: id => elements.get(id),
  };
}

function makeBuilder(overrides = {}) {
  return {
    undoDepth: vi.fn(() => 2),
    redoDepth: vi.fn(() => 3),
    getTransform: vi.fn(() => ({
      meta: { primitive: "cube", script: "spin()" },
      pos: { x: 1.234, y: 2.345, z: 3.456 },
      rot: { x: Math.PI / 2, y: Math.PI, z: Math.PI / 4 },
      scale: { x: 1, y: 2, z: 3 },
    })),
    getColor: vi.fn(() => ({ hex: "#112233", kind: "material" })),
    getIntensity: vi.fn(() => 4.2),
    getSelected: vi.fn(() => ({ uuid: "mesh-1" })),
    ...overrides,
  };
}

const IDS = [
  "builderUI", "hotbar", "texturePanel", "bInspector", "bUndoCount", "bRedoCount",
  "bSelMeta", "bPosX", "bPosY", "bPosZ", "bRotX", "bRotY", "bRotZ",
  "bSclX", "bSclY", "bSclZ", "bColorRow", "bColor", "bColorKind",
  "bIntensityRow", "bIntensity", "bIntensityVal", "bScript", "bScriptError",
  "sceneHierarchy",
];

describe("refreshBuilderUi", () => {
  it("hides inspector when build mode is disabled", () => {
    const doc = makeDocument(IDS);
    refreshBuilderUi({ documentRef: doc, buildMode: false, worldBuilder: makeBuilder(), renderSceneHierarchy: vi.fn() });
    expect(doc.el("builderUI").style.display).toBe("none");
    expect(doc.el("bInspector").style.display).toBe("none");
    expect(doc.el("hotbar").classList.toggle).toHaveBeenCalledWith("visible", false);
  });

  it("hides inspector when there is no worldBuilder", () => {
    const doc = makeDocument(IDS);
    refreshBuilderUi({ documentRef: doc, buildMode: true, worldBuilder: null, renderSceneHierarchy: vi.fn() });
    expect(doc.el("builderUI").style.display).toBe("block");
    expect(doc.el("bInspector").style.display).toBe("none");
  });

  it("mirrors transform values and preserves degree conversion", () => {
    const doc = makeDocument(IDS);
    refreshBuilderUi({ documentRef: doc, buildMode: true, worldBuilder: makeBuilder(), renderSceneHierarchy: vi.fn() });
    expect(doc.el("bSelMeta").textContent).toBe("cube");
    expect(doc.el("bPosX").value).toBe("1.23");
    expect(doc.el("bRotX").value).toBe("90");
    expect(doc.el("bRotY").value).toBe("180");
    expect(doc.el("bRotZ").value).toBe("45");
    expect(doc.el("bSclZ").value).toBe("3.00");
  });

  it("does not overwrite the active input", () => {
    const doc = makeDocument(IDS);
    doc.activeElement = doc.el("bPosX");
    doc.el("bPosX").value = "editing";
    refreshBuilderUi({ documentRef: doc, buildMode: true, worldBuilder: makeBuilder(), renderSceneHierarchy: vi.fn() });
    expect(doc.el("bPosX").value).toBe("editing");
  });

  it("shows color, intensity, and script error rows when data exists", () => {
    const doc = makeDocument(IDS);
    const scriptRunner = { getError: vi.fn(() => "bad script") };
    refreshBuilderUi({
      documentRef: doc,
      buildMode: true,
      worldBuilder: makeBuilder(),
      renderSceneHierarchy: vi.fn(),
      getScriptRunner: () => scriptRunner,
    });
    expect(doc.el("bColorRow").style.display).toBe("block");
    expect(doc.el("bColor").value).toBe("#112233");
    expect(doc.el("bColorKind").textContent).toBe("material");
    expect(doc.el("bIntensityRow").style.display).toBe("block");
    expect(doc.el("bIntensity").value).toBe(4.2);
    expect(doc.el("bIntensityVal").textContent).toBe("4.2");
    expect(doc.el("bScriptError").textContent).toBe("ERR: bad script");
  });

  it("refreshes scene hierarchy when visible in build mode", () => {
    const doc = makeDocument(IDS);
    doc.el("sceneHierarchy")._classes.add("visible");
    const renderSceneHierarchy = vi.fn();
    refreshBuilderUi({ documentRef: doc, buildMode: true, worldBuilder: makeBuilder(), renderSceneHierarchy });
    expect(renderSceneHierarchy).toHaveBeenCalled();
  });

  it("mountBuilderUiRefresh reads fresh state on each call", () => {
    const doc = makeDocument(IDS);
    let buildMode = false;
    const refresh = mountBuilderUiRefresh({
      documentRef: doc,
      get: { buildMode: () => buildMode, worldBuilder: () => makeBuilder() },
      actions: { renderSceneHierarchy: vi.fn(), getScriptRunner: () => null },
    });
    refresh();
    expect(doc.el("builderUI").style.display).toBe("none");
    buildMode = true;
    refresh();
    expect(doc.el("builderUI").style.display).toBe("block");
  });
});
