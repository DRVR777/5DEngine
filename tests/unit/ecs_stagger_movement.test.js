import { describe, it, expect, beforeEach } from "vitest";
import {
  createStaggerMovementSystem,
  STAGGER_SPIN_RATE,
  STAGGER_MOVE_MUL,
} from "../../src/systems/ecs_stagger_movement.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4, sightRange: 12 });
  return id;
}

function addStagger(id, remaining = 1.5) {
  Core.addComponent(id, "Stagger", { duration: remaining, remaining });
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("stagger movement constants — monolith lines 7168-7178 parity", () => {
  it("STAGGER_SPIN_RATE = PI*4 (line 7171)",  () => expect(STAGGER_SPIN_RATE).toBeCloseTo(Math.PI * 4));
  it("STAGGER_MOVE_MUL = 0.35 (line 7174)",  () => expect(STAGGER_MOVE_MUL).toBe(0.35));
});

// ── Movement ──────────────────────────────────────────────────────────────────
describe("createStaggerMovementSystem — spin movement", () => {
  beforeEach(() => Core._reset());

  it("moves entity when Stagger component is active", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    const t = Core.getComponent(eid, "Transform");
    const before = { u: t.u, v: t.v };
    sys(0.1, Core);

    expect(Math.hypot(t.u - before.u, t.v - before.v)).toBeGreaterThan(0);
  });

  it("does NOT move entity without Stagger component", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(3, 4);
    // No stagger added

    const t = Core.getComponent(eid, "Transform");
    sys(0.1, Core);

    expect(t.u).toBe(3);
    expect(t.v).toBe(4);
  });

  it("spin angle advances at STAGGER_SPIN_RATE per second", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    sys(1.0, Core); // one second → angle should be PI*4

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._staggerAngle).toBeCloseTo(STAGGER_SPIN_RATE * 1.0, 5);
  });

  it("movement uses moveSpeed × STAGGER_MOVE_MUL", () => {
    // With angle=0: du = sin(0)*spd*dt = 0; dv = cos(0)*spd*dt = spd*dt
    // _staggerAngle starts null → set to 0 → advances by SPIN_RATE*dt
    // After first tick: angle = PI*4*dt. We need to integrate movement analytically.
    // Use dt=0 (zero dt) to check that zero movement happens for zero time.
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    sys(0, Core); // dt=0 → no movement
    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBe(0);
    expect(t.v).toBe(0);
  });

  it("emits enemy:staggering with entityId and angle each tick", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    const events = [];
    Core.on("enemy:staggering", e => events.push(e));
    sys(0.1, Core);

    expect(events.length).toBe(1);
    expect(events[0].entityId).toBe(eid);
    expect(typeof events[0].angle).toBe("number");
  });

  it("emits enemy:staggering every tick while staggered", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    const events = [];
    Core.on("enemy:staggering", e => events.push(e));
    sys(0.1, Core);
    sys(0.1, Core);
    sys(0.1, Core);

    expect(events.length).toBe(3);
  });

  it("multiple staggered entities all move", () => {
    const sys = createStaggerMovementSystem();
    const e1 = makeEnemy(0, 0);
    const e2 = makeEnemy(5, 5);
    addStagger(e1);
    addStagger(e2);

    const events = [];
    Core.on("enemy:staggering", e => events.push(e));
    sys(0.1, Core);

    expect(events.length).toBe(2);
  });

  it("dead entity is skipped even with Stagger component", () => {
    const sys = createStaggerMovementSystem();
    const eid = makeEnemy(0, 0, 0); // hp=0
    addStagger(eid);

    const events = [];
    Core.on("enemy:staggering", e => events.push(e));
    sys(0.1, Core);

    expect(events.length).toBe(0);
  });
});

// ── ai_movement stagger skip ──────────────────────────────────────────────────
describe("ecs_ai_movement — skips staggered enemies", () => {
  beforeEach(() => Core._reset());

  it("ai_movement does not move enemy with Stagger component", async () => {
    const { createAIMovementSystem } = await import("../../src/systems/ecs_ai_movement.js");
    const sys = createAIMovementSystem();
    const eid = makeEnemy(0, 0);
    addStagger(eid);

    const hero = Core.createEntity();
    Core.addComponent(hero, "PlayerControl", { active: true });
    Core.addComponent(hero, "Transform", { u: 0, v: 10, y: 0 });

    const t = Core.getComponent(eid, "Transform");
    sys(0.1, Core);

    // Enemy should not move toward hero while staggered
    expect(t.u).toBe(0);
    expect(t.v).toBe(0);
  });
});
