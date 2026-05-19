import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/bullet_geo.js", "utf8");

describe("bullet_geo", () => {
  it("exports mountBulletGeo", () => {
    expect(src).toContain("export function mountBulletGeo");
  });

  it("accepts THREE", () => {
    expect(src).toContain("THREE");
  });

  it("creates BoxGeometry with tracer dimensions", () => {
    expect(src).toContain("BoxGeometry");
    expect(src).toContain("0.025");
    expect(src).toContain("0.28");
  });

  it("creates MeshBasicMaterial in bright yellow", () => {
    expect(src).toContain("MeshBasicMaterial");
    expect(src).toContain("0xffff00");
  });

  it("returns bulletGeo and bulletMat", () => {
    expect(src).toContain("return { bulletGeo, bulletMat }");
  });
});
