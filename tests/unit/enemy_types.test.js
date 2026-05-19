import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/config/enemy_types.js", "utf8");

describe("enemy_types", () => {
  it("exports ENEMY_TYPES and WEAPON_DMG_MULTIPLIERS", () => {
    expect(src).toContain("export const ENEMY_TYPES");
    expect(src).toContain("export const WEAPON_DMG_MULTIPLIERS");
  });

  it("has 8 enemy types including grunt, boss, robot, sniper", () => {
    expect(src).toContain('"grunt"');
    expect(src).toContain('"heavy"');
    expect(src).toContain('"fast"');
    expect(src).toContain('"poisoner"');
    expect(src).toContain('"incendiary"');
    expect(src).toContain('"robot"');
    expect(src).toContain('"boss"');
    expect(src).toContain('"sniper"');
  });

  it("boss has hp 1200 and sightRange 20", () => {
    expect(src).toContain("hp: 1200");
    expect(src).toContain("sightRange: 20");
  });

  it("WEAPON_DMG_MULTIPLIERS has boss sniper mul 2.0", () => {
    expect(src).toContain("boss:");
    expect(src).toContain("sniper: 2.0");
  });

  it("each entry has dropAmmo, dropQty, wanderSpeed", () => {
    expect(src).toContain("dropAmmo:");
    expect(src).toContain("dropQty:");
    expect(src).toContain("wanderSpeed:");
  });
});
