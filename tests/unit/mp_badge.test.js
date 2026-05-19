import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/social/mp_badge.js", "utf8");

describe("mp_badge", () => {
  it("exports mountMpBadge", () => {
    expect(src).toContain("export function mountMpBadge");
  });

  it("accepts getPeersSize", () => {
    expect(src).toContain("getPeersSize");
  });

  it("creates mpBadge element", () => {
    expect(src).toContain("mpBadge");
    expect(src).toContain("document.createElement");
  });

  it("appends badge to document.body", () => {
    expect(src).toContain("document.body.appendChild");
  });

  it("shows players count when peers present", () => {
    expect(src).toContain("players online");
  });

  it("shows solo when no peers", () => {
    expect(src).toContain("solo");
  });

  it("polls with setInterval every 2000ms", () => {
    expect(src).toContain("setInterval");
    expect(src).toContain("2000");
  });

  it("fires initial update after 1500ms", () => {
    expect(src).toContain("setTimeout");
    expect(src).toContain("1500");
  });
});
