import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/render/npc_mesh.js", "utf8");

describe("npc_mesh", () => {
  it("exports mountNpcMeshFactory", () => {
    expect(src).toContain("export function mountNpcMeshFactory");
  });

  it("returns npcMeshes Map", () => {
    expect(src).toContain("return { npcMeshes }");
    expect(src).toContain("const npcMeshes = new Map()");
  });

  it("uses CapsuleGeometry with correct proportions", () => {
    expect(src).toContain("CapsuleGeometry(0.35, 0.9, 4, 12)");
    expect(src).toContain("b.position.y = 0.85");
    expect(src).toContain("b.castShadow = true");
  });

  it("adds interaction ring with glow material", () => {
    expect(src).toContain("RingGeometry(0.45, 0.60, 24)");
    expect(src).toContain("0x00ffaa"); // glow color
    expect(src).toContain("opacity: 0");
    expect(src).toContain("THREE.DoubleSide");
    expect(src).toContain("ring.rotation.x = -Math.PI / 2");
    expect(src).toContain("ring.position.y = 0.02");
  });

  it("stores { group, heading, ring } in npcMeshes by id", () => {
    expect(src).toContain("npcMeshes.set(n.id, { group: g, heading: n.heading, ring }");
  });

  it("adds each NPC group to scene", () => {
    expect(src).toContain("scene.add(g)");
  });
});
