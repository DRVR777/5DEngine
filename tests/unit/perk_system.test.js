// Tests for src/systems/perk_system.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/perk_system.js"), "utf8");

it("exports mountPerkSystem", () => {
  expect(src).toMatch(/export\s+function\s+mountPerkSystem/);
});

it("guards document access", () => {
  expect(src).toContain('typeof document === "undefined"');
});

describe("dependencies", () => {
  it("accepts Inv", () => { expect(src).toContain("Inv,"); });
  it("accepts get", () => { expect(src).toContain("get,"); });
  it("accepts set", () => { expect(src).toContain("set,"); });
  it("accepts actions", () => { expect(src).toContain("actions,"); });
});

describe("PERKS array", () => {
  it("has dmg perk using set.perkDmgMul", () => {
    expect(src).toContain("set.perkDmgMul(get.perkDmgMul()");
  });

  it("has speed perk using set.perkSpeedBonus", () => {
    expect(src).toContain("set.perkSpeedBonus(");
  });

  it("has regen perk using set.perkRegenBonus", () => {
    expect(src).toContain("set.perkRegenBonus(");
  });

  it("has reload perk using set.perkReloadMul", () => {
    expect(src).toContain("set.perkReloadMul(get.perkReloadMul()");
  });

  it("has maxhp perk using set.perkMaxHpBonus and set.heroHp", () => {
    expect(src).toContain("set.perkMaxHpBonus(");
    expect(src).toContain("set.heroHp(");
  });

  it("has grenades perk using set.grenadeCount", () => {
    expect(src).toContain("set.grenadeCount(");
  });

  it("has smoke perk using set.smokeGrenadeCount", () => {
    expect(src).toContain("set.smokeGrenadeCount(");
  });

  it("has armor perk using set.heroArmor", () => {
    expect(src).toContain("set.heroArmor(");
  });

  it("has vampire perk using set.perkLifesteal", () => {
    expect(src).toContain("set.perkLifesteal(true)");
  });

  it("has ammo perk using Inv.addItem", () => {
    expect(src).toContain("Inv.addItem(");
  });
});

describe("showPerkPicker", () => {
  it("picks 3 random perks from PERKS pool", () => {
    expect(src).toContain("Math.random() - 0.5");
    expect(src).toContain(".slice(0, 3)");
  });

  it("starts a 10-second timer", () => {
    expect(src).toContain("let secs = 10");
  });

  it("auto-applies a random perk on timeout", () => {
    expect(src).toContain("secs <= 0");
    expect(src).toContain("applyPerk(pool[Math.floor(Math.random()");
  });
});

describe("applyPerk", () => {
  it("clears the timer and hides the overlay", () => {
    expect(src).toContain("clearInterval(_perkTimerInt)");
    expect(src).toContain('overlay.style.display = "none"');
  });

  it("pushes to activePerkLabels", () => {
    expect(src).toContain("activePerkLabels.push(");
  });

  it("calls actions.showToast and actions.addKillFeedEntry", () => {
    expect(src).toContain("actions.showToast(");
    expect(src).toContain("actions.addKillFeedEntry(");
  });
});

describe("clearTimerAndReset", () => {
  it("clears interval and empties activePerkLabels", () => {
    expect(src).toContain("activePerkLabels.length = 0");
    expect(src).toContain("clearTimerAndReset");
  });
});

it("returns showPerkPicker, refreshPerkHud, applyPerk, clearTimerAndReset, activePerkLabels", () => {
  expect(src).toContain("showPerkPicker, refreshPerkHud, applyPerk, clearTimerAndReset, activePerkLabels");
});
