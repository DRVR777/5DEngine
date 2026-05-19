import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/environment.js", "utf8");

describe("environment", () => {
  it("exports mountEnvironment", () => {
    expect(src).toContain("export function mountEnvironment");
  });

  it("returns skyUniforms, ground, sky, grid", () => {
    expect(src).toContain("return { skyUniforms, ground, sky, grid }");
  });

  it("makeGroundTexture uses canvas with checker + speckle", () => {
    expect(src).toContain("makeGroundTexture");
    expect(src).toContain('"#4a7c59"');
    expect(src).toContain('"#3f6b4d"');
    expect(src).toContain("CanvasTexture");
    expect(src).toContain("RepeatWrapping");
  });

  it("ground is PlaneGeometry 200x200 rotated on X", () => {
    expect(src).toContain("PlaneGeometry(200, 200)");
    expect(src).toContain("ground.rotation.x = -Math.PI / 2");
    expect(src).toContain("ground.receiveShadow = true");
  });

  it("sky dome is SphereGeometry 400 radius with BackSide shader", () => {
    expect(src).toContain("SphereGeometry(400, 32, 16)");
    expect(src).toContain("THREE.BackSide");
    expect(src).toContain("depthWrite: false");
    expect(src).toContain("scene.background = null");
  });

  it("skyUniforms has topColor, bottomColor, offset, exponent", () => {
    expect(src).toContain("topColor:");
    expect(src).toContain("bottomColor:");
    expect(src).toContain("0x87ceeb");
    expect(src).toContain("0xffd9aa");
    expect(src).toContain("offset:");
    expect(src).toContain("exponent:");
  });

  it("grid is GridHelper 200x40", () => {
    expect(src).toContain("GridHelper(200, 40, 0x222222, 0x222222)");
    expect(src).toContain("grid.position.y = 0.01");
  });

  it("buildings loop uses bldg.b.params u0/v0/u1/v1 with castShadow", () => {
    expect(src).toContain("for (const bldg of buildings)");
    expect(src).toContain("bldg.b.params");
    expect(src).toContain("mesh.castShadow = true");
    expect(src).toContain("mesh.userData.id = bldg.id");
  });
});
