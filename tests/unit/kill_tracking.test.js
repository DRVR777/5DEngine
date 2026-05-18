// Tests for src/systems/kill_tracking.js
import { it, expect, describe } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(__dir, "../../src/systems/kill_tracking.js"), "utf8");

it("exports mountKillTracking", () => {
  expect(src).toMatch(/export\s+function\s+mountKillTracking/);
});

it("exports COIN_BY_TYPE as named const", () => {
  expect(src).toMatch(/export\s+const\s+COIN_BY_TYPE/);
});

describe("COIN_BY_TYPE entries", () => {
  it("includes grunt, fast, heavy, boss", () => {
    expect(src).toContain("grunt: 1");
    expect(src).toContain("heavy: 4");
    expect(src).toContain("boss: 30");
  });
});

describe("dependencies", () => {
  it("accepts enemies and world", () => {
    expect(src).toContain("enemies,");
    expect(src).toContain("world,");
  });

  it("accepts get.perkLifesteal", () => { expect(src).toContain("get.perkLifesteal()"); });
  it("accepts get.heroDead", () => { expect(src).toContain("get.heroDead()"); });
  it("accepts get.heroHp", () => { expect(src).toContain("get.heroHp()"); });
  it("accepts get.HERO_MAX_HP", () => { expect(src).toContain("get.HERO_MAX_HP()"); });
  it("accepts get.perkMaxHpBonus", () => { expect(src).toContain("get.perkMaxHpBonus()"); });
  it("accepts set.heroHp", () => { expect(src).toContain("set.heroHp("); });
});

describe("trackKillAndPanic", () => {
  it("applies lifesteal when perk active", () => {
    expect(src).toContain("get.perkLifesteal()");
    expect(src).toContain("+3 HP");
  });

  it("calls spawnDamageNumber for lifesteal", () => {
    expect(src).toContain("actions.spawnDamageNumber(");
  });

  it("tracks recent kill positions within 4s window", () => {
    expect(src).toContain("_recentKillPos.push(");
    expect(src).toContain("t - k.t < 4.0");
  });

  it("broadcasts rout when 3+ kills nearby", () => {
    expect(src).toContain("_recentKillPos.length >= 3");
    expect(src).toContain("actions.addKillFeedEntry(");
    expect(src).toContain("ROUTING!");
  });

  it("sets _panicT on nearby enemies", () => {
    expect(src).toContain("en2._panicT = 3.0");
  });
});

describe("resetPanic", () => {
  it("exported and clears state", () => {
    expect(src).toContain("function resetPanic()");
    expect(src).toContain("_recentKillPos = []");
    expect(src).toContain("_panicBroadcastT = -99");
  });
});

it("returns trackKillAndPanic and resetPanic", () => {
  expect(src).toContain("return { trackKillAndPanic, resetPanic }");
});
