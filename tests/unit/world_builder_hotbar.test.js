import { describe, expect, it, vi } from "vitest";
import { mountWorldBuilderHotbar } from "../../src/builder/world_builder_hotbar.js";

function makeEl(id = "") {
  const listeners = {};
  const classes = new Set();
  return {
    id,
    dataset: {},
    innerHTML: "",
    textContent: "",
    files: [],
    classList: {
      add: vi.fn(name => classes.add(name)),
      remove: vi.fn(name => classes.delete(name)),
      toggle: vi.fn((name, on) => on ? classes.add(name) : classes.delete(name)),
      contains: vi.fn(name => classes.has(name)),
    },
    addEventListener: vi.fn((type, fn) => { listeners[type] = fn; }),
    dispatch: (type, event = {}) => listeners[type]?.(event),
    querySelector: vi.fn(sel => {
      if (sel === ".hb-icon") return makeEl("icon");
      if (sel === ".hb-name") return makeEl("name");
      return null;
    }),
    closest: vi.fn(),
  };
}

function makeDocument() {
  const ids = ["hotbar", "ciAssets", "creativeInv", "ciPrimitives", "texSwatches", "texDropZone"];
  const map = new Map(ids.map(id => [id, makeEl(id)]));
  const slots = Array.from({ length: 9 }, (_, i) => {
    const el = makeEl(`slot-${i}`);
    el.dataset.slot = String(i);
    return el;
  });
  return {
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
    getElementById: vi.fn(id => map.get(id) || null),
    querySelector: vi.fn(sel => {
      const m = /\.hb-slot\[data-slot="(\d+)"\]/.exec(sel);
      return m ? slots[Number(m[1])] : null;
    }),
    createElement: vi.fn(() => makeEl("created")),
    el: id => map.get(id),
    slot: i => slots[i],
  };
}

function makeBuilder(overrides = {}) {
  return {
    spawnPrimitive: vi.fn(),
    spawnFromLibrary: vi.fn(() => Promise.resolve()),
    getLibrary: vi.fn(() => [{ name: "crate.glb", assetData: true }]),
    getTextures: vi.fn(() => [{ name: "brick.png", dataUrl: "data:image/png;base64,abc" }]),
    applyTexture: vi.fn(() => true),
    addTexture: vi.fn(),
    groupSelected: vi.fn(),
    getSelected: vi.fn(() => ({ id: 1 })),
    exportSceneJSON: vi.fn(() => "{\"ok\":true}"),
    importSceneJSON: vi.fn(),
    deleteSelected: vi.fn(),
    cloneSelected: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setColor: vi.fn(),
    ...overrides,
  };
}

function mount(overrides = {}) {
  const doc = makeDocument();
  const win = {};
  const builder = makeBuilder(overrides.builder);
  const intervalFns = [];
  const mpState = {};
  const mp = { enabled: true, sendEvent: vi.fn() };
  const actions = {
    playSfx: vi.fn(),
    showToast: vi.fn(),
    warn: vi.fn(),
    setInterval: vi.fn((fn, ms) => { intervalFns.push({ fn, ms }); return 7; }),
    ...overrides.actions,
  };
  const state = { gameMode: "peaceful", camYaw: Math.PI / 2, ...overrides.state };
  const originalSpawnPrimitive = builder.spawnPrimitive;
  const api = mountWorldBuilderHotbar({
    documentRef: doc,
    windowRef: win,
    worldBuilder: builder,
    get: {
      heroPos: () => ({ u: 10, v: 20 }),
      camYaw: () => state.camYaw,
      gameMode: () => state.gameMode,
      mp: () => mp,
      mpState: () => mpState,
    },
    actions,
  });
  return { doc, win, builder, actions, intervalFns, mpState, mp, state, api, originalSpawnPrimitive };
}

describe("mountWorldBuilderHotbar", () => {
  it("exposes legacy window hotbar and multiselect bridges", () => {
    const { win } = mount();
    expect(Array.isArray(win._builderMultiList)).toBe(true);
    expect(typeof win._hotbarSelectSlot).toBe("function");
    expect(typeof win._hotbarSpawn).toBe("function");
    expect(typeof win._openCreativeInv).toBe("function");
    expect(typeof win._closeCreativeInv).toBe("function");
    expect(typeof win._builderGroupSelected).toBe("function");
  });

  it("assigns primitive to hotbar and spawns 2.5m ahead at y 1.0", () => {
    const { doc, win, originalSpawnPrimitive, actions } = mount();
    const primitiveItem = { dataset: { kind: "cube" } };
    doc.el("ciPrimitives").dispatch("click", { target: { closest: () => primitiveItem } });
    win._hotbarSpawn();
    expect(originalSpawnPrimitive).toHaveBeenCalledWith("cube", { x: 12.5, y: 1.0, z: 20 });
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.3);
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.4);
  });

  it("creative inventory open refreshes library markup and close removes class", () => {
    const { doc, win, api } = mount();
    win._openCreativeInv();
    expect(api.isCreativeOpen()).toBe(true);
    expect(doc.el("ciAssets").innerHTML).toContain("crate");
    expect(doc.el("creativeInv").classList.add).toHaveBeenCalledWith("open");
    win._closeCreativeInv();
    expect(api.isCreativeOpen()).toBe(false);
    expect(doc.el("creativeInv").classList.remove).toHaveBeenCalledWith("open");
  });

  it("texture swatch applies texture and preserves 0.4 click volume", () => {
    const { doc, builder, actions } = mount();
    const swatch = { dataset: { texidx: "0" } };
    doc.el("texSwatches").dispatch("click", { target: { closest: () => swatch } });
    expect(builder.applyTexture).toHaveBeenCalledWith("data:image/png;base64,abc");
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.4);
  });

  it("group selected uses same list object and clears it in place", () => {
    const { win, builder, actions } = mount();
    win._builderMultiList.push({ id: 1 }, { id: 2 });
    const sameList = win._builderMultiList;
    win._builderGroupSelected();
    expect(builder.groupSelected).toHaveBeenCalledWith(sameList);
    expect(win._builderMultiList).toBe(sameList);
    expect(win._builderMultiList).toHaveLength(0);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:440:80:sine", 0.4);
  });

  it("build sync interval is exactly 1000ms and sends dirty coop scenes", () => {
    const { builder, intervalFns, mp, state } = mount();
    expect(intervalFns[0].ms).toBe(1000);
    builder.setPosition(1, 2, 3);
    state.gameMode = "coop_build";
    intervalFns[0].fn();
    expect(mp.sendEvent).toHaveBeenCalledWith("build", { action: "sync", json: "{\"ok\":true}" });
  });

  it("incoming sync imports scene and shows 1000ms toast", () => {
    const { builder, mpState, state, actions } = mount();
    state.gameMode = "coop_build";
    mpState.onMpBuildEvent({ action: "sync", json: "{\"remote\":true}" });
    expect(builder.importSceneJSON).toHaveBeenCalledWith("{\"remote\":true}");
    expect(actions.showToast).toHaveBeenCalledWith("Scene synced from peer", "info", 1000);
  });
});
