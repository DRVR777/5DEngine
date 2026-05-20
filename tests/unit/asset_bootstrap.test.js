import { describe, expect, it, vi } from "vitest";
import { mountAssetBootstrap } from "../../src/systems/asset_bootstrap.js";

function mount(overrides = {}) {
  const timers = [];
  const AssetLoader = {
    load: vi.fn(() => Promise.resolve({ ok: true, formats: ["glb"], slotCount: 3 })),
    replacePlaceholder: vi.fn(),
    ...overrides.AssetLoader,
  };
  const actions = {
    setTimeout: vi.fn((fn, ms) => { timers.push({ fn, ms }); return 11; }),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const gunMeshes = new Map([["pistol", { id: "pistolPlaceholder" }]]);
  const pickupMeshes = new Map([["coin1", { id: "coinMesh" }]]);
  const get = {
    gunMeshes: () => gunMeshes,
    gunMount: () => ({ id: "gunMount" }),
    carGroup: () => ({ id: "carGroup" }),
    carBody: () => ({ id: "carBody" }),
    pickupMeshes: () => pickupMeshes,
    pickups: () => [{ id: "coin1", u: 4, v: 9 }],
    ...overrides.get,
  };
  const win = { AssetLoader, registerGunMesh: true, ...overrides.windowRef };
  const id = mountAssetBootstrap({
    windowRef: win,
    THREE: {},
    Loaders: {},
    scene: { id: "scene" },
    get,
    actions,
  });
  return { id, win, AssetLoader, timers, actions };
}

describe("mountAssetBootstrap", () => {
  it("uses the preserved 200ms bootstrap delay", () => {
    const { id, timers } = mount();
    expect(id).toBe(11);
    expect(timers[0].ms).toBe(200);
  });

  it("replaces pistol, car, and coin placeholders with preserved offsets", async () => {
    const { AssetLoader, timers } = mount();
    await timers[0].fn();
    await Promise.resolve();
    expect(AssetLoader.replacePlaceholder).toHaveBeenCalledWith("pistol", { id: "gunMount" }, { id: "pistolPlaceholder" }, { position: { x: 0, y: 0, z: 0 } });
    expect(AssetLoader.replacePlaceholder).toHaveBeenCalledWith("car", { id: "carGroup" }, { id: "carBody" }, { position: { x: 0, y: 0.7, z: 0 } });
    expect(AssetLoader.replacePlaceholder).toHaveBeenCalledWith("coin", { id: "scene" }, { id: "coinMesh" }, { position: { x: 4, y: 1.0, z: 9 } });
  });

  it("logs manifest skipped failures without replacing placeholders", async () => {
    const { AssetLoader, timers, actions } = mount({
      AssetLoader: { load: vi.fn(() => Promise.resolve({ ok: false, reason: "missing" })) },
    });
    await timers[0].fn();
    await Promise.resolve();
    expect(actions.info).toHaveBeenCalledWith("Assets: manifest load skipped/failed:", "missing");
    expect(AssetLoader.replacePlaceholder).not.toHaveBeenCalled();
  });

  it("warns when the loader throws", async () => {
    const err = new Error("boom");
    const { timers, actions } = mount({
      AssetLoader: { load: vi.fn(() => Promise.reject(err)) },
    });
    await timers[0].fn();
    await Promise.resolve();
    await Promise.resolve();
    expect(actions.warn).toHaveBeenCalledWith("Assets: load threw:", "boom");
  });

  it("does nothing when AssetLoader is missing", () => {
    const { timers, actions } = mount({ windowRef: { AssetLoader: null } });
    timers[0].fn();
    expect(actions.info).not.toHaveBeenCalled();
    expect(actions.warn).not.toHaveBeenCalled();
  });
});
