import { describe, it, expect, beforeEach } from "vitest";
import {
  createIncendiaryBombSystem,
  INCENDIARY_BOMB_MIN_DIST, INCENDIARY_BOMB_MAX_DIST,
  INCENDIARY_BOMB_CD, INCENDIARY_BOMB_TOF, INCENDIARY_BOMB_FUSE,
} from "../../src/systems/ecs_incendiary_bomb.js";
import Core from "../../src/core/core.js";

function makeIncendiary(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "incendiary", heading: 0, moveSpeed: 2.2,
    sightRange: 12 });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function makeGrunt() {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("incendiary bomb constants — monolith line 7322-7344 parity", () => {
  it("INCENDIARY_BOMB_MIN_DIST = 4 (line 7323)",   () => expect(INCENDIARY_BOMB_MIN_DIST).toBe(4));
  it("INCENDIARY_BOMB_MAX_DIST = 12 (line 7323)",  () => expect(INCENDIARY_BOMB_MAX_DIST).toBe(12));
  it("INCENDIARY_BOMB_CD = 5.0 (line 7324)",       () => expect(INCENDIARY_BOMB_CD).toBe(5.0));
  it("INCENDIARY_BOMB_TOF = 1.4 (line 7326)",      () => expect(INCENDIARY_BOMB_TOF).toBe(1.4));
  it("INCENDIARY_BOMB_FUSE = 1.7 (line 7337: tof+0.3)", () => expect(INCENDIARY_BOMB_FUSE).toBeCloseTo(1.7));
});

// ── Bomb trigger ──────────────────────────────────────────────────────────────
describe("createIncendiaryBombSystem — bomb trigger", () => {
  beforeEach(() => Core._reset());

  it("emits incendiary:fireball when hero in 4–12m range", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 8); // 8m — in range

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(1);
  });

  it("fireball event includes entityId, u, v, targetU, targetV, tof", () => {
    const sys = createIncendiaryBombSystem();
    const iid = makeIncendiary(1, 2);
    makeHero(5, 8);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires[0].entityId).toBe(iid);
    expect(fires[0].u).toBe(1);
    expect(fires[0].v).toBe(2);
    expect(fires[0].targetU).toBe(5);
    expect(fires[0].targetV).toBe(8);
    expect(fires[0].tof).toBe(INCENDIARY_BOMB_TOF);
  });

  it("emits grenade:throw at hero position with correct fuse", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 8);

    const gThrows = [];
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(gThrows[0].fuseOverride).toBe(INCENDIARY_BOMB_FUSE);
    expect(gThrows[0].u).toBe(0);
    expect(gThrows[0].v).toBe(8);
  });

  it("does NOT throw when hero <= 4m (exclusive min)", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 4); // exactly 4m

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });

  it("does NOT throw when hero >= 12m (exclusive max)", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 12); // exactly 12m

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });

  it("does NOT throw when hero < 4m", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 2);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });

  it("does NOT throw when hero > 12m", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 13);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });

  it("non-incendiary (grunt) does NOT throw", () => {
    const sys = createIncendiaryBombSystem();
    makeGrunt();
    makeHero(0, 8);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });

  it("dead incendiary does NOT throw", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0, 0); // hp=0
    makeHero(0, 8);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createIncendiaryBombSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not throw again before 5s cooldown", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 8);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));

    sys(0.1, Core); // first throw
    sys(4.5, Core); // 4.6s < 5s → blocked

    expect(fires.length).toBe(1);
  });

  it("throws again after 5s cooldown elapses", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    makeHero(0, 8);

    const fires = [];
    Core.on("incendiary:fireball", e => fires.push(e));

    sys(0.1, Core); // first throw: elapsed=0.1
    sys(5.1, Core); // 5.2s > 5s → second throw

    expect(fires.length).toBe(2);
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createIncendiaryBombSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero exists", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit when no hero exists", () => {
    const sys = createIncendiaryBombSystem();
    makeIncendiary(0, 0);

    const fires = [], gThrows = [];
    Core.on("incendiary:fireball", e => fires.push(e));
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(fires.length).toBe(0);
    expect(gThrows.length).toBe(0);
  });
});
