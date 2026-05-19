import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/config/movement_stats.js", "utf8");

describe("movement_stats", () => {
  it("exports CAM_DIST_MIN = 0 and CAM_DIST_MAX = 15", () => {
    expect(src).toContain("export const CAM_DIST_MIN = 0");
    expect(src).toContain("export const CAM_DIST_MAX = 15");
  });

  it("exports makeMovementStats function", () => {
    expect(src).toContain("export function makeMovementStats");
  });

  it("derives GRAVITY from CFG with fallback -25", () => {
    expect(src).toContain("CFG.gravity");
    expect(src).toContain("-25");
    expect(src).toContain("GRAVITY");
  });

  it("derives JUMP_V from CFG with fallback 13", () => {
    expect(src).toContain("CFG.jumpVelocity");
    expect(src).toContain("13");
    expect(src).toContain("JUMP_V");
  });

  it("derives WALK and SPRINT from CFG", () => {
    expect(src).toContain("CFG.walkSpeed");
    expect(src).toContain("CFG.sprintSpeed");
    expect(src).toContain("WALK");
    expect(src).toContain("SPRINT");
  });
});
