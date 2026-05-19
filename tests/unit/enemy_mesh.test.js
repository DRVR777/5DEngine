import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/enemy_mesh.js", "utf8");

describe("enemy_mesh", () => {
  it("exports mountEnemyMeshFactory", () => {
    expect(src).toContain("export function mountEnemyMeshFactory");
  });

  it("returns makeEnemyMesh", () => {
    expect(src).toContain("makeEnemyMesh");
  });

  it("builds alert sprite material from canvas texture", () => {
    expect(src).toContain("document.createElement");
    expect(src).toContain("CanvasTexture");
    expect(src).toContain("_alertSpriteMat");
    expect(src).toContain('"!"');
  });

  it("robot enemy uses box geometry with rMat + accMat", () => {
    expect(src).toContain('"robot"');
    expect(src).toContain("0x334455");  // robot grey
    expect(src).toContain("0xff2200");  // red accent
    expect(src).toContain("BoxGeometry(0.84, 0.9, 0.6)");  // torso
  });

  it("boss body radius 0.9, height 2.6", () => {
    expect(src).toContain('"boss"');
    expect(src).toContain("0.9");
    expect(src).toContain("2.6");
  });

  it("non-grunt types get an octahedron type gem above head", () => {
    expect(src).toContain("_typeGem");
    expect(src).toContain("OctahedronGeometry(0.16, 0)");
    expect(src).toContain('"grunt"');
  });

  it("HP bar uses PlaneGeometry with hpBg + hpFg pivot", () => {
    expect(src).toContain("PlaneGeometry(1.0, 0.12)");
    expect(src).toContain("PlaneGeometry(1.0, 0.10)");
    expect(src).toContain("hpPivot");
    expect(src).toContain("0x00cc44");  // green HP bar
  });

  it("returns { group, hpFg, hpPivot }", () => {
    expect(src).toContain("return { group, hpFg, hpPivot }");
  });

  it("alert bubble sprite is named _alertBubble and starts invisible", () => {
    expect(src).toContain('"_alertBubble"');
    expect(src).toContain("alertS.visible = false");
  });
});
