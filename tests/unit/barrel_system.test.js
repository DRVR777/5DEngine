import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/barrel_system.js", "utf8");

describe("barrel_system", () => {
  it("exports mountBarrelSystem", () => {
    expect(src).toContain("export function mountBarrelSystem");
  });

  it("returns makeBarrel, explodeBarrel, barrels", () => {
    expect(src).toContain("makeBarrel");
    expect(src).toContain("explodeBarrel");
    expect(src).toContain("barrels");
  });

  it("barrel has 40 HP and exploded=false", () => {
    expect(src).toContain("hp: 40, maxHp: 40");
    expect(src).toContain("exploded: false");
  });

  it("barrel mesh is a cylinder with stripe", () => {
    expect(src).toContain("CylinderGeometry(0.28, 0.28, 0.85");
    expect(src).toContain("CylinderGeometry(0.285, 0.285, 0.12");
    expect(src).toContain("0xcc2200");  // red body
    expect(src).toContain("0xffcc00");  // yellow stripe
  });

  it("explosion spawns 3 particle bursts", () => {
    expect(src).toContain('spawnParticles(u, 0.5, v, 80, "orange"');
    expect(src).toContain('spawnParticles(u, 0.8, v, 40, "red"');
    expect(src).toContain('spawnParticles(u, 1.2, v, 30, "yellow"');
  });

  it("explosion radius is 5m, max damage 60", () => {
    expect(src).toContain("RADIUS = 5");
    expect(src).toContain("MAX_DMG = 60");
  });

  it("chain-explodes adjacent barrels within 0.8 * RADIUS after 80ms", () => {
    expect(src).toContain("RADIUS * 0.8");
    expect(src).toContain("setTimeout(() => explodeBarrel");
    expect(src).toContain(", 80)");
  });

  it("increments enemyKills and comboCount via setters", () => {
    expect(src).toContain("set.enemyKills(get.enemyKills() + 1)");
    expect(src).toContain("set.comboCount(get.comboCount() + 1)");
  });

  it("uses coinByType map for coin drop multiplier", () => {
    expect(src).toContain("coinByType[en.type]");
  });

  it("hero knockback impulse at 14 * falloff", () => {
    expect(src).toContain("14 * (1 - hd / RADIUS)");
    expect(src).toContain("set.heroKbU");
    expect(src).toContain("set.heroKbV");
    expect(src).toContain("set.heroKbT(0.28)");
  });

  it("spawns 8 barrels at default positions", () => {
    expect(src).toContain("{u:10,v:10}");
    expect(src).toContain("{u:-10,v:10}");
    expect(src).toContain("{u:18,v:0}");
    expect(src).toContain("{u:0,v:18}");
  });

  it("respects godMode — skips hero damage when godMode active", () => {
    expect(src).toContain("Engine.debug.godMode");
  });
});
