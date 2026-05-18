import { describe, it, expect, beforeEach } from "vitest";
import {
  createPoisonerDartSystem,
  POISONER_DART_MIN_DIST, POISONER_DART_MAX_DIST,
  POISONER_DART_CD_MIN, POISONER_DART_CD_RAND,
  POISONER_DART_DAMAGE, POISONER_DART_RANGE, POISONER_DART_DIR_Y,
} from "../../src/systems/ecs_poisoner_dart.js";
import Core from "../../src/core/core.js";

function makePoisoner(u = 0, v = 0, hp = 120) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "poisoner", heading: 0, moveSpeed: 1.8, sightRange: 12 });
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
describe("poisoner dart constants — monolith lines 7375-7390 parity", () => {
  it("POISONER_DART_MIN_DIST = 3.5 (line 7376: dist > 3.5)",  () => expect(POISONER_DART_MIN_DIST).toBe(3.5));
  it("POISONER_DART_MAX_DIST = 10 (line 7376: dist < 10)",    () => expect(POISONER_DART_MAX_DIST).toBe(10));
  it("POISONER_DART_CD_MIN = 3.0 (line 7379)",                () => expect(POISONER_DART_CD_MIN).toBe(3.0));
  it("POISONER_DART_CD_RAND = 1.5 (line 7379)",               () => expect(POISONER_DART_CD_RAND).toBe(1.5));
  it("POISONER_DART_DAMAGE = 4 (line 7387)",                  () => expect(POISONER_DART_DAMAGE).toBe(4));
  it("POISONER_DART_RANGE = 11 (line 7387)",                  () => expect(POISONER_DART_RANGE).toBe(11));
  it("POISONER_DART_DIR_Y = 0.18 (line 7387: slight upward)", () => expect(POISONER_DART_DIR_Y).toBe(0.18));
});

// ── Dart trigger ──────────────────────────────────────────────────────────────
describe("createPoisonerDartSystem — dart trigger", () => {
  beforeEach(() => Core._reset());

  it("emits poisoner:venom_dart when poisoner can see hero in 3.5–10m range", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 6); // 6m — within [3.5, 10)

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(1);
  });

  it("venom_dart includes entityId, u, v, dirU, dirV, dirY, speed, damage, range", () => {
    const sys = createPoisonerDartSystem();
    const pid = makePoisoner(0, 0);
    makeHero(0, 6);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts[0].entityId).toBe(pid);
    expect(darts[0].u).toBe(0);
    expect(darts[0].v).toBe(0);
    expect(typeof darts[0].dirU).toBe("number");
    expect(typeof darts[0].dirV).toBe("number");
    expect(darts[0].dirY).toBe(POISONER_DART_DIR_Y);
    expect(typeof darts[0].speed).toBe("number");
    expect(darts[0].damage).toBe(POISONER_DART_DAMAGE);
    expect(darts[0].range).toBe(POISONER_DART_RANGE);
  });

  it("direction points toward hero (dirV > 0 for hero north)", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 6);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts[0].dirV).toBeGreaterThan(0);
    expect(Math.abs(darts[0].dirU)).toBeLessThan(0.01);
  });

  it("does NOT fire when hero is too close (dist <= 3.5m)", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 3.5); // exactly 3.5m — not > 3.5

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(0);
  });

  it("does NOT fire when hero is too far (dist >= 10m)", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 10); // exactly 10m — not < 10

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(0);
  });

  it("does NOT fire when hero is outside sightRange", () => {
    const sys = createPoisonerDartSystem();
    const pid = makePoisoner(0, 0);
    Core.getComponent(pid, "EnemyAI").sightRange = 4;
    makeHero(0, 6); // 6m > sightRange(4)

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(0);
  });

  it("non-poisoner enemy does NOT emit venom_dart", () => {
    const sys = createPoisonerDartSystem();
    makeGrunt();
    makeHero(0, 6);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(0);
  });

  it("dead poisoner does NOT fire", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0, 0); // hp=0
    makeHero(0, 6);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    expect(darts.length).toBe(0);
  });

  it("does not crash with no hero", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});

// ── Speed calculation ─────────────────────────────────────────────────────────
describe("createPoisonerDartSystem — distance-based speed", () => {
  beforeEach(() => Core._reset());

  it("speed = dist / (0.9 + dist/14) for dist=6", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 6);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    const dist = 6;
    const tof = 0.9 + dist / 14;
    const expectedSpeed = dist / tof;
    expect(darts[0].speed).toBeCloseTo(expectedSpeed, 5);
  });

  it("speed = dist / (0.9 + dist/14) for dist=4", () => {
    const sys = createPoisonerDartSystem();
    makePoisoner(0, 0);
    makeHero(0, 4);

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(1 / 60, Core);

    const dist = 4;
    const tof = 0.9 + dist / 14;
    const expectedSpeed = dist / tof;
    expect(darts[0].speed).toBeCloseTo(expectedSpeed, 5);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createPoisonerDartSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not fire again within 3.0s minimum CD", () => {
    const sys = createPoisonerDartSystem();
    const pid = makePoisoner(0, 0);
    makeHero(0, 6);
    // Force fixed interval to avoid random CD
    Core.getComponent(pid, "EnemyAI")._dartInterval = POISONER_DART_CD_MIN;

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(0.1, Core); // shot 1
    sys(2.8, Core); // 2.9s < 3.0s CD
    expect(darts.length).toBe(1);
  });

  it("fires again after CD elapses", () => {
    const sys = createPoisonerDartSystem();
    const pid = makePoisoner(0, 0);
    makeHero(0, 6);
    Core.getComponent(pid, "EnemyAI")._dartInterval = POISONER_DART_CD_MIN;

    const darts = [];
    Core.on("poisoner:venom_dart", e => darts.push(e));
    sys(0.1, Core);  // shot 1 at elapsed=0.1; _dartInterval randomized 3.0-4.5
    sys(4.6, Core);  // elapsed=4.7; 4.6s > max possible CD (4.5) → shot 2
    expect(darts.length).toBe(2);
  });

  it("randomized CD is within 3.0–4.5s range", () => {
    const sys = createPoisonerDartSystem();
    const pid = makePoisoner(0, 0);
    makeHero(0, 6);

    Core.on("poisoner:venom_dart", () => {});
    sys(0.1, Core); // triggers dart + sets _dartInterval

    const ai = Core.getComponent(pid, "EnemyAI");
    expect(ai._dartInterval).toBeGreaterThanOrEqual(POISONER_DART_CD_MIN);
    expect(ai._dartInterval).toBeLessThanOrEqual(POISONER_DART_CD_MIN + POISONER_DART_CD_RAND);
  });
});
