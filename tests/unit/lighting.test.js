import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/lighting.js", "utf8");

describe("lighting", () => {
  it("exports mountLighting", () => {
    expect(src).toContain("export function mountLighting");
  });

  it("returns ambLight and sun", () => {
    expect(src).toContain("return { ambLight, sun }");
  });

  it("creates AmbientLight 0xffffff intensity 0.9", () => {
    expect(src).toContain("AmbientLight(0xffffff, 0.9)");
    expect(src).toContain("window._ambLight = ambLight");
  });

  it("creates DirectionalLight with shadow map 2048x2048", () => {
    expect(src).toContain("DirectionalLight(0xffffff, 1.1)");
    expect(src).toContain("sun.castShadow = true");
    expect(src).toContain("sun.shadow.mapSize.set(2048, 2048)");
    expect(src).toContain("window._sunLight = sun");
  });

  it("sets sun shadow camera frustum ±40", () => {
    expect(src).toContain("sun.shadow.camera.left");
    expect(src).toContain("-40");
    expect(src).toContain("40");
  });

  it("initialises DayNight with typeof guard and passes renderer", () => {
    expect(src).toContain('typeof DayNight !== "undefined"');
    expect(src).toContain("DayNight.init(");
    expect(src).toContain("renderer,");
    expect(src).toContain('Engine.addCommand("hour"');
    expect(src).toContain('Engine.addCommand("dayspeed"');
  });

  it("exposes window._renderer and window._scene globals", () => {
    expect(src).toContain("window._renderer = renderer");
    expect(src).toContain("window._scene    = scene");
  });
});
