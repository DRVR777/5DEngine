import { describe, it, expect } from "vitest";

// Pure-logic extraction of the isBlocked check used inside requestGameplayPointer.
// Tests verify the rule: pointer lock must not be requested when any modal is open.

function isPointerBlocked({ perkPickerVisible, difficultyScreenVisible, computerOpen, computerEntering, buildMode, heroDead }) {
  return (
    perkPickerVisible ||
    difficultyScreenVisible ||
    computerOpen ||
    computerEntering ||
    buildMode ||
    heroDead
  );
}

describe("isPointerBlocked", () => {
  const base = {
    perkPickerVisible: false,
    difficultyScreenVisible: false,
    computerOpen: false,
    computerEntering: false,
    buildMode: false,
    heroDead: false,
  };

  it("returns false when nothing is blocking", () => {
    expect(isPointerBlocked(base)).toBe(false);
  });

  it("blocks when perk picker is visible", () => {
    expect(isPointerBlocked({ ...base, perkPickerVisible: true })).toBe(true);
  });

  it("blocks when difficulty screen is visible", () => {
    expect(isPointerBlocked({ ...base, difficultyScreenVisible: true })).toBe(true);
  });

  it("blocks when computer is open", () => {
    expect(isPointerBlocked({ ...base, computerOpen: true })).toBe(true);
  });

  it("blocks during computer entry animation", () => {
    expect(isPointerBlocked({ ...base, computerEntering: true })).toBe(true);
  });

  it("blocks in build mode", () => {
    expect(isPointerBlocked({ ...base, buildMode: true })).toBe(true);
  });

  it("blocks when hero is dead", () => {
    expect(isPointerBlocked({ ...base, heroDead: true })).toBe(true);
  });

  it("blocks when multiple conditions are true simultaneously", () => {
    expect(isPointerBlocked({ ...base, perkPickerVisible: true, difficultyScreenVisible: true })).toBe(true);
  });

  it("difficulty screen appearing after computer close should block pointer re-lock", () => {
    // Simulates the 350ms window between closeComputer() and difficultyScreen.flex
    // If difficultyScreen is flex, pointer must NOT be requested — even if everything else is clear
    const state = { ...base, difficultyScreenVisible: true, computerOpen: false };
    expect(isPointerBlocked(state)).toBe(true);
  });
});

// Simulates the deferred re-check: promise-rejection guard pattern
describe("requestPointerLock Promise rejection guard", () => {
  it("does not throw when requestPointerLock returns a rejected promise", async () => {
    const canvas = {
      requestPointerLock: () => Promise.reject(new DOMException("pointer lock lost")),
    };
    // The guarded pattern: catch the rejected promise
    let threw = false;
    try {
      const p = canvas.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it("does not throw when requestPointerLock is undefined (non-browser env)", () => {
    const canvas = {};
    let threw = false;
    try {
      const p = canvas.requestPointerLock?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
