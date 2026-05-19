import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/hero_inventory.js", "utf8");

describe("hero_inventory", () => {
  it("exports mountHeroInventory", () => {
    expect(src).toContain("export function mountHeroInventory");
  });

  it("accepts Inv, Health, CFG", () => {
    expect(src).toContain("Inv");
    expect(src).toContain("Health");
    expect(src).toContain("CFG");
  });

  it("creates inventory of size 24", () => {
    expect(src).toContain("Inv.makeInventory(24)");
  });

  it("adds weapons and ammo from CFG", () => {
    expect(src).toContain("CFG.weapons");
    expect(src).toContain("gun_");
    expect(src).toContain("ammoItem");
    expect(src).toContain("magCap * 4");
  });

  it("adds 2 medkits", () => {
    expect(src).toContain('"medkit"');
    expect(src).toContain("2");
  });

  it("creates heroHealth from Health.makeHealth", () => {
    expect(src).toContain("Health.makeHealth");
    expect(src).toContain("CFG.heroMaxHp");
  });

  it("returns heroInv and heroHealth", () => {
    expect(src).toContain("return { heroInv, heroHealth }");
  });
});
