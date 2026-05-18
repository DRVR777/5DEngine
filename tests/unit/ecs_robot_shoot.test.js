import { describe, it, expect, beforeEach } from "vitest";
import {
  createRobotShootSystem,
  ROBOT_SHOOT_RANGE, ROBOT_SHOOT_CD,
  ROBOT_SHOOT_SPEED, ROBOT_SHOOT_DAMAGE, ROBOT_SHOOT_MAX_RANGE,
} from "../../src/systems/ecs_robot_shoot.js";
import Core from "../../src/core/core.js";

function makeRobot(u = 0, v = 0, hp = 350) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "robot", heading: 0, moveSpeed: 1.0, sightRange: 14 });
  return id;
}

function makeGrunt() {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4, sightRange: 12 });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("robot shoot constants — monolith lines 7215-7232 parity", () => {
  it("ROBOT_SHOOT_RANGE = 10 (line 7216: dist < 10)",  () => expect(ROBOT_SHOOT_RANGE).toBe(10));
  it("ROBOT_SHOOT_CD = 1.5 (line 7217: 1.5s CD)",     () => expect(ROBOT_SHOOT_CD).toBe(1.5));
  it("ROBOT_SHOOT_SPEED = 14 (line 7230)",             () => expect(ROBOT_SHOOT_SPEED).toBe(14));
  it("ROBOT_SHOOT_DAMAGE = 12 (line 7230)",            () => expect(ROBOT_SHOOT_DAMAGE).toBe(12));
  it("ROBOT_SHOOT_MAX_RANGE = 12 (line 7230)",         () => expect(ROBOT_SHOOT_MAX_RANGE).toBe(12));
});

// ── Shot trigger ──────────────────────────────────────────────────────────────
describe("createRobotShootSystem — shot trigger", () => {
  beforeEach(() => Core._reset());

  it("emits robot:plasma_shot when robot can see hero within 10m", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    makeHero(0, 8); // 8m < 10m

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots.length).toBe(1);
  });

  it("plasma_shot includes entityId, u, v, dirU, dirV, speed, damage, range", () => {
    const sys = createRobotShootSystem();
    const rid = makeRobot(0, 0);
    makeHero(0, 8);

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots[0].entityId).toBe(rid);
    expect(shots[0].u).toBe(0);
    expect(shots[0].v).toBe(0);
    expect(shots[0].speed).toBe(ROBOT_SHOOT_SPEED);
    expect(shots[0].damage).toBe(ROBOT_SHOOT_DAMAGE);
    expect(shots[0].range).toBe(ROBOT_SHOOT_MAX_RANGE);
  });

  it("direction points toward hero (dirV > 0 for hero at north)", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    makeHero(0, 8); // hero north

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots[0].dirV).toBeGreaterThan(0);
    expect(Math.abs(shots[0].dirU)).toBeLessThan(0.01);
  });

  it("does NOT fire when hero >= 10m away", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    makeHero(0, 10); // exactly 10m — not < 10

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots.length).toBe(0);
  });

  it("does NOT fire when hero is out of sightRange", () => {
    const sys = createRobotShootSystem();
    const rid = makeRobot(0, 0);
    Core.getComponent(rid, "EnemyAI").sightRange = 5;
    makeHero(0, 8); // 8m > sightRange(5)

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots.length).toBe(0);
  });

  it("non-robot enemy (grunt) does NOT emit plasma_shot", () => {
    const sys = createRobotShootSystem();
    makeGrunt();
    makeHero(0, 5);

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots.length).toBe(0);
  });

  it("dead robot does NOT fire", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0, 0); // hp=0
    makeHero(0, 8);

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(1 / 60, Core);

    expect(shots.length).toBe(0);
  });

  it("does not crash with no hero", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createRobotShootSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not fire again within 1.5s CD", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    makeHero(0, 8);

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(0.1, Core); // shot 1
    sys(1.3, Core); // 1.4s < 1.5s CD
    expect(shots.length).toBe(1);
  });

  it("fires again after 1.5s CD elapses", () => {
    const sys = createRobotShootSystem();
    makeRobot(0, 0);
    makeHero(0, 8);

    const shots = [];
    Core.on("robot:plasma_shot", e => shots.push(e));
    sys(0.1, Core);  // shot 1 at elapsed=0.1
    sys(1.6, Core);  // 1.7s > 1.5 → shot 2
    expect(shots.length).toBe(2);
  });
});
