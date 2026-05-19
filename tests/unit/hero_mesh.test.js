import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/hero_mesh.js", "utf8");

describe("hero_mesh", () => {
  it("exports mountHeroMesh", () => {
    expect(src).toContain("export function mountHeroMesh");
  });

  it("returns heroGroup, limb parts, walkState, shadowBlob", () => {
    expect(src).toContain("return { heroGroup, thighL, shinL, thighR, shinR, armL, armR, walkState, shadowBlob }");
  });

  it("heroGroup is added to scene", () => {
    expect(src).toContain("scene.add(heroGroup)");
  });

  it("sets window._setHeroScale on heroGroup", () => {
    expect(src).toContain("window._setHeroScale");
    expect(src).toContain("heroGroup.scale.setScalar");
  });

  it("body uses skin/pants/shirt materials", () => {
    expect(src).toContain("0xffcc66"); // skin
    expect(src).toContain("0x223377"); // pants
    expect(src).toContain("0xff5533"); // shirt
  });

  it("makeTwoSegLeg builds thigh + shin with knee pivot", () => {
    expect(src).toContain("makeTwoSegLeg");
    expect(src).toContain("BoxGeometry(0.21, 0.43, 0.21)");
    expect(src).toContain("BoxGeometry(0.18, 0.42, 0.18)");
    expect(src).toContain("shin.position.y = -0.43");
  });

  it("shadow blob is CircleGeometry with DoubleSide and opacity 0.28", () => {
    expect(src).toContain("CircleGeometry(0.45, 16)");
    expect(src).toContain("opacity: 0.28");
    expect(src).toContain("THREE.DoubleSide");
    expect(src).toContain("shadowBlob.rotation.x = -Math.PI / 2");
  });

  it("walkState initializes to { t: 0 }", () => {
    expect(src).toContain("const walkState = { t: 0 }");
  });
});
