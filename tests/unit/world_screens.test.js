import { describe, expect, it, vi } from "vitest";
import { mountWorldScreens } from "../../src/systems/world_screens.js";

function makeScreenMesh() {
  const screens = [];
  const meshes = [];
  return {
    screens,
    meshes,
    SIZE_PRESETS: {
      jumbotron: { widthM: 50, heightM: 30 },
      colossal: { widthM: 1000, heightM: 500 },
    },
    createScreen: vi.fn(def => {
      screens.push(def);
      return def;
    }),
    bindToThree: vi.fn((_THREE, screen, opts) => {
      const mesh = {
        screen,
        opts,
        position: { set: vi.fn() },
        rotation: { y: null },
      };
      meshes.push(mesh);
      return mesh;
    }),
  };
}

function mount(overrides = {}) {
  const SM = makeScreenMesh();
  const scene = { add: vi.fn() };
  const worldScreens = new Map();
  const deviceBus = { send: vi.fn() };
  const builder = {
    spawnPrimitive: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    cloneSelected: vi.fn(),
    deleteSelected: vi.fn(),
    saveState: vi.fn(),
    loadState: vi.fn(() => ({ ok: true })),
    rehydrate: vi.fn(),
    getSelected: vi.fn(() => ({
      uuid: "abcdefghi",
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 1, y: 2, z: 3 },
      scale: { x: 1, y: 1, z: 1 },
    })),
  };
  let score = 2;
  const actions = {
    playSfx: vi.fn(),
    showToast: vi.fn(),
  };
  const win = {};
  const api = mountWorldScreens({
    THREE: {},
    scene,
    screenMesh: SM,
    worldScreens,
    worldData: overrides.worldData || {},
    windowRef: win,
    get: {
      deviceBus: () => deviceBus,
      heroPos: () => ({ u: 10, v: 20 }),
      score: () => score,
      pickups: () => [1, 2, 3],
      heroHp: () => 77,
      heroMaxHp: () => 100,
      freeCamYaw: () => Math.PI / 2,
      worldBuilder: () => builder,
    },
    set: {
      score: v => { score = v; },
    },
    actions,
  });
  return { SM, scene, worldScreens, deviceBus, builder, actions, win, api, getScore: () => score };
}

describe("mountWorldScreens", () => {
  it("creates the three legacy screens with preserved ids and resolutions", () => {
    const { SM, api, win } = mount();
    expect(SM.createScreen).toHaveBeenCalledTimes(3);
    expect(api.jumbotronScreen.id).toBe("jumbotron50");
    expect(api.jumbotronScreen.resolutionW).toBe(768);
    expect(api.jumbotronScreen.resolutionH).toBe(460);
    expect(api.skyScreen.id).toBe("sky1000");
    expect(api.skyScreen.resolutionW).toBe(1024);
    expect(api.skyScreen.resolutionH).toBe(512);
    expect(api.buildConsoleScreen.id).toBe("buildConsole");
    expect(api.buildConsoleScreen.resolutionW).toBe(1024);
    expect(api.buildConsoleScreen.resolutionH).toBe(400);
    expect(win._buildConsoleScreen).toBe(api.buildConsoleScreen);
    expect(win._buildConsoleMesh).toBe(api.buildConsoleMesh);
  });

  it("keeps jumbotron hit-region positions, sounds, and score mutation", () => {
    const { api, actions, deviceBus, getScore } = mount();
    const hype = api.jumbotronScreen.hitRegions.find(r => r.id === "btn_hype");
    const radio = api.jumbotronScreen.hitRegions.find(r => r.id === "btn_radio");
    const coin = api.jumbotronScreen.hitRegions.find(r => r.id === "btn_coin");
    expect(hype).toMatchObject({ x: 80, y: 360, w: 180, h: 70 });
    expect(radio).toMatchObject({ x: 290, y: 360, w: 180, h: 70 });
    expect(coin).toMatchObject({ x: 500, y: 360, w: 180, h: 70 });
    hype.onClick(api.jumbotronScreen);
    radio.onClick(api.jumbotronScreen);
    coin.onClick(api.jumbotronScreen);
    expect(actions.playSfx).toHaveBeenCalledWith("beep:660", 0.5);
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.4);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1000:50:sine", 0.4);
    expect(deviceBus.send).toHaveBeenCalledWith("pc1", "audio_out", { kind: "audio", payload: { src: "beep:880", volume: 0.5 } });
    expect(getScore()).toBe(3);
  });

  it("places default screen meshes at the same world positions", () => {
    const { SM, scene, worldScreens, api } = mount();
    expect(scene.add).toHaveBeenCalledTimes(3);
    expect(SM.meshes[0].position.set).toHaveBeenCalledWith(30, api.jumbotronScreen.heightM / 2 + 1, 25);
    expect(SM.meshes[0].rotation.y).toBe(Math.PI);
    expect(SM.meshes[1].position.set).toHaveBeenCalledWith(0, 300, 0);
    expect(SM.meshes[2].position.set).toHaveBeenCalledWith(0, 12 / 2 + 1, -88);
    expect(SM.meshes[2].rotation.y).toBe(0);
    expect(worldScreens.has("jumbotron50")).toBe(true);
    expect(worldScreens.has("sky1000")).toBe(true);
    expect(worldScreens.has("buildConsole")).toBe(true);
  });

  it("preserves build-console spawn/action button layout and side effects", () => {
    const { api, builder, actions } = mount();
    const spawnBox = api.buildConsoleScreen.hitRegions.find(r => r.id === "spawn_box");
    const save = api.buildConsoleScreen.hitRegions.find(r => r.id === "act_save");
    const load = api.buildConsoleScreen.hitRegions.find(r => r.id === "act_load");
    expect(spawnBox).toMatchObject({ x: 20, y: 20, w: 126, h: 70 });
    spawnBox.onClick();
    expect(builder.spawnPrimitive).toHaveBeenCalledWith("box", { x: 14, y: 1.0, z: 20 });
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.3);
    expect(save).toMatchObject({ x: 20 + 4 * 165, y: 400 - 90, w: 153, h: 68 });
    save.onClick();
    expect(builder.saveState).toHaveBeenCalled();
    expect(actions.showToast).toHaveBeenCalledWith("Scene saved", "success", 800);
    load.onClick();
    expect(builder.rehydrate).toHaveBeenCalledWith({ ok: true });
    expect(actions.showToast).toHaveBeenCalledWith("Scene loaded", "info", 800);
  });

  it("returns null screens when ScreenMesh is unavailable", () => {
    const api = mountWorldScreens({
      THREE: {},
      scene: { add: vi.fn() },
      screenMesh: null,
      worldScreens: new Map(),
      worldData: {},
      get: {},
      set: {},
      actions: {},
      windowRef: {},
    });
    expect(api).toEqual({ jumbotronScreen: null, skyScreen: null, buildConsoleScreen: null, buildConsoleMesh: null });
  });
});
