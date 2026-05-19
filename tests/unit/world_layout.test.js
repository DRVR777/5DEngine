import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/world/world_layout.js", "utf8");

describe("world_layout", () => {
  it("exports mountWorldLayout", () => {
    expect(src).toContain("export function mountWorldLayout");
  });

  it("returns buildings, buildingBlockers, buildArenaBoundary", () => {
    expect(src).toContain("return { buildings, buildingBlockers, buildArenaBoundary }");
  });

  it("_buildFromSchema creates a LayerBoundary rect with u0/v0/u1/v1 params", () => {
    expect(src).toContain("new LayerBoundary(layerIdx, \"rect\"");
    expect(src).toContain("u0: def.u0, v0: def.v0, u1: def.u1, v1: def.v1");
  });

  it("rectToBlocker computes center u/v and hitbox w/d from building params", () => {
    expect(src).toContain("rectToBlocker");
    expect(src).toContain("(u0+u1)/2");
    expect(src).toContain("Math.abs(u1-u0)");
    expect(src).toContain("Math.abs(v1-v0)");
    expect(src).toContain("h: 6");
  });

  it("buildArenaBoundary uses HALF=28, HEIGHT=2.2 boundary walls", () => {
    expect(src).toContain("buildArenaBoundary");
    expect(src).toContain("HALF = 28");
    expect(src).toContain("HEIGHT = 2.2");
    expect(src).toContain("0x888880"); // wall color
  });

  it("buildArenaBoundary pushes 4 wall blockers into buildingBlockers", () => {
    expect(src).toContain("buildingBlockers.push");
    expect(src).toContain("HALF * 2 + THICK");
  });
});
