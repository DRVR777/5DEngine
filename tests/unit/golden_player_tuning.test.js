/**
 * golden_player_tuning.test.js — Parity tests for data/tuning/player.json vs monolith
 *
 * Monolith source lines:
 *   5652: const WALK   = CFG.walkSpeed   || 5
 *   5653: const SPRINT = CFG.sprintSpeed || 9
 *   5650: const GRAVITY = CFG.gravity    || -25
 *   5651: const JUMP_V  = CFG.jumpVelocity || 13
 *   5985: const DODGE_DURATION = 0.25
 *   5986: const DODGE_SPEED    = 18
 *   5987: const DODGE_COOLDOWN = 1.1
 *   Stamina: DRAIN=22, REGEN=14, MAX=100, LOCKOUT=15, DODGE_COST=20 (ecs_stamina.js)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadAtom(rel) {
  return JSON.parse(readFileSync(resolve(process.cwd(), rel), "utf8"));
}

describe("data/tuning/player.json — holographic atom format", () => {
  const atom = loadAtom("data/tuning/player.json");

  it("$version = 1",      () => expect(atom.$version).toBe(1));
  it("$type = tuning",    () => expect(atom.$type).toBe("tuning"));
  it("$id = player",      () => expect(atom.$id).toBe("player"));
  it("$facets defined",   () => expect(atom.$facets).toBeDefined());
  it("$refs defined",     () => expect(atom.$refs).toBeDefined());
  it("$meta defined",     () => expect(atom.$meta).toBeDefined());
});

describe("data/tuning/player.json — monolith parity", () => {
  const f = loadAtom("data/tuning/player.json").$facets;

  it("walkSpeed = 5 (monolith line 5652: CFG.walkSpeed || 5)",       () => expect(f.walkSpeed).toBe(5));
  it("sprintSpeed = 9 (monolith line 5653: CFG.sprintSpeed || 9)",   () => expect(f.sprintSpeed).toBe(9));
  it("gravity = -25 (monolith line 5650: CFG.gravity || -25)",       () => expect(f.gravity).toBe(-25));
  it("jumpVelocity = 13 (monolith line 5651: CFG.jumpVelocity || 13)", () => expect(f.jumpVelocity).toBe(13));
  it("dodgeDuration = 0.25 (monolith line 5985)",  () => expect(f.dodgeDuration).toBe(0.25));
  it("dodgeSpeed = 18 (monolith line 5986)",        () => expect(f.dodgeSpeed).toBe(18));
  it("dodgeCooldown = 1.1 (monolith line 5987)",    () => expect(f.dodgeCooldown).toBe(1.1));
  it("dodgeStaminaCost = 20 (ecs_stamina DODGE_COST)", () => expect(f.dodgeStaminaCost).toBe(20));
  it("sprintDrain = 22 (ecs_stamina STAMINA_DRAIN)",   () => expect(f.sprintDrain).toBe(22));
  it("staminaRegen = 14 (ecs_stamina STAMINA_REGEN)",  () => expect(f.staminaRegen).toBe(14));
  it("staminaMax = 100 (ecs_stamina STAMINA_MAX)",     () => expect(f.staminaMax).toBe(100));
  it("staminaLockout = 15 (ecs_stamina STAMINA_LOCKOUT)", () => expect(f.staminaLockout).toBe(15));
  it("lvl2SpeedBonus = 1.0 (monolith line 2769)",  () => expect(f.lvl2SpeedBonus).toBe(1.0));
  it("bodyRadius = 0.4", () => expect(f.bodyRadius).toBe(0.4));
  it("bodyHeight = 1.8", () => expect(f.bodyHeight).toBe(1.8));
});
