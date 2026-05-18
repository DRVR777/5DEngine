import { describe, it, expect, beforeEach } from "vitest";
import {
  createBossRockSystem,
  BOSS_ROCK_MIN_DIST, BOSS_ROCK_MAX_DIST,
  BOSS_ROCK_CD_NORMAL, BOSS_ROCK_CD_ENRAGED,
  BOSS_ROCK_TOF, BOSS_ROCK_FUSE,
} from "../../src/systems/ecs_boss_rock.js";
import Core from "../../src/core/core.js";

function makeBoss(u = 0, v = 0, hp = 1200) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "boss", heading: 0, moveSpeed: 1.8,
    sightRange: 20, _enraged: false });
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
describe("boss rock constants — monolith line 7276-7298 parity", () => {
  it("BOSS_ROCK_MIN_DIST = 5 (line 7277)",      () => expect(BOSS_ROCK_MIN_DIST).toBe(5));
  it("BOSS_ROCK_MAX_DIST = 15 (line 7277)",     () => expect(BOSS_ROCK_MAX_DIST).toBe(15));
  it("BOSS_ROCK_CD_NORMAL = 6.0 (line 7278)",   () => expect(BOSS_ROCK_CD_NORMAL).toBe(6.0));
  it("BOSS_ROCK_CD_ENRAGED = 3.5 (line 7278)",  () => expect(BOSS_ROCK_CD_ENRAGED).toBe(3.5));
  it("BOSS_ROCK_TOF = 1.8 (line 7280)",         () => expect(BOSS_ROCK_TOF).toBe(1.8));
  it("BOSS_ROCK_FUSE = 2.3 (line 7291: tof+0.5)", () => expect(BOSS_ROCK_FUSE).toBeCloseTo(2.3));
});

// ── Rock throw trigger ────────────────────────────────────────────────────────
describe("createBossRockSystem — throw trigger", () => {
  beforeEach(() => Core._reset());

  it("emits boss:rock_throw when hero in 5–15m range", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 10); // 10m — within 5-15m

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(1);
  });

  it("boss:rock_throw event includes entityId, u, v, targetU, targetV, tof", () => {
    const sys = createBossRockSystem();
    const bid = makeBoss(1, 2);
    makeHero(4, 6); // hero at (4,6)

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks[0].entityId).toBe(bid);
    expect(rocks[0].u).toBe(1);
    expect(rocks[0].v).toBe(2);
    expect(rocks[0].targetU).toBe(4);
    expect(rocks[0].targetV).toBe(6);
    expect(rocks[0].tof).toBe(BOSS_ROCK_TOF);
  });

  it("emits grenade:throw with boss_rock fuse at hero position", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 10);

    const gThrows = [];
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(gThrows.length).toBe(1);
    expect(gThrows[0].fuseOverride).toBe(BOSS_ROCK_FUSE);
    expect(gThrows[0].u).toBe(0);   // hero's u
    expect(gThrows[0].v).toBe(10);  // hero's v
    expect(gThrows[0].kind).toBe("frag");
  });

  it("does NOT throw when hero < 5m (below min)", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 3); // 3m < 5m min

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(0);
  });

  it("does NOT throw when hero exactly at 5m — inclusive boundary fires", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 5); // exactly 5m — dist >= 5 so should fire

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(1);
  });

  it("does NOT throw when hero >= 15m away", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 15); // exactly 15m — not < 15

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(0);
  });

  it("non-boss (grunt) does NOT throw", () => {
    const sys = createBossRockSystem();
    makeGrunt(0, 0);
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(0);
  });

  it("dead boss does NOT throw", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0, 0); // hp=0
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createBossRockSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not throw again before 6s normal cooldown", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));

    sys(0.1, Core); // first throw
    sys(5.5, Core); // 5.6s < 6s → blocked

    expect(rocks.length).toBe(1);
  });

  it("throws again after 6s normal cooldown", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));

    sys(0.1, Core); // first throw: elapsed=0.1
    sys(6.1, Core); // 6.2s > 6s → second throw

    expect(rocks.length).toBe(2);
  });

  it("enraged boss has 3.5s cooldown", () => {
    const sys = createBossRockSystem();
    const bid = makeBoss(0, 0);
    Core.getComponent(bid, "EnemyAI")._enraged = true;
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));

    sys(0.1, Core); // first throw
    sys(3.6, Core); // 3.7s > 3.5s enraged CD → second throw

    expect(rocks.length).toBe(2);
  });

  it("non-enraged boss blocked by full 6s cooldown even after 3.5s", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0); // _enraged = false
    makeHero(0, 10);

    const rocks = [];
    Core.on("boss:rock_throw", e => rocks.push(e));

    sys(0.1, Core); // first throw
    sys(3.6, Core); // 3.7s < 6s normal CD → blocked

    expect(rocks.length).toBe(1);
  });
});

// ── No hero edge case ─────────────────────────────────────────────────────────
describe("createBossRockSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero exists", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);

    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit when no hero exists", () => {
    const sys = createBossRockSystem();
    makeBoss(0, 0);

    const rocks = [], gThrows = [];
    Core.on("boss:rock_throw", e => rocks.push(e));
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(rocks.length).toBe(0);
    expect(gThrows.length).toBe(0);
  });
});
