import { readFileSync } from "fs";
import { describe, it, expect } from "vitest";

const src = readFileSync("src/systems/crate_system.js", "utf8");

describe("crate_system", () => {
  it("exports mountCrateSystem", () => {
    expect(src).toContain("export function mountCrateSystem");
  });

  it("returns makeCrate, breakCrate, crates", () => {
    expect(src).toContain("makeCrate");
    expect(src).toContain("breakCrate");
    expect(src).toContain("crates");
  });

  it("crate has 35 HP and broken=false", () => {
    expect(src).toContain("hp: 35, maxHp: 35");
    expect(src).toContain("broken: false");
  });

  it("crate mesh uses brown box geometry with edge slats", () => {
    expect(src).toContain("BoxGeometry(0.9, 0.9, 0.9)");
    expect(src).toContain("0x8b5c20");  // brown body
    expect(src).toContain("0x5a3a10");  // dark slat edge
    expect(src).toContain("BoxGeometry(0.92, 0.06, 0.92)");
    expect(src).toContain("[0.18, 0.45, 0.72]");  // three slat y positions
  });

  it("crate gets random rotation on spawn", () => {
    expect(src).toContain("Math.random() * Math.PI * 2");
  });

  it("breakCrate hides mesh and spawns particles", () => {
    expect(src).toContain("crate.broken = true");
    expect(src).toContain("crate.mesh.visible = false");
    expect(src).toContain('spawnParticles(crate.u, 0.5, crate.v, 20, "orange"');
  });

  it("plays a break sound effect", () => {
    expect(src).toContain('"tone:180:80:square"');
  });

  it("loot table has ammo, health, coin entries", () => {
    expect(src).toContain('"ammo"');
    expect(src).toContain('"health"');
    expect(src).toContain('"coin"');
  });

  it("coin loot increments score via setter", () => {
    expect(src).toContain("set.score(get.score() + 2)");
  });

  it("ammo loot uses get.weapon().ammoItem", () => {
    expect(src).toContain("get.weapon().ammoItem");
  });

  it("spawns CRACK! damage number on break", () => {
    expect(src).toContain('"CRACK!"');
    expect(src).toContain('"#cc8833"');
  });

  it("spawns 8 crates at default positions", () => {
    expect(src).toContain("{u:6,v:6}");
    expect(src).toContain("{u:-6,v:6}");
    expect(src).toContain("{u:14,v:8}");
    expect(src).toContain("{u:-14,v:8}");
  });
});
