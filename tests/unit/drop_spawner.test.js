import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/drop_spawner.js", "utf8");

describe("drop_spawner", () => {
  it("exports mountDropSpawner and WEAPON_DROP_MAP", () => {
    expect(src).toContain("export function mountDropSpawner");
    expect(src).toContain("export const WEAPON_DROP_MAP");
  });

  it("WEAPON_DROP_MAP has heavy→rifle, robot→smg, boss→sniper", () => {
    expect(src).toContain('"rifle"');
    expect(src).toContain('"smg"');
    expect(src).toContain('"sniper"');
  });

  it("returns all five spawn functions and five arrays", () => {
    expect(src).toContain("spawnAmmoPickup");
    expect(src).toContain("spawnWeaponPickup");
    expect(src).toContain("spawnHealthPickup");
    expect(src).toContain("spawnArmorShard");
    expect(src).toContain("spawnCoinDrop");
    expect(src).toContain("ammoPickups");
    expect(src).toContain("weaponPickups");
    expect(src).toContain("healthPickups");
    expect(src).toContain("armorShards");
    expect(src).toContain("coinDrops");
  });

  it("ammo pickup uses yellow-orange box at y=0.4", () => {
    expect(src).toContain("BoxGeometry(0.18, 0.08, 0.28)");
    expect(src).toContain("0xffaa00");
    expect(src).toContain("0.4, v)");
    expect(src).toContain("collected: false");
  });

  it("ammo pickup falls back to CFG.ammoDropQty and weapon ammoItem", () => {
    expect(src).toContain("CFG.ammoDropQty");
    expect(src).toContain("get.weapon().ammoItem");
  });

  it("weapon pickup spawns body + grip + pillar beacon", () => {
    expect(src).toContain("BoxGeometry(0.55, 0.08, 0.14)");
    expect(src).toContain("BoxGeometry(0.1, 0.16, 0.1)");
    expect(src).toContain("CylinderGeometry(0.04, 0.04, 6, 6)");
    expect(src).toContain("pillar");
  });

  it("health pickup uses green octahedron at y=0.6", () => {
    expect(src).toContain("OctahedronGeometry(0.22, 0)");
    expect(src).toContain("0x00ff88");
    expect(src).toContain("0.6, dv)");
  });

  it("armor shard uses gold tetrahedron", () => {
    expect(src).toContain("TetrahedronGeometry(0.22, 0)");
    expect(src).toContain("0xffd166");
    expect(src).toContain("0xcc8800");
  });

  it("coin drop uses gold sphere with random offset", () => {
    expect(src).toContain("SphereGeometry(0.18, 8, 8)");
    expect(src).toContain("0xffd700");
    expect(src).toContain("0.5) * 0.8");
  });
});
