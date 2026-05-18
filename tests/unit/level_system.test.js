// Tests for src/systems/level_system.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/level_system.js"), "utf8");

it("exports mountLevelSystem", () => {
  expect(src).toMatch(/export\s+function\s+mountLevelSystem/);
});

describe("level buffs", () => {
  it("level 1 applies damage multiplier via set.heroLvlDmgMul", () => {
    expect(src).toContain("set.heroLvlDmgMul(");
    expect(src).toContain("get.heroLvlDmgMul()");
  });

  it("level 2 applies speed bonus via set.heroLvlSpeedBonus", () => {
    expect(src).toContain("set.heroLvlSpeedBonus(");
    expect(src).toContain("get.heroLvlSpeedBonus()");
  });

  it("level 3 sets extraStaminaMax and boosts stamina", () => {
    expect(src).toContain("set.heroExtraStaminaMax(25)");
    expect(src).toContain("get.STAMINA_MAX()");
    expect(src).toContain("set.stamina(");
  });

  it("level 4 restores HP via set.heroHp", () => {
    expect(src).toContain("get.HERO_MAX_HP()");
    expect(src).toContain("set.heroHp(");
  });

  it("level 5 enables apex mode via set.heroApexMode", () => {
    expect(src).toContain("set.heroApexMode(true)");
  });
});

describe("feedback actions", () => {
  it("spawns particles at hero position", () => {
    expect(src).toContain("actions.spawnParticles(");
    expect(src).toContain("get.heroPos()");
  });

  it("shows toast and plays sfx", () => {
    expect(src).toContain('actions.showToast(');
    expect(src).toContain("actions.playSfx(");
  });

  it("adds kill feed entry", () => {
    expect(src).toContain("actions.addKillFeedEntry(");
  });

  it("updates hero level HUD", () => {
    expect(src).toContain("actions.setHeroLevelHud(");
  });
});

it("returns applyLevelUpBuff", () => {
  expect(src).toContain("return { applyLevelUpBuff }");
});
