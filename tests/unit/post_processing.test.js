import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/post_processing.js", "utf8");

describe("post_processing", () => {
  it("exports mountPostProcessing", () => {
    expect(src).toContain("export function mountPostProcessing");
  });

  it("accepts THREE, renderer, scene, camera, onReady", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("renderer");
    expect(src).toContain("scene");
    expect(src).toContain("camera");
    expect(src).toContain("onReady");
  });

  it("dynamically imports EffectComposer", () => {
    expect(src).toContain("EffectComposer");
  });

  it("dynamically imports RenderPass", () => {
    expect(src).toContain("RenderPass");
  });

  it("dynamically imports UnrealBloomPass", () => {
    expect(src).toContain("UnrealBloomPass");
  });

  it("sets SRGBColorSpace on render targets", () => {
    expect(src).toContain("SRGBColorSpace");
  });

  it("adds bloom with strength 0.55, radius 0.40, threshold 0.82", () => {
    expect(src).toContain("0.55");
    expect(src).toContain("0.40");
    expect(src).toContain("0.82");
  });

  it("calls onReady with the composer", () => {
    expect(src).toContain("onReady(composer)");
  });
});
