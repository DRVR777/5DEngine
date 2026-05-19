import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/flashlight.js", "utf8");

describe("flashlight", () => {
  it("exports mountFlashlight", () => {
    expect(src).toContain("export function mountFlashlight");
  });

  it("accepts THREE and scene", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
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

  it("returns flashLight and flashTarget", () => {
    expect(src).toContain("return { flashLight, flashTarget }");
  });
});
