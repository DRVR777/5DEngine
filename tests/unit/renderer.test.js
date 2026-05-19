import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/renderer.js", "utf8");

describe("renderer", () => {
  it("exports mountRenderer", () => {
    expect(src).toContain("export function mountRenderer");
  });

  it("accepts THREE and getComposer", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("getComposer");
  });

  it("creates WebGLRenderer with antialias", () => {
    expect(src).toContain("WebGLRenderer");
    expect(src).toContain("antialias: true");
  });

  it("enables shadow map with PCFSoft", () => {
    expect(src).toContain("shadowMap.enabled = true");
    expect(src).toContain("PCFSoftShadowMap");
  });

  it("appends renderer.domElement to document.body", () => {
    expect(src).toContain("document.body.appendChild");
    expect(src).toContain("renderer.domElement");
  });

  it("creates PerspectiveCamera 60deg FOV", () => {
    expect(src).toContain("PerspectiveCamera");
    expect(src).toContain("60");
    expect(src).toContain("0.1");
    expect(src).toContain("500");
  });

  it("adds resize listener that calls getComposer", () => {
    expect(src).toContain("addEventListener");
    expect(src).toContain("resize");
    expect(src).toContain("getComposer()");
  });

  it("returns renderer and camera", () => {
    expect(src).toContain("return { renderer, camera }");
  });
});
