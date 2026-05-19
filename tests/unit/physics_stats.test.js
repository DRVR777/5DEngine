import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/config/physics_stats.js", "utf8");

describe("physics_stats", () => {
  it("exports FIXED_DT", () => {
    expect(src).toContain("export const FIXED_DT");
  });

  it("FIXED_DT is 1/60 Hz", () => {
    expect(src).toContain("1 / 60");
  });
});
