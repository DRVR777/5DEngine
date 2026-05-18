import { describe, it, expect, beforeEach } from "vitest";
import {
  createRobotEmpSystem,
  ROBOT_EMP_TRIGGER_DIST, ROBOT_EMP_EFFECT_DIST,
  ROBOT_EMP_CD, ROBOT_EMP_DUR,
} from "../../src/systems/ecs_robot_emp.js";
import Core from "../../src/core/core.js";

function makeRobot(u = 0, v = 0, hp = 150) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "robot", heading: 0, moveSpeed: 1.0,
    sightRange: 14 });
  return id;
}

function makeHero(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
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
describe("robot EMP constants — monolith line 7234-7253 parity", () => {
  it("ROBOT_EMP_TRIGGER_DIST = 12 (line 7235)", () => expect(ROBOT_EMP_TRIGGER_DIST).toBe(12));
  it("ROBOT_EMP_EFFECT_DIST = 4 (line 7247)",   () => expect(ROBOT_EMP_EFFECT_DIST).toBe(4));
  it("ROBOT_EMP_CD = 8.0 (line 7236)",          () => expect(ROBOT_EMP_CD).toBe(8.0));
  it("ROBOT_EMP_DUR = 2.5 (line 7248)",         () => expect(ROBOT_EMP_DUR).toBe(2.5));
});

// ── EMP trigger ───────────────────────────────────────────────────────────────
describe("createRobotEmpSystem — EMP trigger", () => {
  beforeEach(() => Core._reset());

  it("emits robot:emp when hero within 12m on first tick", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 10); // 10m < 12m trigger

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(1);
  });

  it("robot:emp event includes entityId, u, v", () => {
    const sys = createRobotEmpSystem();
    const rid = makeRobot(3, 4);
    makeHero(0, 0); // 5m away — within 12m

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps[0].entityId).toBe(rid);
    expect(emps[0].u).toBe(3);
    expect(emps[0].v).toBe(4);
  });

  it("does NOT emit when hero exactly at 12m (exclusive)", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 12); // exactly 12m

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
  });

  it("does NOT emit when hero > 12m away", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 13); // 13m > 12m

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
  });

  it("non-robot (grunt) does NOT emit robot:emp", () => {
    const sys = createRobotEmpSystem();
    makeGrunt(0, 0);
    makeHero(0, 5);

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
  });

  it("dead robot does NOT emit robot:emp", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0, 0); // hp=0
    makeHero(0, 5);

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
  });

  it("hero beyond sight range does NOT trigger EMP", () => {
    const sys = createRobotEmpSystem();
    const rid = makeRobot(0, 0);
    Core.getComponent(rid, "EnemyAI").sightRange = 8; // shorter than trigger dist
    makeHero(0, 10); // 10m — beyond sight(8) but within trigger(12)

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
  });
});

// ── Hero emped effect ─────────────────────────────────────────────────────────
describe("createRobotEmpSystem — hero:emped effect", () => {
  beforeEach(() => Core._reset());

  it("emits hero:emped when hero within 4m", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 3); // 3m < 4m effect dist

    const emped = [];
    Core.on("hero:emped", e => emped.push(e));
    sys(1 / 60, Core);

    expect(emped.length).toBe(1);
  });

  it("hero:emped includes duration = ROBOT_EMP_DUR and sourceId", () => {
    const sys = createRobotEmpSystem();
    const rid = makeRobot(0, 0);
    makeHero(0, 2);

    const emped = [];
    Core.on("hero:emped", e => emped.push(e));
    sys(1 / 60, Core);

    expect(emped[0].duration).toBe(ROBOT_EMP_DUR);
    expect(emped[0].sourceId).toBe(rid);
  });

  it("does NOT emit hero:emped when hero > 4m away (even though robot:emp fires)", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 8); // 8m — within trigger(12) but beyond effect(4)

    const emped = [];
    Core.on("hero:emped", e => emped.push(e));
    const emps = [];
    Core.on("robot:emp", e => emps.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(1);   // robot:emp fires
    expect(emped.length).toBe(0);  // but no hero:emped
  });

  it("does NOT emit hero:emped when hero is dead", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    const hid = makeHero(0, 2, 100);
    Core.getComponent(hid, "Health").hp = 0; // dead

    const emped = [];
    Core.on("hero:emped", e => emped.push(e));
    sys(1 / 60, Core);

    expect(emped.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createRobotEmpSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not EMP again before 8s cooldown", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 5);

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));

    sys(0.1, Core); // first EMP
    sys(0.1, Core); // immediately after — blocked
    sys(7.0, Core); // 7.2s total < 8s CD — still blocked

    expect(emps.length).toBe(1);
  });

  it("EMPs again after 8s cooldown elapses", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);
    makeHero(0, 5);

    const emps = [];
    Core.on("robot:emp", e => emps.push(e));

    sys(0.1, Core); // first EMP: elapsed=0.1
    sys(8.1, Core); // 8.2s > 8s CD → second EMP

    expect(emps.length).toBe(2);
  });
});

// ── No hero edge case ─────────────────────────────────────────────────────────
describe("createRobotEmpSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero exists", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);

    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit any events when no hero exists", () => {
    const sys = createRobotEmpSystem();
    makeRobot(0, 0);

    const emps = [], emped = [];
    Core.on("robot:emp", e => emps.push(e));
    Core.on("hero:emped", e => emped.push(e));
    sys(1 / 60, Core);

    expect(emps.length).toBe(0);
    expect(emped.length).toBe(0);
  });
});
