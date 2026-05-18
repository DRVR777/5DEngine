import { describe, it, expect, beforeEach } from "vitest";
import { createAIMovementSystem } from "../../src/systems/ecs_ai_movement.js";
import Core from "../../src/core/core.js";

// ── helpers ──────────────────────────────────────────────────────────────────
function makeEnemy(opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "EnemyAI", {
    type:        opts.type        ?? "grunt",
    state:       opts.state       ?? "wander",
    sightRange:  opts.sightRange  ?? 12,
    attackRange: opts.attackRange ?? 1.6,
    moveSpeed:   opts.moveSpeed   ?? 2.4,
    wanderSpeed: opts.wanderSpeed ?? 1.0,
    _wasChasing: false,
    _patrolAngle: opts._patrolAngle ?? 0,
    _patrolR:     opts._patrolR     ?? 0,
    _originU:     opts._originU     ?? null,
    _originV:     opts._originV     ?? null,
  });
  Core.addComponent(id, "Transform", {
    u: opts.u ?? 0,
    v: opts.v ?? 0,
    y: 0,
  });
  Core.addComponent(id, "Health", { hp: opts.hp ?? 80, maxHp: 80 });
  Core.addComponent(id, "Faction", { id: "enemy" });
  return id;
}

function makeHero(opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Faction",       { id: "player" });
  Core.addComponent(id, "Transform",     { u: opts.u ?? 0, v: opts.v ?? 0, y: 0 });
  return id;
}

// ── tests ────────────────────────────────────────────────────────────────────
describe("createAIMovementSystem — wander state", () => {
  beforeEach(() => Core._reset());

  it("enemy in wander state moves (Transform changes over a tick)", () => {
    const sys = createAIMovementSystem();
    const eid = makeEnemy({ u: 0, v: 0, _originU: 0, _originV: 0, _patrolAngle: 0, _patrolR: 0 });
    const before = { ...Core.getComponent(eid, "Transform") };

    sys(0.016, Core);

    const after = Core.getComponent(eid, "Transform");
    const moved = Math.hypot(after.u - before.u, after.v - before.v);
    expect(moved).toBeGreaterThan(0);
  });

  it("wander speed is respected (lower speed → smaller movement delta)", () => {
    const sys = createAIMovementSystem();
    const slow = makeEnemy({ u: 0, v: 0, wanderSpeed: 0.5, _originU: 0, _originV: 0, _patrolAngle: 0, _patrolR: 0 });

    sys(1.0, Core);

    const t = Core.getComponent(slow, "Transform");
    const dist = Math.hypot(t.u, t.v);
    expect(dist).toBeLessThan(2); // slow enemy should not travel far in 1s
  });

  it("dead enemy (hp=0) skips wander movement", () => {
    const sys = createAIMovementSystem();
    const eid = makeEnemy({ u: 5, v: 5, hp: 0 });
    const before = { ...Core.getComponent(eid, "Transform") };

    sys(1.0, Core);

    const after = Core.getComponent(eid, "Transform");
    expect(after.u).toBe(before.u);
    expect(after.v).toBe(before.v);
  });

  it("sets _originU/_originV on first wander tick if null", () => {
    const sys = createAIMovementSystem();
    const eid = makeEnemy({ u: 7, v: 3 });
    Core.getComponent(eid, "EnemyAI")._originU = null;
    Core.getComponent(eid, "EnemyAI")._originV = null;

    sys(0.016, Core);

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._originU).toBe(7);
    expect(ai._originV).toBe(3);
  });
});

describe("createAIMovementSystem — detection + alert", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:alerted on first detection (hero within sightRange)", () => {
    const sys = createAIMovementSystem();
    const hid = makeHero({ u: 5, v: 0 }); // 5m away
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "wander" });

    const events = [];
    Core.on("enemy:alerted", e => events.push(e));

    sys(0.016, Core);

    expect(events.length).toBe(1);
    expect(events[0].enemyId).toBe(eid);
    expect(events[0].heroId).toBe(hid);
  });

  it("enemy:alerted fires only once (not every tick)", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 5, v: 0 });
    makeEnemy({ u: 0, v: 0, sightRange: 12, state: "wander" });

    const events = [];
    Core.on("enemy:alerted", e => events.push(e));

    sys(0.016, Core);
    sys(0.016, Core);
    sys(0.016, Core);

    expect(events.length).toBe(1);
  });

  it("enemy transitions state to chase after spotting hero", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 5, v: 0 });
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "wander" });

    sys(0.016, Core);

    expect(Core.getComponent(eid, "EnemyAI").state).toBe("chase");
  });

  it("enemy out of sightRange stays in wander", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 30, v: 0 }); // 30m away, sightRange=12
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "wander" });

    const events = [];
    Core.on("enemy:alerted", e => events.push(e));

    sys(0.016, Core);

    expect(Core.getComponent(eid, "EnemyAI").state).toBe("wander");
    expect(events.length).toBe(0);
  });
});

