import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/computer_mesh.js", "utf8");

describe("computer_mesh", () => {
  it("exports mountComputerMesh", () => {
    expect(src).toContain("export function mountComputerMesh");
  });

  it("returns compGroup", () => {
    expect(src).toContain("return { compGroup }");
  });

  it("desk box is BoxGeometry 1.6x1.2x0.6 dark gray at y=0.6", () => {
    expect(src).toContain("BoxGeometry(1.6, 1.2, 0.6)");
    expect(src).toContain("0x333333");
    expect(src).toContain("deskBox.position.y = 0.6");
    expect(src).toContain("deskBox.castShadow = true");
  });

  it("screen front is PlaneGeometry 1.0x0.7 cyan at z=0.31", () => {
    expect(src).toContain("PlaneGeometry(1.0, 0.7)");
    expect(src).toContain("0x44ccff");
    expect(src).toContain("screenFront.position.set(0, 1.0, 0.31)");
  });

  it("positions compGroup at computerEntity.u/v and adds to scene", () => {
    expect(src).toContain("compGroup.position.set(computerEntity.u, 0, computerEntity.v)");
    expect(src).toContain("scene.add(compGroup)");
  });
});
