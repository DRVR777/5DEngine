import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/static_supply.js", "utf8");

describe("static_supply", () => {
  it("exports mountStaticSupply", () => {
    expect(src).toContain("export function mountStaticSupply");
  });

  it("returns grenadeCrates and armorPickups", () => {
    expect(src).toContain("return { grenadeCrates, armorPickups }");
  });

  it("grenade crates use dark green box with emissive stripe", () => {
    expect(src).toContain("grenadeCrates");
    expect(src).toContain("0x336633"); // dark green body
    expect(src).toContain("0x00ff44"); // emissive stripe
    expect(src).toContain("BoxGeometry(0.5, 0.4, 0.5)");
    expect(src).toContain("respawnT: -Infinity");
    expect(src).toContain("active: true");
  });

  it("grenade crates placed at 4 fixed positions", () => {
    expect(src).toContain("10, -10");
    expect(src).toContain("-10, 10");
    expect(src).toContain("0, 18");
    expect(src).toContain("-14, -4");
  });

  it("armor pickups use gold box at y=0.3", () => {
    expect(src).toContain("armorPickups");
    expect(src).toContain("0xffd166"); // gold
    expect(src).toContain("BoxGeometry(0.4, 0.55, 0.25)");
    expect(src).toContain("mesh.position.set(au, 0.3, av)");
  });

  it("armor pickups placed at 3 fixed positions", () => {
    expect(src).toContain("18, 5");
    expect(src).toContain("-16, 14");
    expect(src).toContain("4, -20");
  });
});
