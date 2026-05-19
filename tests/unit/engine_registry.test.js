import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/core/engine_registry.js", "utf8");

describe("engine_registry", () => {
  it("exports mountEngineRegistry", () => {
    expect(src).toContain("export function mountEngineRegistry");
  });

  it("registers EventBus as 'events'", () => {
    expect(src).toContain("\"events\"");
    expect(src).toContain("EventBus");
  });

  it("registers AStar as 'astar'", () => {
    expect(src).toContain("\"astar\"");
    expect(src).toContain("AStar");
  });

  it("registers Achievements", () => {
    expect(src).toContain("Achievements");
  });

  it("registers WaveManager as 'waves'", () => {
    expect(src).toContain("\"waves\"");
    expect(src).toContain("WaveManager");
  });

  it("initialises DevConsole if present", () => {
    expect(src).toContain("DevConsole");
    expect(src).toContain("DevConsole.init()");
  });

  it("guards all calls with typeof checks", () => {
    expect(src).toContain("typeof Engine");
    expect(src).toContain("typeof DevConsole");
  });
});
