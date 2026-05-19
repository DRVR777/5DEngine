import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/vehicle_meshes.js", "utf8");

describe("vehicle_meshes", () => {
  it("exports mountVehicleMeshes", () => {
    expect(src).toContain("export function mountVehicleMeshes");
  });

  it("accepts THREE, scene, vehicleDefs, makeVehicleMesh", () => {
    expect(src).toContain("THREE");
    expect(src).toContain("scene");
    expect(src).toContain("vehicleDefs");
    expect(src).toContain("makeVehicleMesh");
  });

  it("builds a Map of vehicle meshes", () => {
    expect(src).toContain("new Map()");
    expect(src).toContain("vehicleMeshes.set(vDef.id");
  });

  it("adds each group to scene", () => {
    expect(src).toContain("scene.add(grp)");
  });

  it("returns vehicleMeshes, carGroup, carBody", () => {
    expect(src).toContain("vehicleMeshes");
    expect(src).toContain("carGroup");
    expect(src).toContain("carBody");
    expect(src).toContain("return { vehicleMeshes, carGroup, carBody }");
  });

  it("falls back to new THREE.Group() when first vehicle missing", () => {
    expect(src).toContain("new THREE.Group()");
  });

  it("resolves carBody from _bodyMesh or group", () => {
    expect(src).toContain("_bodyMesh");
  });
});
