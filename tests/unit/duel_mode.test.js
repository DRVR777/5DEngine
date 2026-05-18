// Tests for src/systems/duel_mode.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/duel_mode.js"), "utf8");

it("exports mountDuelMode", () => {
  expect(src).toMatch(/export\s+function\s+mountDuelMode/);
});

describe("public API", () => {
  it("returns startDuel, acceptDuel, declineDuel, cancelDuel", () => {
    expect(src).toContain("function startDuel(opponentId)");
    expect(src).toContain("function acceptDuel(fromId)");
    expect(src).toContain("function declineDuel(fromId)");
    expect(src).toContain("function cancelDuel()");
  });

  it("returns isDueling, getPendingChallenge, getDuelState", () => {
    expect(src).toContain("function isDueling()");
    expect(src).toContain("function getPendingChallenge()");
    expect(src).toContain("function getDuelState()");
  });
});

describe("round management", () => {
  it("uses TOTAL_ROUNDS = 10", () => {
    expect(src).toContain("TOTAL_ROUNDS  = 10");
  });

  it("has ROUND_TIMEOUT constant", () => {
    expect(src).toContain("ROUND_TIMEOUT = 90");
  });

  it("advances round after kill via _advanceRound", () => {
    expect(src).toContain("function _advanceRound(winnerId)");
  });

  it("ends match when all rounds played", () => {
    expect(src).toContain("_state.round >= TOTAL_ROUNDS");
    expect(src).toContain("function _endMatch()");
  });
});

describe("event routing", () => {
  it("listens for incoming_hit from mp", () => {
    expect(src).toContain('mp.onEvent("incoming_hit"');
  });

  it("listens for duel_challenge from mp", () => {
    expect(src).toContain('mp.onEvent("duel_challenge"');
  });

  it("listens for duel_accept from mp", () => {
    expect(src).toContain('mp.onEvent("duel_accept"');
  });

  it("listens for duel_round_end from mp", () => {
    expect(src).toContain('mp.onEvent("duel_round_end"');
  });

  it("cancels on player_left", () => {
    expect(src).toContain('mp.onEvent("player_left"');
  });
});

describe("feedback actions", () => {
  it("calls actions.showToast on hit", () => {
    expect(src).toContain("actions.showToast(");
  });

  it("calls actions.playSfx on round events", () => {
    expect(src).toContain("actions.playSfx(");
  });

  it("calls actions.addKillFeedEntry on match end", () => {
    expect(src).toContain("actions.addKillFeedEntry(");
  });
});

describe("HUD", () => {
  it("creates duelHud overlay element", () => {
    expect(src).toContain('"duelHud"');
  });

  it("has _renderHud function", () => {
    expect(src).toContain("function _renderHud()");
  });

  it("hides HUD on match end", () => {
    expect(src).toContain("_hideHud()");
  });
});
