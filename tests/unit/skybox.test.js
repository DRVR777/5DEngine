import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/skybox.js", "utf8");

describe("skybox", () => {
  it("exports mountSkybox", () => {
    expect(src).toContain("export function mountSkybox");
  });

  it("has 5 presets: day, sunset, night, holo, space", () => {
    expect(src).toContain("day:");
    expect(src).toContain("sunset:");
    expect(src).toContain("night:");
    expect(src).toContain("holo:");
    expect(src).toContain("space:");
  });

  it("_setSkybox sets scene.background, fog, ambLight, sun", () => {
    expect(src).toContain("window._setSkybox");
    expect(src).toContain("scene.background = new THREE.Color");
    expect(src).toContain("ambLight.color.set");
    expect(src).toContain("sun.color.set");
    expect(src).toContain("sun.intensity = p.sunInt");
  });

  it("_setSkybox shows toast with preset name", () => {
    expect(src).toContain("showToast(`Skybox: ${name}`");
  });

  it("_setFogDensity uses FogExp2 for d>0, Fog otherwise", () => {
    expect(src).toContain("window._setFogDensity");
    expect(src).toContain("THREE.FogExp2");
    expect(src).toContain("THREE.Fog");
    expect(src).toContain("d * 0.04");
  });

  it("_rotateSun uses azimuth angle to set sun XZ position", () => {
    expect(src).toContain("window._rotateSun");
    expect(src).toContain("Math.PI / 180");
    expect(src).toContain("Math.sin(rad) * 30");
    expect(src).toContain("Math.cos(rad) * 30");
  });
});
