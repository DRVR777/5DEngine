import { describe, it, expect, beforeEach } from "vitest";
import {
  createBossSlamSystem,
  SLAM_TRIGGER_DIST, SLAM_RADIUS, SLAM_DMG,
  SLAM_FRIENDLY_DIST, SLAM_FRIENDLY_DMG,
  SLAM_CD_NORMAL, SLAM_CD_ENRAGED,
} from "../../src/systems/ecs_boss_slam.js";
import Core from "../../src/core/core.js";

function makeBoss(u = 0, v = 0, hp = 1200) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "boss", heading: 0, moveSpeed: 1.8,
    _enraged: false, _slamT: null });
  return id;
}

function makeHero(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  return id;
}

function makeEnemy(type = "grunt", u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type, heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("boss slam constants — monolith line 7345-7373 parity", () => {
  it("SLAM_TRIGGER_DIST = 4 (line 7346)",   () => expect(SLAM_TRIGGER_DIST).toBe(4));
  it("SLAM_RADIUS = 5 (line 7354)",         () => expect(SLAM_RADIUS).toBe(5));
  it("SLAM_DMG = 50 (line 7354)",           () => expect(SLAM_DMG).toBe(50));
  it("SLAM_FRIENDLY_DIST = 3 (line 7369)",  () => expect(SLAM_FRIENDLY_DIST).toBe(3));
  it("SLAM_FRIENDLY_DMG = 30 (line 7370)",  () => expect(SLAM_FRIENDLY_DMG).toBe(30));
  it("SLAM_CD_NORMAL = 5.0 (line 7347)",    () => expect(SLAM_CD_NORMAL).toBe(5.0));
  it("SLAM_CD_ENRAGED = 2.8 (line 7347)",   () => expect(SLAM_CD_ENRAGED).toBe(2.8));
});

// ── Slam trigger ──────────────────────────────────────────────────────────────
describe("createBossSlamSystem — slam trigger", () => {
  beforeEach(() => Core._reset());

  it("emits boss:slam when hero within 4m on first tick", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 3); // 3m away < 4m trigger

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));

    sys(1 / 60, Core);

    expect(slams.length).toBe(1);
    expect(slams[0].u).toBe(0);
    expect(slams[0].v).toBe(0);
    expect(slams[0].radius).toBe(SLAM_RADIUS);
  });

  it("does NOT slam when hero is > 4m away", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 5); // 5m > 4m

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));
    sys(1 / 60, Core);

    expect(slams.length).toBe(0);
  });

  it("non-boss enemies do not slam", () => {
    const sys = createBossSlamSystem();
    const id = makeEnemy("heavy");
    // Override type to trick: heavy is not boss
    makeHero(0, 0);

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));
    sys(1 / 60, Core);

    expect(slams.length).toBe(0);
  });

  it("dead boss does not slam", () => {
    const sys = createBossSlamSystem();
    const bid = makeBoss(0, 0, 0); // dead
    makeHero(0, 1);

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));
    sys(1 / 60, Core);

    expect(slams.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createBossSlamSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not slam again before SLAM_CD_NORMAL (5s) elapsed", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 2);

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));

    sys(0.1, Core); // first slam
    sys(0.1, Core); // immediately after — too soon

    expect(slams.length).toBe(1);
  });

  it("slams again after SLAM_CD_NORMAL (5s) has elapsed", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 2);

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));

    sys(0.1, Core); // first slam
    sys(5.1, Core); // 5.2s total > 5s CD

    expect(slams.length).toBe(2);
  });

  it("enraged boss has shorter cooldown (2.8s)", () => {
    const sys = createBossSlamSystem();
    const bid = makeBoss(0, 0);
    Core.getComponent(bid, "EnemyAI")._enraged = true;
    makeHero(0, 2);

    const slams = [];
    Core.on("boss:slam", e => slams.push(e));

    sys(0.1, Core); // first slam
    sys(3.0, Core); // 3.1s total > 2.8s enraged CD

    expect(slams.length).toBe(2);
  });
});

// ── Hero damage ───────────────────────────────────────────────────────────────
describe("createBossSlamSystem — hero damage", () => {
  beforeEach(() => Core._reset());

  it("hero at dist=0 takes full SLAM_DMG = 50", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    const hid = makeHero(0, 0, 200); // at boss position

    sys(0.1, Core);

    expect(Core.getComponent(hid, "Health").hp).toBe(150); // 200 - 50
  });

  it("hero at dist=2.5m (half radius) takes round(50 × 0.5) = 25 dmg", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    const hid = makeHero(0, 2.5, 200); // 2.5m = half of 5m radius

    sys(0.1, Core);

    expect(Core.getComponent(hid, "Health").hp).toBe(175); // 200 - 25
  });

  it("hero at dist=3.9m (just inside trigger range) takes some damage", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    const hid = makeHero(0, 3.9, 200);

    sys(0.1, Core);

    expect(Core.getComponent(hid, "Health").hp).toBeLessThan(200);
  });

  it("emits hero:damaged event on hit", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 0, 200);

    const damaged = [];
    Core.on("hero:damaged", e => damaged.push(e));
    sys(0.1, Core);

    expect(damaged.length).toBe(1);
    expect(damaged[0].type).toBe("boss_slam");
  });

  it("dead hero is not damaged", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    const hid = makeHero(0, 0, 100);
    Core.getComponent(hid, "Health").hp = 0; // already dead

    const damaged = [];
    Core.on("hero:damaged", e => damaged.push(e));
    sys(0.1, Core);

    expect(damaged.length).toBe(0);
  });
});

// ── Friendly fire on other enemies ───────────────────────────────────────────
describe("createBossSlamSystem — friendly fire on nearby enemies", () => {
  beforeEach(() => Core._reset());

  it("enemy within 3m of boss takes SLAM_FRIENDLY_DMG = 30", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 1); // hero close enough to trigger slam
    const eid = makeEnemy("grunt", 2, 0, 80); // 2m away < 3m friendly radius

    sys(0.1, Core);

    expect(Core.getComponent(eid, "Health").hp).toBe(50); // 80 - 30
  });

  it("enemy > 3m from boss NOT hit by friendly fire", () => {
    const sys = createBossSlamSystem();
    makeBoss(0, 0);
    makeHero(0, 1);
    const eid = makeEnemy("grunt", 4, 0, 80); // 4m away > 3m threshold

    sys(0.1, Core);

    expect(Core.getComponent(eid, "Health").hp).toBe(80); // no damage
  });

  it("boss is not damaged by its own friendly fire", () => {
    const sys = createBossSlamSystem();
    const bid = makeBoss(0, 0, 1200);
    makeHero(0, 1);

    sys(0.1, Core);

    expect(Core.getComponent(bid, "Health").hp).toBe(1200); // unchanged
  });
});
