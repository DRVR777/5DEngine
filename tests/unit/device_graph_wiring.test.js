import { describe, expect, it, vi } from "vitest";
import { mountDeviceGraphWiring } from "../../src/devices/device_graph_wiring.js";

function makeTHREE() {
  return {
    Mesh: class {
      constructor(geo, mat) {
        this.geo = geo;
        this.mat = mat;
        this.position = { set: vi.fn() };
        this.rotation = { y: null };
        this.castShadow = false;
      }
    },
    BoxGeometry: class {
      constructor(w, h, d) {
        this.w = w; this.h = h; this.d = d;
      }
    },
    MeshStandardMaterial: class {
      constructor(opts) {
        this.opts = opts;
      }
    },
    Vector3: class {
      constructor(x, y, z) {
        this.x = x; this.y = y; this.z = z;
      }
    },
  };
}

function makeBus() {
  return {
    makeComputer: vi.fn(),
    makeMonitor: vi.fn(),
    makeSpeaker: vi.fn(),
    makeStorageMedia: vi.fn(),
    makeRadio: vi.fn(),
    connect: vi.fn(),
    insertMedia: vi.fn(),
    drain: vi.fn(() => []),
  };
}

function makeScreenMesh() {
  return {
    createScreen: vi.fn(def => def),
    bindToThree: vi.fn(() => ({
      position: { set: vi.fn() },
      rotation: { y: null },
    })),
  };
}

function mount(overrides = {}) {
  const bus = makeBus();
  const wires = {
    buildAllWireMeshes: vi.fn(() => new Map([["wire1", { id: "wire1" }]])),
  };
  const scene = { add: vi.fn(), remove: vi.fn() };
  const screenMesh = overrides.screenMesh === undefined ? makeScreenMesh() : overrides.screenMesh;
  const win = {};
  const api = mountDeviceGraphWiring({
    THREE: makeTHREE(),
    scene,
    devicesApi: overrides.devicesApi === undefined ? { createBus: () => bus } : overrides.devicesApi,
    wiresApi: overrides.wiresApi === undefined ? wires : overrides.wiresApi,
    screenMesh,
    worldData: overrides.worldData || {},
    computerEntity: { u: 5, v: 7 },
    worldScreens: new Map(),
    windowRef: win,
  });
  return { api, bus, wires, scene, screenMesh, win };
}

describe("mountDeviceGraphWiring", () => {
  it("creates the legacy PC, monitor, speaker, USB, and radio devices", () => {
    const { bus } = mount();
    expect(bus.makeComputer).toHaveBeenCalledWith({ id: "pc1", position: { u: 5, v: 7, y: 1.1 },
      files: { "/boot.txt": "DWRLD OS v0.1", "/readme": "wire stuff together!" } });
    expect(bus.makeMonitor).toHaveBeenCalledWith({ id: "mon1", position: { u: 5, v: 7, y: 1.6 }, size: "small" });
    expect(bus.makeSpeaker).toHaveBeenCalledWith({ id: "spk1", position: { u: 6, v: 6.8, y: 0.8 } });
    expect(bus.makeStorageMedia).toHaveBeenCalledWith({ id: "usb1", mediaKind: "usb", position: { u: 4.6, v: 7.1, y: 1.0 },
      files: { "/notes.txt": "your personal stash" }, label: "MY_USB" });
    expect(bus.makeRadio).toHaveBeenCalledWith({ id: "radioA", position: { u: 5.3, v: 6.8, y: 1.4 }, frequency: 94.7, txRange: 80, rxRange: 80 });
    expect(bus.makeRadio).toHaveBeenCalledWith({ id: "radioB", position: { u: 19, v: 11, y: 1.0 }, frequency: 94.7, txRange: 80, rxRange: 80 });
  });

  it("connects ports and inserts USB media exactly like the monolith", () => {
    const { bus } = mount();
    expect(bus.connect).toHaveBeenCalledWith("pc1", "video_out", "mon1", "video_in", "video");
    expect(bus.connect).toHaveBeenCalledWith("pc1", "audio_out", "spk1", "audio_in", "audio");
    expect(bus.insertMedia).toHaveBeenCalledWith("pc1", "usb_a", "usb1");
  });

  it("creates mon1 physical screen and bridge with preserved dimensions", () => {
    const { bus, screenMesh, win } = mount();
    expect(screenMesh.createScreen).toHaveBeenCalledWith(expect.objectContaining({
      id: "mon1_phys",
      resolutionW: 384,
      resolutionH: 224,
      widthM: 0.7,
      heightM: 0.5,
      state: { lastFrame: "(no signal — boot the PC and click Devices)" },
    }));
    bus.drain.mockReturnValue([{ payload: { frame: "HELLO" } }]);
    win.__mon1Bridge.pollAndPaint();
    expect(bus.drain).toHaveBeenCalledWith("mon1", "video_in");
    expect(win.__mon1Bridge.screen.state.lastFrame).toBe("HELLO");
  });

  it("rebuilds wire meshes using device positions and keeps the mesh map", () => {
    const { api, wires, scene } = mount();
    expect(wires.buildAllWireMeshes).toHaveBeenCalled();
    expect(scene.add).toHaveBeenCalledWith({ id: "wire1" });
    expect(api.wireMeshes.get("wire1")).toEqual({ id: "wire1" });
    wires.buildAllWireMeshes.mockReturnValue(new Map([["wire2", { id: "wire2" }]]));
    api.rebuildDeviceWires();
    expect(scene.remove).toHaveBeenCalledWith({ id: "wire1" });
    expect(api.wireMeshes.has("wire1")).toBe(false);
    expect(api.wireMeshes.get("wire2")).toEqual({ id: "wire2" });
  });

  it("falls back to a monitor proxy when ScreenMesh is unavailable", () => {
    const { win, scene } = mount({ screenMesh: null });
    expect(win.__mon1Bridge).toBeUndefined();
    expect(scene.add).toHaveBeenCalled();
  });

  it("returns null deviceBus when Devices API is unavailable", () => {
    const { api } = mount({ devicesApi: null });
    expect(api.deviceBus).toBe(null);
    expect(api.wireMeshes.size).toBe(0);
    expect(api.devicePositions.size).toBe(0);
  });
});
