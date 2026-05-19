import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/decals.js", "utf8");

describe("decals", () => {
  it("exports mountDecalSystem", () => {
    expect(src).toContain("export function mountDecalSystem");
  });

  it("returns spawnDecal and spawnWallScorch", () => {
    expect(src).toContain("spawnDecal");
    expect(src).toContain("spawnWallScorch");
  });

  it("uses internal decal pool for reuse", () => {
    expect(src).toContain("_decalPool");
    expect(src).toContain("_decalPool.pop()");
    expect(src).toContain("_decalPool.push(mesh)");
  });

  it("pools blood and oil material variants", () => {
    expect(src).toContain("blood");
    expect(src).toContain("0x5a0000");
    expect(src).toContain("oil");
    expect(src).toContain("0x1a1a2a");
  });

  it("auto-returns decal to pool after 45s", () => {
    expect(src).toContain("45000");
    expect(src).toContain("mesh.visible = false");
  });

  it("scorch ring-buffer at SCORCH_MAX=50", () => {
    expect(src).toContain("_SCORCH_MAX = 50");
    expect(src).toContain("_wallScorches.shift()");
  });

  it("scorch uses DoubleSide so it shows from both wall faces", () => {
    expect(src).toContain("THREE.DoubleSide");
  });

  it("scorch rotates to face wall normal via atan2", () => {
    expect(src).toContain("Math.atan2(nU, nV)");
  });

  it("scorch offsets slightly off wall to avoid z-fighting", () => {
    expect(src).toContain("nU * 0.025");
    expect(src).toContain("nV * 0.025");
  });
});
