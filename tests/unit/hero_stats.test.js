import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/config/hero_stats.js", "utf8");

describe("hero_stats", () => {
  it("exports HERO_MAX_ARMOR = 75", () => {
    expect(src).toContain("export const HERO_MAX_ARMOR");
    expect(src).toContain("75");
  });

  it("exports ARMOR_ABSORB = 0.6", () => {
    expect(src).toContain("export const ARMOR_ABSORB");
    expect(src).toContain("0.6");
  });

  it("exports DODGE_DURATION, DODGE_SPEED, DODGE_COOLDOWN", () => {
    expect(src).toContain("export const DODGE_DURATION");
    expect(src).toContain("export const DODGE_SPEED");
    expect(src).toContain("export const DODGE_COOLDOWN");
  });

  it("exports makeHeroStats function", () => {
    expect(src).toContain("export function makeHeroStats");
  });

  it("makeHeroStats derives HERO_MAX_HP from CFG.heroMaxHp with fallback 100", () => {
    expect(src).toContain("CFG.heroMaxHp");
    expect(src).toContain("|| 100");
    expect(src).toContain("HERO_MAX_HP");
  });

  it("makeHeroStats derives regen delay and rate from CFG", () => {
    expect(src).toContain("CFG.heroRegenDelay");
    expect(src).toContain("CFG.heroRegenRate");
    expect(src).toContain("HERO_REGEN_DELAY");
    expect(src).toContain("HERO_REGEN_RATE");
  });

  it("exports STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, STAMINA_LOCKOUT", () => {
    expect(src).toContain("export const STAMINA_MAX");
    expect(src).toContain("export const STAMINA_DRAIN");
    expect(src).toContain("export const STAMINA_REGEN");
    expect(src).toContain("export const STAMINA_LOCKOUT");
  });
});
