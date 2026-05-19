import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/vfx_init.js", "utf8");

describe("vfx_init", () => {
  it("exports mountVfxInit", () => {
    expect(src).toContain("export function mountVfxInit");
  });

  it("accepts THREE, scene, camera, Vfx, warnRingGeo, warnRingMat", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
    expect(src).toContain("camera");
    expect(src).toContain("Vfx");
    expect(src).toContain("warnRingGeo");
    expect(src).toContain("warnRingMat");
  });

  it("calls Vfx.init with THREE, scene, camera", () => {
    expect(src).toContain("Vfx.init(THREE, scene, camera)");
  });

  it("binds spawnParticles", () => {
    expect(src).toContain("_spawnParticles");
    expect(src).toContain("spawnParticles.bind");
  });

  it("binds ejectCasing", () => {
    expect(src).toContain("_ejectCasing");
    expect(src).toContain("ejectCasing.bind");
  });

  it("binds triggerMuzzleFlash", () => {
    expect(src).toContain("_triggerMuzzleFlash");
    expect(src).toContain("triggerMuzzleFlash.bind");
  });

  it("binds spawnShockwave", () => {
    expect(src).toContain("_spawnShockwave");
    expect(src).toContain("spawnShockwave.bind");
  });

  it("returns all seven aliases", () => {
    expect(src).toContain("_warnRingGeo");
    expect(src).toContain("_warnRingMat");
    expect(src).toContain("_spawnParticles");
    expect(src).toContain("_ejectCasing");
    expect(src).toContain("_spawnDamageNumber");
    expect(src).toContain("_triggerMuzzleFlash");
    expect(src).toContain("_spawnShockwave");
  });
});
