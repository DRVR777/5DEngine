import { describe, it, expect } from "vitest";
import { parseLastGoodCommit, isCommitStale, buildFallbackMessage } from "../../scripts/update_logic.js";

describe("parseLastGoodCommit", () => {
  it("parses a clean SHA", () => {
    expect(parseLastGoodCommit("abc1234def\n")).toBe("abc1234def");
  });
  it("strips leading and trailing whitespace", () => {
    expect(parseLastGoodCommit("  def5678  \n")).toBe("def5678");
  });
  it("takes only the first line when multi-line", () => {
    expect(parseLastGoodCommit("aaa111\nbbb222\n")).toBe("aaa111");
  });
  it("returns empty string for empty input", () => {
    expect(parseLastGoodCommit("")).toBe("");
  });
  it("returns empty string for null input", () => {
    expect(parseLastGoodCommit(null)).toBe("");
  });
  it("returns empty string for whitespace-only input", () => {
    expect(parseLastGoodCommit("   \n  ")).toBe("");
  });
});

describe("isCommitStale", () => {
  it("returns false when local equals remote", () => {
    expect(isCommitStale("abc123", "abc123")).toBe(false);
  });
  it("returns true when local differs from remote", () => {
    expect(isCommitStale("abc123", "def456")).toBe(true);
  });
  it("returns true when local is empty string", () => {
    expect(isCommitStale("", "def456")).toBe(true);
  });
  it("returns true when remote is ahead by even one char", () => {
    expect(isCommitStale("abc123", "abc124")).toBe(true);
  });
});

describe("buildFallbackMessage", () => {
  it("includes the first 8 characters of the SHA", () => {
    const msg = buildFallbackMessage("abcdef1234567890");
    expect(msg).toContain("abcdef12");
  });
  it("does not include characters beyond position 8", () => {
    const msg = buildFallbackMessage("abcdef1234567890");
    expect(msg).not.toContain("34567890");
  });
  it("mentions fallback intent", () => {
    const msg = buildFallbackMessage("abcdef1234567890");
    expect(msg.toLowerCase()).toMatch(/fall.?back|known.good/);
  });
  it("works on a short SHA", () => {
    const msg = buildFallbackMessage("abc");
    expect(msg).toContain("abc");
  });
});
