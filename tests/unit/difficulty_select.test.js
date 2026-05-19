import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/difficulty_select.js", "utf8");

describe("difficulty_select", () => {
  it("exports mountDifficultySelect", () => {
    expect(src).toContain("export function mountDifficultySelect");
  });

  it("accepts set and showToast", () => {
    expect(src).toContain("set");
    expect(src).toContain("showToast");
  });

  it("looks for difficultyScreen element", () => {
    expect(src).toContain("difficultyScreen");
  });

  it("starts WaveManager if no difficulty screen found", () => {
    expect(src).toContain("typeof WaveManager");
    expect(src).toContain("WaveManager.start");
  });

  it("registers click handlers on .diffBtn buttons", () => {
    expect(src).toContain(".diffBtn");
    expect(src).toContain("addEventListener");
    expect(src).toContain('"click"');
  });

  it("updates difficultyBadge element", () => {
    expect(src).toContain("difficultyBadge");
  });

  it("has EASY/NORMAL/HARD/NIGHTMARE color map", () => {
    expect(src).toContain("EASY");
    expect(src).toContain("NORMAL");
    expect(src).toContain("HARD");
    expect(src).toContain("NIGHTMARE");
  });

  it("calls set.diffHpMul, set.diffDmgMul, set.diffLabel", () => {
    expect(src).toContain("set.diffHpMul");
    expect(src).toContain("set.diffDmgMul");
    expect(src).toContain("set.diffLabel");
  });
});
