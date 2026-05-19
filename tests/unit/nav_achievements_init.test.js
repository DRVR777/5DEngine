import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/nav_achievements_init.js", "utf8");

describe("nav_achievements_init", () => {
  it("exports mountNavAndAchievements", () => {
    expect(src).toContain("export function mountNavAndAchievements");
  });

  it("accepts WD", () => {
    expect(src).toContain("WD");
  });

  it("calls AStar.build with halfSize 60 and cellSize 1", () => {
    expect(src).toContain("AStar.build");
    expect(src).toContain("halfSize: 60");
    expect(src).toContain("cellSize: 1");
  });

  it("guards AStar call with typeof check", () => {
    expect(src).toContain("typeof AStar");
  });

  it("calls Achievements.wireEventBus", () => {
    expect(src).toContain("Achievements.wireEventBus");
    expect(src).toContain("EventBus");
  });

  it("guards Achievements call with typeof check", () => {
    expect(src).toContain("typeof Achievements");
  });
});
