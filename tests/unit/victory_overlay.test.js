import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/victory_overlay.js", "utf8");

describe("victory_overlay", () => {
  it("exports mountVictoryPlayAgain", () => {
    expect(src).toContain("export function mountVictoryPlayAgain");
  });

  it("accepts resetGameState", () => {
    expect(src).toContain("resetGameState");
  });

  it("looks for victoryPlayAgain button", () => {
    expect(src).toContain("victoryPlayAgain");
  });

  it("guards against missing button", () => {
    expect(src).toContain("if (!btn) return");
  });

  it("registers click handler on the button", () => {
    expect(src).toContain("addEventListener");
    expect(src).toContain('"click"');
  });

  it("hides victoryOverlay element on click", () => {
    expect(src).toContain("victoryOverlay");
    expect(src).toContain('display = "none"');
  });

  it("calls resetGameState on click", () => {
    expect(src).toContain("resetGameState()");
  });
});
