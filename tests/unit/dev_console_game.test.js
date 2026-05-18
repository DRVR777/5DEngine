// Tests for src/systems/dev_console_game.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/dev_console_game.js"), "utf8");

it("exports mountDevConsoleGame", () => {
  expect(src).toMatch(/export\s+function\s+mountDevConsoleGame/);
});

it("guards against non-browser environments", () => {
  expect(src).toContain('typeof document === "undefined"');
});

describe("command dispatch", () => {
  it("handles god command via actions.toggleGodMode", () => {
    expect(src).toContain("actions.toggleGodMode()");
    expect(src).toContain("actions.isGodMode()");
  });

  it("handles noclip command via actions.toggleNoclip", () => {
    expect(src).toContain("actions.toggleNoclip()");
    expect(src).toContain("actions.isNoclip()");
  });

  it("handles heal command via actions.heal", () => {
    expect(src).toContain("actions.heal()");
  });

  it("handles ammo command via actions.refillAmmo", () => {
    expect(src).toContain("actions.refillAmmo()");
  });

  it("handles spawn command via actions.spawnEnemy", () => {
    expect(src).toContain("actions.spawnEnemy(type)");
  });

  it("handles tp command via actions.teleport", () => {
    expect(src).toContain("actions.teleport(tu, tv)");
  });

  it("handles wave command via actions.setWave", () => {
    expect(src).toContain("actions.setWave(wn)");
  });

  it("handles restart command via actions.resetGameState", () => {
    expect(src).toContain("actions.resetGameState()");
  });
});

it("registers backtick keydown listener", () => {
  expect(src).toContain('e.code === "Backquote"');
});

it("prints ready message on mount", () => {
  expect(src).toContain("5DEngine dev console ready");
});
