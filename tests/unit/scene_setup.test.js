import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/scene_setup.js", "utf8");

describe("scene_setup", () => {
  it("exports mountScene", () => {
    expect(src).toContain("export function mountScene");
  });

  it("accepts THREE", () => {
    expect(src).toContain("THREE");
  });

  it("creates a Scene", () => {
    expect(src).toContain("new THREE.Scene()");
  });

  it("sets sky-blue background", () => {
    expect(src).toContain("scene.background = new THREE.Color");
    expect(src).toContain("0x87ceeb");
  });

  it("creates Fog with sky-blue color", () => {
    expect(src).toContain("new THREE.Fog");
    expect(src).toContain("0x87ceeb");
  });

  it("returns scene", () => {
    expect(src).toContain("return { scene }");
  });
});