describe("createAIMovementSystem — chase state", () => {
  beforeEach(() => Core._reset());

  it("chasing enemy moves toward hero", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 10, v: 0 });
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase", moveSpeed: 2.4, attackRange: 1.6 });
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    sys(1.0, Core);

    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBeGreaterThan(0); // moved in +u direction toward hero
  });

  it("chasing enemy does not move past hero (clamps within attackRange)", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 1, v: 0 });
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase", attackRange: 1.6, moveSpeed: 5 });
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    sys(0.016, Core);

    const t = Core.getComponent(eid, "Transform");
    const dist = Math.hypot(t.u - 1, t.v);
    // Should stop once within attackRange, not overshoot significantly
    // (hero is 1m away, attackRange is 1.6m, so already in range — no movement expected)
    expect(t.u).toBe(0); // already in attack range, no movement
  });

  it("emits enemy:reached_attack_range when within attackRange", () => {
    const sys = createAIMovementSystem();
    const hid = makeHero({ u: 1, v: 0 }); // 1m away, attackRange=1.6
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase", attackRange: 1.6 });
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    const events = [];
    Core.on("enemy:reached_attack_range", e => events.push(e));

    sys(0.016, Core);

    expect(events.length).toBe(1);
    expect(events[0].enemyId).toBe(eid);
    expect(events[0].heroId).toBe(hid);
  });

  it("does not emit reached_attack_range when outside attackRange", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 8, v: 0 }); // 8m away, attackRange=1.6
    makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase", attackRange: 1.6 });

    const events = [];
    Core.on("enemy:reached_attack_range", e => events.push(e));

    sys(0.016, Core);

    expect(events.length).toBe(0);
  });

  it("moveSpeed affects how far enemy travels toward hero in one tick", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 20, v: 0 });
    const slow = makeEnemy({ u: 0, v: 0, sightRange: 25, state: "chase", moveSpeed: 1.0, attackRange: 1.0 });
    Core.getComponent(slow, "EnemyAI")._wasChasing = true;

    sys(1.0, Core);

    const t = Core.getComponent(slow, "Transform");
    expect(t.u).toBeCloseTo(1.0, 5); // moveSpeed=1, dt=1s → moved ~1m
  });
});

describe("createAIMovementSystem — lose range / return to wander", () => {
  beforeEach(() => Core._reset());

  it("enemy returns to wander when hero exceeds loseRange (sightRange × 2.5)", () => {
    const sys = createAIMovementSystem();
    // Hero at 35m, sightRange=12, loseRange=30 → hero is beyond loseRange
    makeHero({ u: 35, v: 0 });
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase" });
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    sys(0.016, Core);

    expect(Core.getComponent(eid, "EnemyAI").state).toBe("wander");
    expect(Core.getComponent(eid, "EnemyAI")._wasChasing).toBe(false);
  });

  it("enemy stays in chase if hero is beyond sightRange but within loseRange", () => {
    const sys = createAIMovementSystem();
    // Hero at 20m, sightRange=12, loseRange=30 → hero is between sightRange and loseRange
    makeHero({ u: 20, v: 0 });
    const eid = makeEnemy({ u: 0, v: 0, sightRange: 12, state: "chase" });
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    sys(0.016, Core);

    expect(Core.getComponent(eid, "EnemyAI").state).toBe("chase");
  });
});

describe("createAIMovementSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("enemy stays in wander with no hero present", () => {
    const sys = createAIMovementSystem();
    const eid = makeEnemy({ u: 0, v: 0, state: "wander" });

    const events = [];
    Core.on("enemy:alerted", e => events.push(e));

    sys(0.016, Core);

    expect(Core.getComponent(eid, "EnemyAI").state).toBe("wander");
    expect(events.length).toBe(0);
  });
});

describe("createAIMovementSystem — enemy type defaults", () => {
  beforeEach(() => Core._reset());

  it("fast enemy with moveSpeed=5 moves farther in 1s than grunt with moveSpeed=2.4", () => {
    const sys = createAIMovementSystem();
    makeHero({ u: 20, v: 0 });

    const grunt = makeEnemy({ u: 0, v: 0, sightRange: 25, state: "chase", moveSpeed: 2.4, attackRange: 1.0 });
    Core.getComponent(grunt, "EnemyAI")._wasChasing = true;
    sys(1.0, Core);
    const gruntDist = Core.getComponent(grunt, "Transform").u;

    Core._reset();
    makeHero({ u: 20, v: 0 });
    const fast = makeEnemy({ u: 0, v: 0, sightRange: 25, state: "chase", moveSpeed: 5.0, attackRange: 1.0 });
    Core.getComponent(fast, "EnemyAI")._wasChasing = true;
    sys(1.0, Core);
    const fastDist = Core.getComponent(fast, "Transform").u;

    expect(fastDist).toBeGreaterThan(gruntDist);
  });
});
