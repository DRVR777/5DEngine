import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/pickup_mesh.js", "utf8");

describe("pickup_mesh", () => {
  it("exports mountPickupMeshes", () => {
    expect(src).toContain("export function mountPickupMeshes");
  });

  it("returns pickupMeshes Map", () => {
    expect(src).toContain("return { pickupMeshes }");
    expect(src).toContain("const pickupMeshes = new Map()");
  });

  it("uses gold coin sphere geometry 0.3 radius", () => {
    expect(src).toContain("SphereGeometry(0.3, 12, 12)");
    expect(src).toContain("0xffd700"); // gold
    expect(src).toContain("0x554400"); // dark emissive
    expect(src).toContain("metalness: 0.6");
  });

  it("places each pickup mesh at y=1.0 with castShadow", () => {
    expect(src).toContain("m.position.set(pk.u, 1.0, pk.v)");
    expect(src).toContain("m.castShadow = true");
  });

  it("maps pk.id to mesh and adds to scene", () => {
    expect(src).toContain("pickupMeshes.set(pk.id, m)");
    expect(src).toContain("scene.add(m)");
  });
});
