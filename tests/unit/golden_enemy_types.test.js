/**
 * golden_enemy_types.test.js — Parity tests for enemy type atoms vs monolith.
 *
 * Monolith source: 5DEngineMassive/index.html lines 1175-1182
 *   { type: "grunt", hp: 80, maxHp: 80, moveSpeed: 2.4, damage: 6,
 *     attackRange: 1.6, sightRange: 12, dropAmmo: "pistol_9mm", dropQty: 12,
 *     dropHealth: 0, wanderSpeed: 1.0 }
 *   ... (7 more enemy types)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnemy(type) {
  const abs = resolve(process.cwd(), `data/enemies/types/${type}.json`);
  return JSON.parse(readFileSync(abs, "utf8"));
}

const TYPES = ["grunt", "heavy", "fast", "poisoner", "incendiary", "robot", "boss", "sniper"];

// ── Holographic format check ──────────────────────────────────────────────────
describe("data/enemies/types/* — holographic atom format", () => {
  for (const type of TYPES) {
    it(`${type}.json has all 6 holographic keys`, () => {
      const atom = loadEnemy(type);
      expect(atom.$version).toBe(1);
      expect(atom.$type).toBe("entity");
      expect(atom.$id).toBe(type);
      expect(atom.$facets).toBeDefined();
      expect(atom.$refs).toBeDefined();
      expect(atom.$meta).toBeDefined();
    });
  }
});

// ── Per-type monolith parity (line 1175-1182) ─────────────────────────────────
describe("grunt (monolith line 1175) — stat parity", () => {
  const f = loadEnemy("grunt").$facets;
  it("hp = 80",           () => expect(f.hp).toBe(80));
  it("moveSpeed = 2.4",   () => expect(f.moveSpeed).toBe(2.4));
  it("damage = 6",        () => expect(f.damage).toBe(6));
  it("attackRange = 1.6", () => expect(f.attackRange).toBe(1.6));
  it("sightRange = 12",   () => expect(f.sightRange).toBe(12));
  it("wanderSpeed = 1.0", () => expect(f.wanderSpeed).toBe(1.0));
  it("dropAmmo = pistol_9mm", () => expect(f.dropAmmo).toBe("pistol_9mm"));
  it("dropQty = 12",      () => expect(f.dropQty).toBe(12));
});

describe("heavy (monolith line 1176) — stat parity", () => {
  const f = loadEnemy("heavy").$facets;
  it("hp = 200",          () => expect(f.hp).toBe(200));
  it("moveSpeed = 1.2",   () => expect(f.moveSpeed).toBe(1.2));
  it("damage = 18",       () => expect(f.damage).toBe(18));
  it("attackRange = 2.0", () => expect(f.attackRange).toBe(2.0));
  it("sightRange = 10",   () => expect(f.sightRange).toBe(10));
  it("wanderSpeed = 0.6", () => expect(f.wanderSpeed).toBe(0.6));
  it("dropHealth = 30",   () => expect(f.dropHealth).toBe(30));
});

describe("fast (monolith line 1177) — stat parity", () => {
  const f = loadEnemy("fast").$facets;
  it("hp = 40",           () => expect(f.hp).toBe(40));
  it("moveSpeed = 5.0",   () => expect(f.moveSpeed).toBe(5.0));
  it("damage = 4",        () => expect(f.damage).toBe(4));
  it("attackRange = 1.2", () => expect(f.attackRange).toBe(1.2));
  it("sightRange = 16",   () => expect(f.sightRange).toBe(16));
  it("wanderSpeed = 2.5", () => expect(f.wanderSpeed).toBe(2.5));
});

describe("poisoner (monolith line 1178) — stat parity", () => {
  const f = loadEnemy("poisoner").$facets;
  it("hp = 60",           () => expect(f.hp).toBe(60));
  it("moveSpeed = 2.0",   () => expect(f.moveSpeed).toBe(2.0));
  it("damage = 3",        () => expect(f.damage).toBe(3));
  it("sightRange = 12",   () => expect(f.sightRange).toBe(12));
  it("wanderSpeed = 0.8", () => expect(f.wanderSpeed).toBe(0.8));
});

describe("incendiary (monolith line 1179) — stat parity", () => {
  const f = loadEnemy("incendiary").$facets;
  it("hp = 70",           () => expect(f.hp).toBe(70));
  it("moveSpeed = 2.2",   () => expect(f.moveSpeed).toBe(2.2));
  it("damage = 5",        () => expect(f.damage).toBe(5));
  it("wanderSpeed = 0.9", () => expect(f.wanderSpeed).toBe(0.9));
});

describe("robot (monolith line 1180) — stat parity", () => {
  const f = loadEnemy("robot").$facets;
  it("hp = 350",          () => expect(f.hp).toBe(350));
  it("moveSpeed = 1.0",   () => expect(f.moveSpeed).toBe(1.0));
  it("damage = 25",       () => expect(f.damage).toBe(25));
  it("attackRange = 2.2", () => expect(f.attackRange).toBe(2.2));
  it("sightRange = 14",   () => expect(f.sightRange).toBe(14));
  it("dropAmmo = rifle_556", () => expect(f.dropAmmo).toBe("rifle_556"));
  it("dropHealth = 40",   () => expect(f.dropHealth).toBe(40));
});

describe("boss (monolith line 1181) — stat parity", () => {
  const f = loadEnemy("boss").$facets;
  it("hp = 1200",         () => expect(f.hp).toBe(1200));
  it("moveSpeed = 1.8",   () => expect(f.moveSpeed).toBe(1.8));
  it("damage = 40",       () => expect(f.damage).toBe(40));
  it("attackRange = 3.0", () => expect(f.attackRange).toBe(3.0));
  it("sightRange = 20",   () => expect(f.sightRange).toBe(20));
  it("wanderSpeed = 0.5", () => expect(f.wanderSpeed).toBe(0.5));
  it("dropHealth = 80",   () => expect(f.dropHealth).toBe(80));
});

describe("sniper (monolith line 1182) — stat parity", () => {
  const f = loadEnemy("sniper").$facets;
  it("hp = 55",            () => expect(f.hp).toBe(55));
  it("moveSpeed = 0.9",    () => expect(f.moveSpeed).toBe(0.9));
  it("damage = 45",        () => expect(f.damage).toBe(45));
  it("attackRange = 20",   () => expect(f.attackRange).toBe(20));
  it("sightRange = 22",    () => expect(f.sightRange).toBe(22));
  it("wanderSpeed = 0.3",  () => expect(f.wanderSpeed).toBe(0.3));
  it("dropAmmo = rifle_556", () => expect(f.dropAmmo).toBe("rifle_556"));
});

// ── data/tuning/enemies.json atom ─────────────────────────────────────────────
import { readFileSync as _rfs } from "fs";
import { resolve as _res } from "path";
function _loadAtom(p) { return JSON.parse(_rfs(_res(process.cwd(), p), "utf8")); }

describe("data/tuning/enemies.json atom — monolith parity", () => {
  const atom = _loadAtom("data/tuning/enemies.json");
  const f = atom.$facets;

  it("has holographic atom format", () => {
    expect(atom.$version).toBe(1);
    expect(atom.$type).toBe("tuning");
    expect(atom.$id).toBe("enemies");
  });

  it("loseRangeMul = 2.5 (monolith line 7063)", () => expect(f.loseRangeMul).toBe(2.5));
  it("attackCooldown = 1.0 (monolith line 7062)", () => expect(f.attackCooldown).toBe(1.0));
  it("enrageHpFraction = 0.25 (monolith line 7102)", () => expect(f.enrageHpFraction).toBe(0.25));
  it("enrageSpeedMul = 1.35 (monolith line 7104)", () => expect(f.enrageSpeedMul).toBe(1.35));
  it("staggerDuration = 1.5 (monolith line 2403)", () => expect(f.staggerDuration).toBe(1.5));
  it("knockbackDuration = 0.28 (monolith line 2401)", () => expect(f.knockbackDuration).toBe(0.28));
  it("wanderAngleRate = 0.35 (monolith line 7468)", () => expect(f.wanderAngleRate).toBe(0.35));
  it("bossGroundSlamRadius = 5 (monolith line 7354)", () => expect(f.bossGroundSlamRadius).toBe(5));
  it("bossGroundSlamDmg = 50 (monolith line 7354)", () => expect(f.bossGroundSlamDmg).toBe(50));
  it("fastChargeDuration = 0.38 (monolith line 7396)", () => expect(f.fastChargeDuration).toBe(0.38));
  it("fastChargeSpeedMul = 2.2 (monolith line 7407)", () => expect(f.fastChargeSpeedMul).toBe(2.2));
});
