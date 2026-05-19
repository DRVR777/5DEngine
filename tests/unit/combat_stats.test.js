import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/config/combat_stats.js", "utf8");

describe("combat_stats", () => {
  it("exports LEVEL_THRESHOLDS array with 5 entries", () => {
    expect(src).toContain("export const LEVEL_THRESHOLDS");
    expect(src).toContain("[10, 20, 30, 40, 50]");
  });

  it("exports STREAK_WINDOW = 5", () => {
    expect(src).toContain("export const STREAK_WINDOW");
    expect(src).toContain("= 5");
  });

  it("exports COMBO_DECAY = 3.5", () => {
    expect(src).toContain("export const COMBO_DECAY");
    expect(src).toContain("3.5");
  });
});
