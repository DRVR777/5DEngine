import { describe, it, expect, beforeEach } from "vitest";
import {
  createHeavyThrowSystem,
  HEAVY_THROW_MIN_DIST, HEAVY_THROW_MAX_DIST,
  HEAVY_THROW_CD_NORMAL, HEAVY_THROW_CD_ENRAGED,
  HEAVY_THROW_TOF, HEAVY_THROW_FUSE,
} from "../../src/systems/ecs_heavy_throw.js";
import Core from "../../src/core/core.js";

function makeHeavy(u = 0, v = 0, hp = 200) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "heavy", heading: 0, moveSpeed: 1.2,
    sightRange: 10, _enraged: false });
  return id;
}

function makeHero(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  return id;
}

function makeGrunt(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("heavy throw constants — monolith line 7254-7275 parity", () => {
  it("HEAVY_THROW_MIN_DIST = 3.5 (line 7255)",    () => expect(HEAVY_THROW_MIN_DIST).toBe(3.5));
  it("HEAVY_THROW_MAX_DIST = 12.0 (line 7255)",   () => expect(HEAVY_THROW_MAX_DIST).toBe(12.0));
  it("HEAVY_THROW_CD_NORMAL = 4.0 (line 7256)",   () => expect(HEAVY_THROW_CD_NORMAL).toBe(4.0));
  it("HEAVY_THROW_CD_ENRAGED = 2.5 (line 7256)",  () => expect(HEAVY_THROW_CD_ENRAGED).toBe(2.5));
  it("HEAVY_THROW_TOF = 1.5 (line 7258)",         () => expect(HEAVY_THROW_TOF).toBe(1.5));
  it("HEAVY_THROW_FUSE = 1.8 (line 7269: tof+0.3)", () => expect(HEAVY_THROW_FUSE).toBeCloseTo(1.8));
});

// ── Throw trigger ─────────────────────────────────────────────────────────────
describe("createHeavyThrowSystem — throw trigger", () => {
  beforeEach(() => Core._reset());

  it("emits heavy:grenade_throw when hero in 3.5–12m range", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 7); // 7m — within 3.5-12m

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(1);
  });

  it("heavy:grenade_throw event includes entityId, u, v, targetU, targetV, tof", () => {
    const sys = createHeavyThrowSystem();
    const hid = makeHeavy(2, 3);
    makeHero(5, 7); // hero at (5,7)

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws[0].entityId).toBe(hid);
    expect(throws[0].u).toBe(2);
    expect(throws[0].v).toBe(3);
    expect(throws[0].targetU).toBe(5);
    expect(throws[0].targetV).toBe(7);
    expect(throws[0].tof).toBe(HEAVY_THROW_TOF);
  });

  it("emits grenade:throw with correct fuse and hero position", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 7);

    const gThrows = [];
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(gThrows.length).toBe(1);
    expect(gThrows[0].fuseOverride).toBe(HEAVY_THROW_FUSE);
    expect(gThrows[0].u).toBe(0);  // hero's u
    expect(gThrows[0].v).toBe(7);  // hero's v
  });

  it("does NOT throw when hero exactly at 3.5m (exclusive)", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 3.5); // exactly 3.5m

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });

  it("does NOT throw when hero exactly at 12m (exclusive)", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 12); // exactly 12m

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });

  it("does NOT throw when hero < 3.5m", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 2); // 2m — too close

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });

  it("does NOT throw when hero > 12m away", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 13); // 13m — too far

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });

  it("non-heavy (grunt) does NOT throw", () => {
    const sys = createHeavyThrowSystem();
    makeGrunt(0, 0);
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });

  it("dead heavy does NOT throw", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0, 0); // hp=0
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createHeavyThrowSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not throw again before 4s normal cooldown", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));

    sys(0.1, Core); // first throw
    sys(3.5, Core); // 3.6s < 4s CD — blocked

    expect(throws.length).toBe(1);
  });

  it("throws again after 4s normal cooldown elapses", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));

    sys(0.1, Core); // first throw
    sys(4.1, Core); // 4.2s > 4s CD → second throw

    expect(throws.length).toBe(2);
  });

  it("enraged heavy has 2.5s cooldown", () => {
    const sys = createHeavyThrowSystem();
    const hid = makeHeavy(0, 0);
    Core.getComponent(hid, "EnemyAI")._enraged = true;
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));

    sys(0.1, Core); // first throw
    sys(2.6, Core); // 2.7s > 2.5s enraged CD → second throw

    expect(throws.length).toBe(2);
  });

  it("enraged heavy blocked by normal CD when not enraged", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0); // _enraged = false
    makeHero(0, 7);

    const throws = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));

    sys(0.1, Core); // first throw
    sys(2.6, Core); // 2.7s < 4s normal CD → blocked

    expect(throws.length).toBe(1);
  });
});

// ── No hero edge case ─────────────────────────────────────────────────────────
describe("createHeavyThrowSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero exists", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);

    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit when no hero exists", () => {
    const sys = createHeavyThrowSystem();
    makeHeavy(0, 0);

    const throws = [], gThrows = [];
    Core.on("heavy:grenade_throw", e => throws.push(e));
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(throws.length).toBe(0);
    expect(gThrows.length).toBe(0);
  });
});
