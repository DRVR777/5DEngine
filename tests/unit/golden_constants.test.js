/**
 * golden_constants.test.js — Parity tests between ECS systems and 5DEngineMassive monolith.
 *
 * These tests lock down the numeric constants extracted from 5DEngineMassive/index.html.
 * If any value changes here intentionally, update the corresponding atom in data/tuning/
 * and the monolith reference line in the $meta block.
 *
 * Monolith sources:
 *   HERO_MAX_HP      = 100    → line 1529
 *   HERO_MAX_ARMOR   = 75     → line 1535
 *   ARMOR_ABSORB     = 0.6    → line 1536
 *   HERO_REGEN_DELAY = 5      → line 1530
 *   HERO_REGEN_RATE  = 4      → line 1531
 *   WALK             = 5      → line 5652
 *   SPRINT           = 9      → line 5653
 *   COLLECT_RADIUS   = 1.2    → line 8140
 *   MAGNET_RADIUS    = 3.0    → line 8150
 *   MAGNET_FORCE     = 8      → line 8155 (mag = 8 * (1 - d/3.0))
 *   COUNTDOWN_SECS   = 5      → ecs_wave.js
 *   SPAWN_INTERVAL   = 0.35   → ecs_wave.js
 *   headshot mul     = 1.85   → line 6607
 *   backstab mul     = 1.50   → line 6607
 *   frontalBlock mul = 0.50   → line 6607
 *   crit mul         = 2.50   → line 6607
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { applyPlayerDamage } from "../../src/systems/ecs_combat.js";

// ── Atom loader (sync, for test-time validation) ─────────────────────────────
function loadAtom(relPath) {
  const abs = resolve(process.cwd(), relPath);
  return JSON.parse(readFileSync(abs, "utf8"));
}

// ── Tuning atom validation ────────────────────────────────────────────────────
describe("tuning/hero.json atom — monolith parity", () => {
  const atom = loadAtom("data/tuning/hero.json");
  const f = atom.$facets;

  it("has holographic atom format keys", () => {
    expect(atom.$version).toBe(1);
    expect(atom.$type).toBe("tuning");
    expect(atom.$id).toBe("hero");
    expect(atom.$facets).toBeDefined();
    expect(atom.$refs).toBeDefined();
    expect(atom.$meta).toBeDefined();
  });

  it("HERO_MAX_HP = 100 (monolith line 1529)", () => { expect(f.maxHp).toBe(100); });
  it("HERO_MAX_ARMOR = 75 (monolith line 1535)", () => { expect(f.maxArmor).toBe(75); });
  it("ARMOR_ABSORB = 0.6 (monolith line 1536)", () => { expect(f.armorAbsorb).toBe(0.6); });
  it("HERO_REGEN_DELAY = 5s (monolith line 1530)", () => { expect(f.regenDelay).toBe(5); });
  it("HERO_REGEN_RATE = 4 HP/s (monolith line 1531)", () => { expect(f.regenRate).toBe(4); });
  it("WALK = 5 m/s (monolith line 5652)", () => { expect(f.walkSpeed).toBe(5); });
  it("SPRINT = 9 m/s (monolith line 5653)", () => { expect(f.sprintSpeed).toBe(9); });
  it("lifestealPerKill = 3 HP (vampire perk)", () => { expect(f.lifestealPerKill).toBe(3); });
  it("medkitHeal = 40 HP (monolith line 5179)", () => { expect(f.medkitHeal).toBe(40); });
  it("waveClearHeal = 15 HP (monolith line 2650)", () => { expect(f.waveClearHeal).toBe(15); });
  it("headshot multiplier = 1.85 (monolith line 6607)", () => { expect(f.hitMultiplierHeadshot).toBe(1.85); });
  it("backstab multiplier = 1.50 (monolith line 6607)", () => { expect(f.hitMultiplierBackstab).toBe(1.50); });
  it("frontalBlock multiplier = 0.50 (monolith line 6607)", () => { expect(f.hitMultiplierFrontalBlock).toBe(0.50); });
  it("crit multiplier = 2.50 (monolith line 6607)", () => { expect(f.hitMultiplierCrit).toBe(2.50); });
});

describe("tuning/pickups.json atom — monolith parity", () => {
  const atom = loadAtom("data/tuning/pickups.json");
  const f = atom.$facets;

  it("has holographic atom format", () => {
    expect(atom.$version).toBe(1);
    expect(atom.$type).toBe("tuning");
    expect(atom.$id).toBe("pickups");
  });

  it("collectRadius = 1.2m (monolith line 8140: d < 1.2)", () => { expect(f.collectRadius).toBe(1.2); });
  it("magnetRadius = 3.0m (monolith line 8150: d < 3.0)", () => { expect(f.magnetRadius).toBe(3.0); });
  it("magnetForce = 8 (monolith: _mag = 8 * (1 - d/3.0))", () => { expect(f.magnetForce).toBe(8); });
  it("spawnY = 0.4 (pickup bob origin height)", () => { expect(f.spawnY).toBe(0.4); });
});

describe("tuning/wave.json atom — monolith parity", () => {
  const atom = loadAtom("data/tuning/wave.json");
  const f = atom.$facets;

  it("has holographic atom format", () => {
    expect(atom.$version).toBe(1);
    expect(atom.$type).toBe("tuning");
    expect(atom.$id).toBe("wave");
  });

  it("countdownSeconds = 5 (ecs_wave.js COUNTDOWN_SECONDS)", () => { expect(f.countdownSeconds).toBe(5); });
  it("spawnInterval = 0.35s (ecs_wave.js SPAWN_INTERVAL)", () => { expect(f.spawnInterval).toBe(0.35); });
  it("perkChoices = 3 (3 perks offered per wave-clear)", () => { expect(f.perkChoices).toBe(3); });
  it("defaultWaveCount = 10 (10 waves in DEFAULT_WAVES)", () => { expect(f.defaultWaveCount).toBe(10); });
});

// ── ECS combat parity: applyPlayerDamage formula ──────────────────────────────
describe("applyPlayerDamage — monolith line 6607 parity", () => {
  const DM = {};  // no weapon resist (unknown type = 1.0)

  it("base hit: 20 dmg × 1.0 × 1.0 = 20", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM)).toBe(20);
  });

  it("headshot: 20 × 1.85 = 37", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { headshot: true })).toBe(37);
  });

  it("backstab: 20 × 1.50 = 30", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { backstab: true })).toBe(30);
  });

  it("frontalBlock: 20 × 0.50 = 10", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { frontalBlock: true })).toBe(10);
  });

  it("crit: 20 × 2.50 = 50", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { crit: true })).toBe(50);
  });

  it("perk dmg multiplier stacks: 20 × 1.15 = 23", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { perkDmgMul: 1.15 })).toBe(23);
  });

  it("two dmg perks (×1.15²): round(20 × 1.3225) = 26", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { perkDmgMul: 1.15 * 1.15 })).toBe(26);
  });

  it("heavy resist + headshot: round(20 × 1.85 × 0.5) = 19", () => {
    const dm = { heavy: { pistol: 0.5 } };
    expect(applyPlayerDamage(20, "pistol", "heavy", dm, { headshot: true })).toBe(19);
  });

  it("falloff at max range: round(20 × 0.3) = 6", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { falloffMul: 0.3 })).toBe(6);
  });

  it("hero level dmg multiplier: round(20 × 1.2) = 24", () => {
    expect(applyPlayerDamage(20, "pistol", "grunt", DM, { heroLvlDmgMul: 1.2 })).toBe(24);
  });

  it("never returns negative", () => {
    expect(applyPlayerDamage(0, "pistol", "grunt", DM)).toBe(0);
  });
});

// ── Weapon atom validation ─────────────────────────────────────────────────────
describe("data/weapons/* atoms — game_config.js parity", () => {
  const WEAPON_IDS = ["pistol", "rifle", "shotgun", "smg", "sniper"];

  for (const id of WEAPON_IDS) {
    it(`${id}.json has holographic atom format`, () => {
      const atom = loadAtom(`data/weapons/${id}.json`);
      expect(atom.$version).toBe(1);
      expect(atom.$type).toBe("weapon");
      expect(atom.$id).toBe(id);
      expect(atom.$facets).toBeDefined();
      expect(atom.$refs).toBeDefined();
      expect(atom.$meta).toBeDefined();
    });
  }

  it("pistol: damage=20, fireRate=5, magCap=12, reloadDuration=1200", () => {
    const f = loadAtom("data/weapons/pistol.json").$facets;
    expect(f.damage).toBe(20);
    expect(f.fireRate).toBe(5);
    expect(f.magCap).toBe(12);
    expect(f.reloadDuration).toBe(1200);
    expect(f.ammoItem).toBe("pistol_9mm");
  });

  it("rifle: fireRate=12 (auto), damage=25, magCap=30", () => {
    const f = loadAtom("data/weapons/rifle.json").$facets;
    expect(f.fireRate).toBe(12);
    expect(f.damage).toBe(25);
    expect(f.magCap).toBe(30);
    expect(f.automatic).toBe(true);
  });

  it("shotgun: pellets=9, spread=0.14, damage=14 per pellet", () => {
    const f = loadAtom("data/weapons/shotgun.json").$facets;
    expect(f.pellets).toBe(9);
    expect(f.spread).toBe(0.14);
    expect(f.damage).toBe(14);
  });

  it("sniper: damage=95 (highest), fireRate=0.7 (slowest), range=200", () => {
    const f = loadAtom("data/weapons/sniper.json").$facets;
    expect(f.damage).toBe(95);
    expect(f.fireRate).toBe(0.7);
    expect(f.range).toBe(200);
    expect(f.magCap).toBe(5);
  });

  it("weapons index.json has all 5 types", () => {
    const atom = loadAtom("data/weapons/index.json");
    expect(atom.$type).toBe("index");
    expect(atom.$facets.types).toEqual(["pistol", "rifle", "shotgun", "smg", "sniper"]);
  });
});
