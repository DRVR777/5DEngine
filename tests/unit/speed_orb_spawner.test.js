import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/speed_orb_spawner.js", "utf8");

describe("speed_orb_spawner", () => {
  it("exports mountSpeedOrbSpawner", () => {
    expect(src).toContain("export function mountSpeedOrbSpawner");
  });

  it("returns speedOrbs array and spawnSpeedOrb function", () => {
    expect(src).toContain("return { speedOrbs, spawnSpeedOrb }");
  });

  it("uses DodecahedronGeometry 0.22 radius", () => {
    expect(src).toContain("DodecahedronGeometry(0.22, 0)");
  });

  it("uses yellow/orange emissive material", () => {
    expect(src).toContain("0xffdd00"); // yellow
    expect(src).toContain("0xffa500"); // orange emissive
    expect(src).toContain("emissiveIntensity: 0.9");
  });

  it("spawns mesh at y=0.7 with collected:false and _birthT", () => {
    expect(src).toContain("mesh.position.set(u, 0.7, v)");
    expect(src).toContain("collected: false");
    expect(src).toContain("_birthT: performance.now() / 1000");
  });

  it("adds mesh to scene", () => {
    expect(src).toContain("scene.add(mesh)");
  });
});
