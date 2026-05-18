import { describe, it, expect, beforeEach } from "vitest";
import {
  createFastChargeSystem,
  FAST_CHARGE_MIN_DIST, FAST_CHARGE_MAX_DIST,
  FAST_CHARGE_DUR, FAST_CHARGE_SPEED_MUL,
  FAST_CHARGE_CD_MIN, FAST_CHARGE_CD_RAND,
} from "../../src/systems/ecs_fast_charge.js";
import Core from "../../src/core/core.js";

function makeFast(u = 0, v = 0, hp = 60) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "fast", heading: 0, moveSpeed: 5.0,
    sightRange: 16, _chargeDur: 0, _charging: false });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function makeGrunt(u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("fast charge constants — monolith line 7391-7408 parity", () => {
  it("FAST_CHARGE_MIN_DIST = 2.0 (line 7392)",  () => expect(FAST_CHARGE_MIN_DIST).toBe(2.0));
  it("FAST_CHARGE_MAX_DIST = 8.0 (line 7392)",  () => expect(FAST_CHARGE_MAX_DIST).toBe(8.0));
  it("FAST_CHARGE_DUR = 0.38 (line 7396)",       () => expect(FAST_CHARGE_DUR).toBe(0.38));
  it("FAST_CHARGE_SPEED_MUL = 2.2 (line 7407)", () => expect(FAST_CHARGE_SPEED_MUL).toBe(2.2));
  it("FAST_CHARGE_CD_MIN = 3.5 (line 7395)",    () => expect(FAST_CHARGE_CD_MIN).toBe(3.5));
  it("FAST_CHARGE_CD_RAND = 2.0 (line 7395)",   () => expect(FAST_CHARGE_CD_RAND).toBe(2.0));
});

// ── Trigger conditions ────────────────────────────────────────────────────────
describe("createFastChargeSystem — trigger conditions", () => {
  beforeEach(() => Core._reset());

  it("emits fast:charge when hero within 2–8m on first tick", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 5); // 5m away — inside 2–8m window

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(1);
  });

  it("does NOT charge when hero > 8m away", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 9); // 9m > 8m max

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("does NOT charge when hero < 2m (too close)", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 1.5); // 1.5m < 2m min

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("does NOT charge when hero exactly at 2m boundary (exclusive)", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 2); // exactly 2m — not > 2

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("does NOT charge when hero exactly at 8m boundary (exclusive)", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 8); // exactly 8m — not < 8

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("non-fast enemy (grunt) does NOT charge", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeGrunt(0, 0);
    makeHero(0, 5);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("dead fast enemy does NOT charge", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0, 0); // hp=0
    makeHero(0, 5);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });

  it("fast:charge event includes entityId", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges[0].entityId).toBe(fid);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createFastChargeSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not charge again before cooldown interval", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 }); // CD = 3.5s
    makeFast(0, 0);
    makeHero(0, 5);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));

    sys(0.1, Core);   // first charge triggers
    sys(0.38, Core);  // charge still active
    sys(0.38, Core);  // charge done, but cooldown not elapsed
    sys(1.0, Core);   // 1.86s total — still < 3.5s

    expect(charges.length).toBe(1);
  });

  it("charges again after cooldown elapses", () => {
    // dt=0.1 → entity.v=1.1, chargeDur=0.28 remaining
    // dt=0.29 → charge expires; entity.v=4.29; hero at 7m → dist=2.71m (in 2-8m)
    // dt=3.3 → elapsed=3.69; 3.69-0.1=3.59 >= 3.5s CD → second charge fires
    const sys = createFastChargeSystem({ randFn: () => 0 }); // CD = 3.5s fixed
    makeFast(0, 0);
    makeHero(0, 7);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));

    sys(0.1, Core);   // first charge: elapsed=0.1
    sys(0.29, Core);  // charge expires: entity.v≈4.29, dist≈2.71m
    sys(3.3, Core);   // elapsed=3.69; cooldown elapsed → second charge

    expect(charges.length).toBe(2);
  });

  it("cooldown interval is randomized via randFn", () => {
    // randVal=0.5 → interval = 3.5 + 0.5×2 = 4.5s
    // After charge expires at elapsed≈0.39, need elapsed >= 0.1+4.5=4.6 for re-trigger
    const sys = createFastChargeSystem({ randFn: () => 0.5 });
    makeFast(0, 0);
    makeHero(0, 7);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));

    sys(0.1, Core);   // first charge — interval set to 4.5s; elapsed=0.1
    sys(0.29, Core);  // charge expires; elapsed=0.39
    sys(3.6, Core);   // elapsed=3.99; 3.99-0.1=3.89 < 4.5s → no second charge

    expect(charges.length).toBe(1);

    sys(0.65, Core);  // elapsed=4.64; 4.64-0.1=4.54 >= 4.5s → second charge
    expect(charges.length).toBe(2);
  });
});

