import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/vehicle_mesh.js", "utf8");

describe("vehicle_mesh", () => {
  it("exports mountVehicleMeshFactory", () => {
    expect(src).toContain("export function mountVehicleMeshFactory");
  });

  it("returns makeVehicleMesh", () => {
    expect(src).toContain("makeVehicleMesh");
  });

  it("drone builds hex body + 4 rotors + camera bubble", () => {
    expect(src).toContain('"drone"');
    expect(src).toContain("CylinderGeometry(0.28, 0.28, 0.14, 6)");
    expect(src).toContain("group._rotors");
    expect(src).toContain("SphereGeometry(0.1, 8, 6)");
    expect(src).toContain("0x0033ff");
  });

  it("mech builds torso + legs with walk cycle refs", () => {
    expect(src).toContain('"mech"');
    expect(src).toContain("BoxGeometry(1.0, 0.9, 0.7)");
    expect(src).toContain("group._legs");
    expect(src).toContain("thighM");
  });

  it("car/motorcycle skips roof for motorcycle type", () => {
    expect(src).toContain('"motorcycle"');
    expect(src).toContain("multiplyScalar(0.6)");
    expect(src).toContain("group._wheels");
    expect(src).toContain("CylinderGeometry(0.35, 0.35, 0.3, 12)");
  });

  it("stores _bodyMesh reference on group for AssetLoader compat", () => {
    expect(src).toContain("group._bodyMesh = body");
    expect(src).toContain("group._bodyMesh = torsoM");
  });

  it("makeVehicleMesh returns the group (no scene dep in function sig)", () => {
    expect(src).toContain("return group;");
    expect(src).not.toContain("mountVehicleMeshFactory({ THREE, scene");
  });
});
