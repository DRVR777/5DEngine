import { readFileSync } from "fs";
import { describe, it, expect, vi } from "vitest";
import { mountFlashlight } from "../../src/render/flashlight.js";

const src = readFileSync("src/render/flashlight.js", "utf8");

describe("flashlight", () => {
  it("exports mountFlashlight", () => {
    expect(src).toContain("export function mountFlashlight");
  });

  it("accepts THREE, scene, and getCamera", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
    expect(src).toContain("getCamera");
  });

  it("creates SpotLight with correct params", () => {
    expect(src).toContain("SpotLight");
    expect(src).toContain("0xfff8e0");
    expect(src).toContain("0.22");
    expect(src).toContain("0.55");
    expect(src).toContain("1.6");
  });

  it("creates an Object3D target", () => {
    expect(src).toContain("new THREE.Object3D()");
  });

  it("adds both light and target to scene", () => {
    expect(src).toContain("scene.add(flashLight)");
    expect(src).toContain("scene.add(flashTarget)");
  });

  it("assigns flashTarget as flashLight.target", () => {
    expect(src).toContain("flashLight.target = flashTarget");
  });

  it("returns flashLight, flashTarget, and tick", () => {
    expect(src).toContain("return { flashLight, flashTarget, tick }");
  });
});

function makeTHREE() {
  return {
    SpotLight: function() { return { position: { copy: vi.fn() }, intensity: 0, target: null }; },
    Object3D:  function() {
      const pos = { copy: vi.fn().mockReturnThis(), addScaledVector: vi.fn() };
      return { position: pos, updateMatrixWorld: vi.fn() };
    },
    Vector3:   function() { return {}; },
  };
}

describe("mountFlashlight — tick", () => {
  it("tick(false) → flashLight.position.copy not called", () => {
    const THREE = makeTHREE();
    const scene = { add: vi.fn() };
    const cam = { position: {}, getWorldDirection: vi.fn() };
    const { flashLight, tick } = mountFlashlight({ THREE, scene, getCamera: () => cam });
    tick(false);
    expect(flashLight.position.copy).not.toHaveBeenCalled();
  });

  it("tick(true) → flashLight.position.copy called with cam.position", () => {
    const THREE = makeTHREE();
    const scene = { add: vi.fn() };
    const cam = { position: { x: 1, y: 2, z: 3 }, getWorldDirection: vi.fn() };
    const { flashLight, tick } = mountFlashlight({ THREE, scene, getCamera: () => cam });
    tick(true);
    expect(flashLight.position.copy).toHaveBeenCalledWith(cam.position);
  });

  it("tick(true) → flashTarget.position.copy called, then addScaledVector(dir, 10)", () => {
    const THREE = makeTHREE();
    const scene = { add: vi.fn() };
    const cam = { position: {}, getWorldDirection: vi.fn() };
    const { flashTarget, tick } = mountFlashlight({ THREE, scene, getCamera: () => cam });
    tick(true);
    expect(flashTarget.position.copy).toHaveBeenCalledWith(cam.position);
    expect(flashTarget.position.addScaledVector).toHaveBeenCalledWith(expect.any(Object), 10);
  });

  it("tick(true) → flashTarget.updateMatrixWorld called", () => {
    const THREE = makeTHREE();
    const scene = { add: vi.fn() };
    const cam = { position: {}, getWorldDirection: vi.fn() };
    const { flashTarget, tick } = mountFlashlight({ THREE, scene, getCamera: () => cam });
    tick(true);
    expect(flashTarget.updateMatrixWorld).toHaveBeenCalled();
  });

  it("no getCamera → tick(true) does nothing (no error)", () => {
    const THREE = makeTHREE();
    const scene = { add: vi.fn() };
    const { flashLight, tick } = mountFlashlight({ THREE, scene }); // no getCamera
    expect(() => tick(true)).not.toThrow();
    expect(flashLight.position.copy).not.toHaveBeenCalled();
  });
});
