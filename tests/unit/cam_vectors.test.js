import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/cam_vectors.js", "utf8");

describe("cam_vectors", () => {
  it("exports mountCamVectors", () => {
    expect(src).toContain("export function mountCamVectors");
  });

  it("accepts THREE", () => {
    expect(src).toContain("THREE");
  });

  it("creates _camTarget Vector3", () => {
    expect(src).toContain("_camTarget");
    expect(src).toContain("new THREE.Vector3()");
  });

  it("creates _camOff Vector3", () => {
    expect(src).toContain("_camOff");
  });

  it("creates _camLook Vector3", () => {
    expect(src).toContain("_camLook");
  });

  it("creates _camAimTarget Vector3", () => {
    expect(src).toContain("_camAimTarget");
  });

  it("creates _camBuildLook Vector3", () => {
    expect(src).toContain("_camBuildLook");
  });

  it("returns all five vectors", () => {
    expect(src).toContain("return { _camTarget, _camOff, _camLook, _camAimTarget, _camBuildLook }");
  });
});
