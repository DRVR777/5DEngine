import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/particle_terrain_init.js", "utf8");

describe("particle_terrain_init", () => {
  it("exports mountParticleAndTerrain", () => {
    expect(src).toContain("export function mountParticleAndTerrain");
  });

  it("accepts THREE, scene, showToast", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
    expect(src).toContain("showToast");
  });

  it("guards ParticleSystem.init with typeof check", () => {
    expect(src).toContain("typeof ParticleSystem");
    expect(src).toContain("ParticleSystem.init");
  });

  it("sets window._terrainEnabled = false", () => {
    expect(src).toContain("window._terrainEnabled = false");
  });

  it("registers window._generateTerrain", () => {
    expect(src).toContain("window._generateTerrain");
    expect(src).toContain("Terrain.generate");
  });

  it("uses default terrain opts size:200 maxHeight:6", () => {
    expect(src).toContain("size: 200");
    expect(src).toContain("maxHeight: 6");
  });

  it("registers window._removeTerrain", () => {
    expect(src).toContain("window._removeTerrain");
    expect(src).toContain("Terrain.dispose");
  });
});
