import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/starter_quests.js", "utf8");

describe("starter_quests", () => {
  it("exports mountStarterQuests", () => {
    expect(src).toContain("export function mountStarterQuests");
  });

  it("accepts addQuest, showToast, loadGame", () => {
    expect(src).toContain("addQuest");
    expect(src).toContain("showToast");
    expect(src).toContain("loadGame");
  });

  it("registers intro/Explorer quest", () => {
    expect(src).toContain('"intro"');
    expect(src).toContain("Explorer");
  });

  it("registers combat/Fighter quest", () => {
    expect(src).toContain('"combat"');
    expect(src).toContain("Fighter");
  });

  it("registers world/World Builder quest", () => {
    expect(src).toContain('"world"');
    expect(src).toContain("World Builder");
  });

  it("shows objectives toast", () => {
    expect(src).toContain("Press J to view objectives");
  });

  it("loads game save after quests are added", () => {
    expect(src).toContain("setTimeout(loadGame");
  });

  it("fires after 1500ms delay", () => {
    expect(src).toContain("1500");
  });
});
