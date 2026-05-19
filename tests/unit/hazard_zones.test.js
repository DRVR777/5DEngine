import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/hazard_zones.js", "utf8");

describe("hazard_zones", () => {
  it("exports mountHazardZones", () => {
    expect(src).toContain("export function mountHazardZones");
  });

  it("returns spawnFirePatch, spawnPoisonPuddle, firePatches, poisonPuddles", () => {
    expect(src).toContain("spawnFirePatch");
    expect(src).toContain("spawnPoisonPuddle");
    expect(src).toContain("firePatches");
    expect(src).toContain("poisonPuddles");
  });

  it("fire patch uses orange circle at y=0.04", () => {
    expect(src).toContain("0xff6600");
    expect(src).toContain("CircleGeometry(radius, 12)");
    expect(src).toContain("0.04");
    expect(src).toContain("opacity: 0.55");
  });

  it("fire patch default radius 1.5, duration 6.0", () => {
    expect(src).toContain("1.5");
    expect(src).toContain("6.0");
  });

  it("fire patch pushes { mesh, u, v, radius, timeLeft, dmgT: 0 }", () => {
    expect(src).toContain("timeLeft: duration");
    expect(src).toContain("dmgT: 0");
  });

  it("poison puddle uses green circle at y=0.03, radius 1.2", () => {
    expect(src).toContain("0x44cc44");
    expect(src).toContain("CircleGeometry(1.2, 14)");
    expect(src).toContain("0.03");
    expect(src).toContain("opacity: 0.5");
  });

  it("poison puddle pushes { timeLeft: 4.0, applyT: 0 }", () => {
    expect(src).toContain("timeLeft: 4.0");
    expect(src).toContain("applyT: 0");
  });
});