// ── Movement during charge ────────────────────────────────────────────────────
describe("createFastChargeSystem — charge movement", () => {
  beforeEach(() => Core._reset());

  it("moves entity at moveSpeed × FAST_CHARGE_SPEED_MUL toward hero", () => {
    const dt = 0.1;
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5); // hero due north (+v direction)

    sys(dt, Core);

    const t = Core.getComponent(fid, "Transform");
    // v component should increase (toward hero at v=5)
    expect(t.v).toBeGreaterThan(0);
    // u component should stay at 0 (hero directly north)
    expect(t.u).toBeCloseTo(0, 5);
    // expected movement: 5.0 * 2.2 * 0.1 = 1.1m per tick in v
    expect(t.v).toBeCloseTo(5.0 * FAST_CHARGE_SPEED_MUL * dt, 5);
  });

  it("chargeDirU/V is a unit vector toward hero", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(3, 4); // 5m away diagonally

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(0.01, Core);

    const ai = Core.getComponent(fid, "EnemyAI");
    const mag = Math.hypot(ai._chargeDirU, ai._chargeDirV);
    expect(mag).toBeCloseTo(1.0, 5);
    // direction: dx=3, dz=4, dist=5 → U=0.6, V=0.8
    expect(ai._chargeDirU).toBeCloseTo(0.6, 5);
    expect(ai._chargeDirV).toBeCloseTo(0.8, 5);
  });

  it("sets _charging = true while chargeDur > 0", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5);

    sys(0.1, Core); // triggers charge, chargeDur = 0.28 after first tick
    expect(Core.getComponent(fid, "EnemyAI")._charging).toBe(true);
  });

  it("clears _charging = false when chargeDur expires", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5);

    sys(0.1, Core);  // trigger: chargeDur set to 0.38
    sys(0.38, Core); // consume remaining duration — charge ends

    expect(Core.getComponent(fid, "EnemyAI")._charging).toBe(false);
    expect(Core.getComponent(fid, "EnemyAI")._chargeDur).toBe(0);
  });

  it("emits fast:charge_ended when duration expires", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);
    makeHero(0, 5);

    const ended = [];
    Core.on("fast:charge_ended", e => ended.push(e));

    sys(0.1, Core);  // trigger
    sys(0.38, Core); // expire

    expect(ended.length).toBe(1);
  });

  it("does not move entity after charge expires", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5);

    sys(0.1, Core);
    sys(0.38, Core); // charge ends

    const t = Core.getComponent(fid, "Transform");
    const posAfterExpiry = t.v;

    // hero moved farther out — outside 2-8m? Actually hero at 5m and entity moved ~1.1m
    // so now entity at ~1.1m, hero still at 5m, dist~3.9m — but cooldown not elapsed
    sys(0.1, Core); // no charge — entity should NOT move

    expect(t.v).toBeCloseTo(posAfterExpiry, 5);
  });
});

// ── Integration with AI movement skipping ────────────────────────────────────
describe("createFastChargeSystem — _charging flag for ai_movement integration", () => {
  beforeEach(() => Core._reset());

  it("_charging is false when not in a charge", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 20); // too far to trigger (> 8m)

    sys(1 / 60, Core);

    expect(Core.getComponent(fid, "EnemyAI")._charging).toBe(false);
  });

  it("_charging persists true across multiple ticks while charging", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    const fid = makeFast(0, 0);
    makeHero(0, 5);

    sys(0.1, Core); // trigger
    expect(Core.getComponent(fid, "EnemyAI")._charging).toBe(true);
    sys(0.1, Core); // still charging (0.38 - 0.1 - 0.1 = 0.18 remaining)
    expect(Core.getComponent(fid, "EnemyAI")._charging).toBe(true);
  });
});

// ── No hero present ───────────────────────────────────────────────────────────
describe("createFastChargeSystem — no hero edge case", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero entity exists", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);

    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not charge when no hero entity exists", () => {
    const sys = createFastChargeSystem({ randFn: () => 0 });
    makeFast(0, 0);

    const charges = [];
    Core.on("fast:charge", e => charges.push(e));
    sys(1 / 60, Core);

    expect(charges.length).toBe(0);
  });
});
