/**
 * golden_weapon_damage.test.js — Parity tests for weapon damage falloff formula
 *
 * Monolith source: index.html line 6606-6607
 *   _falloffMul = bullet.falloff
 *     ? Math.max(0.15, 1 - (b.traveled / (b.range || 1)) * b.falloff)
 *     : 1
 *   dmg = Math.round(b.damage * modMul * _wResist * _heroLvlDmgMul * _perkDmgMul * _falloffMul)
 *
 * data/tuning/weapons.json source values:
 *   falloffMin     = 0.15   → line 6606 Math.max(0.15, ...)
 *   defaultFalloff = 0      → wep.falloff || 0 (pistol/rifle/smg/sniper have no falloff)
 *   shotgunFalloff = 0.85   → game_config.js shotgun.falloff
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { applyPlayerDamage } from "../../src/systems/ecs_combat.js";

function loadAtom(relPath) {
  const abs = resolve(process.cwd(), relPath);
  return JSON.parse(readFileSync(abs, "utf8"));
}

// ── weapons tuning atom ───────────────────────────────────────────────────────
describe("data/tuning/weapons.json atom — monolith parity", () => {
  const atom = loadAtom("data/tuning/weapons.json");
  const f = atom.$facets;

  it("has holographic atom format keys", () => {
    expect(atom.$version).toBe(1);
    expect(atom.$type).toBe("tuning");
    expect(atom.$id).toBe("weapons");
    expect(atom.$facets).toBeDefined();
    expect(atom.$refs).toBeDefined();
    expect(atom.$meta).toBeDefined();
  });

  it("falloffMin = 0.15 (monolith line 6606: Math.max(0.15, ...))", () => {
    expect(f.falloffMin).toBe(0.15);
  });

  it("defaultFalloff = 0 (pistol/rifle/smg/sniper have no falloff)", () => {
    expect(f.defaultFalloff).toBe(0);
  });

  it("shotgunFalloff = 0.85 (game_config.js shotgun.falloff)", () => {
    expect(f.shotgunFalloff).toBe(0.85);
  });

  it("$refs has all 5 weapon pointers", () => {
    expect(atom.$refs.pistol).toBe("data/weapons/pistol.json");
    expect(atom.$refs.rifle).toBe("data/weapons/rifle.json");
    expect(atom.$refs.shotgun).toBe("data/weapons/shotgun.json");
    expect(atom.$refs.smg).toBe("data/weapons/smg.json");
    expect(atom.$refs.sniper).toBe("data/weapons/sniper.json");
  });
});

// ── falloff formula parity: applyPlayerDamage with falloffMul ────────────────
describe("weapon falloff formula — monolith line 6606 parity", () => {
  const DM = {};

  // falloffMul = Math.max(0.15, 1 - traveled/range * falloffCoef)
  // At traveled=0:            mul = 1.0
  // At traveled=range*0.5:    mul = 1 - 0.5 * falloffCoef
  // At traveled=range (100%): mul = 1 - falloffCoef  (or 0.15 if that's smaller)

  // Shotgun: falloffCoef=0.85, range=20
  // At half range (10m): mul = 1 - 0.5*0.85 = 0.575 → round(14*0.575) = 8
  it("shotgun at half range: round(14 × 0.575) = 8", () => {
    const mul = Math.max(0.15, 1 - (10 / 20) * 0.85);
    expect(applyPlayerDamage(14, "shotgun", "grunt", DM, { falloffMul: mul })).toBe(8);
  });

  // At max range (20m): mul = 1 - 0.85 = 0.15 → round(14*0.15) = 2
  it("shotgun at max range: round(14 × 0.15) = 2", () => {
    const mul = Math.max(0.15, 1 - (20 / 20) * 0.85);
    expect(mul).toBeCloseTo(0.15, 10); // floor (floating point)
    expect(applyPlayerDamage(14, "shotgun", "grunt", DM, { falloffMul: mul })).toBe(2);
  });

  // Past max range: still 0.15 (clamped)
  it("shotgun past max range: mul clamped to 0.15 (monolith Math.max floor)", () => {
    const mul = Math.max(0.15, 1 - (25 / 20) * 0.85);
    expect(mul).toBe(0.15);
  });

  // No falloff (pistol, rifle, smg): falloffMul = 1.0
  it("pistol (no falloff): falloffMul stays 1.0 at any range", () => {
    const mul = 1; // falloff=0, so _falloffMul = 1 always
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { falloffMul: mul })).toBe(20);
  });

  it("sniper at long range (no falloff): still full damage", () => {
    expect(applyPlayerDamage(95, "sniper", "grunt", DM, { falloffMul: 1.0 })).toBe(95);
  });

  // Combined: shotgun headshot at close range (no falloff)
  it("shotgun headshot close range: round(14 × 1.85 × 1.0) = 26", () => {
    expect(applyPlayerDamage(14, "shotgun", "grunt", DM, { headshot: true, falloffMul: 1.0 })).toBe(26);
  });

  // Combined: shotgun headshot at max range
  it("shotgun headshot at max range: round(14 × 1.85 × 0.15) = 4", () => {
    const mul = 0.15;
    expect(applyPlayerDamage(14, "shotgun", "grunt", DM, { headshot: true, falloffMul: mul })).toBe(4);
  });

  // SMG: fast fire, damage 12, no falloff — verify against weapon atom
  it("smg full-damage hit: round(12 × 1.0) = 12", () => {
    expect(applyPlayerDamage(12, "smg", "grunt", DM)).toBe(12);
  });

  // Rifle vs heavy (verify weapon resist composition still works with falloff)
  it("rifle vs robot with falloff 0.7: round(25 × resist × 0.7)", () => {
    const dm = { robot: { rifle: 0.8 } }; // 80% effective vs robot
    const mul = 0.7;
    expect(applyPlayerDamage(25, "rifle", "robot", dm, { falloffMul: mul })).toBe(14); // round(25*0.8*0.7)=14
  });
});

// ── Weapon atom cross-check: damage values from game_config ──────────────────
describe("weapon atom damage values — game_config.js parity", () => {
  const atoms = {
    pistol:  loadAtom("data/weapons/pistol.json").$facets,
    rifle:   loadAtom("data/weapons/rifle.json").$facets,
    shotgun: loadAtom("data/weapons/shotgun.json").$facets,
    smg:     loadAtom("data/weapons/smg.json").$facets,
    sniper:  loadAtom("data/weapons/sniper.json").$facets,
  };

  it("pistol damage=20 matches applyPlayerDamage base hit", () => {
    expect(applyPlayerDamage(atoms.pistol.damage, "pistol", "grunt", {})).toBe(20);
  });

  it("rifle damage=25 base hit = 25", () => {
    expect(applyPlayerDamage(atoms.rifle.damage, "rifle", "grunt", {})).toBe(25);
  });

  it("shotgun pellet damage=14, 9 pellets → 126 total at close range (no falloff)", () => {
    const perPellet = applyPlayerDamage(atoms.shotgun.damage, "shotgun", "grunt", {});
    expect(perPellet).toBe(14);
    expect(perPellet * atoms.shotgun.pellets).toBe(126);
  });

  it("sniper damage=95 headshot: round(95 × 1.85) = 176", () => {
    expect(applyPlayerDamage(atoms.sniper.damage, "sniper", "grunt", {}, { headshot: true })).toBe(176);
  });

  it("smg damage=12, high rate of fire (14 rps) — DPS at close range = 168/s", () => {
    const perShot = atoms.smg.damage;
    const fireRate = atoms.smg.fireRate;
    expect(perShot * fireRate).toBe(168);
  });
});
