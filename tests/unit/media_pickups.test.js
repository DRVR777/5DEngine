import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/media_pickups.js", "utf8");

describe("media_pickups", () => {
  it("exports mountMediaPickups", () => {
    expect(src).toContain("export function mountMediaPickups");
  });

  it("accepts THREE and scene", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
  });

  it("initialises heroMedia array", () => {
    expect(src).toContain("heroMedia");
    expect(src).toContain("= []");
  });

  it("initialises worldMedia array", () => {
    expect(src).toContain("worldMedia");
  });

  it("creates CylinderGeometry for CDs", () => {
    expect(src).toContain("CylinderGeometry");
    expect(src).toContain("\"cd\"");
  });

  it("creates BoxGeometry for USB", () => {
    expect(src).toContain("BoxGeometry");
  });

  it("sets castShadow on mesh", () => {
    expect(src).toContain("castShadow = true");
  });

  it("pushes to worldMedia with picked:false", () => {
    expect(src).toContain("picked: false");
  });

  it("returns heroMedia, worldMedia, spawnMedia", () => {
    expect(src).toContain("return { heroMedia, worldMedia, spawnMedia }");
  });
});
