import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnemySeparationSystem,
  ENEMY_SEP_DIST, ENEMY_SEP_PUSH,
} from "../../src/systems/ecs_enemy_separation.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("enemy separation constants — monolith lines 7723-7742 parity", () => {
  it("ENEMY_SEP_DIST = 1.2m (line 7724)", () => expect(ENEMY_SEP_DIST).toBe(1.2));
  it("ENEMY_SEP_PUSH = 0.6 (line 7724)",  () => expect(ENEMY_SEP_PUSH).toBe(0.6));
});

// ── Separation logic ──────────────────────────────────────────────────────────
describe("createEnemySeparationSystem — overlap resolution", () => {
  beforeEach(() => Core._reset());

  it("pushes overlapping enemies apart", () => {
    const sys = createEnemySeparationSystem();
    const eA = makeEnemy(0, 0);
    const eB = makeEnemy(0.5, 0); // 0.5m apart — inside SEP_DIST(1.2)

    sys(1 / 60, Core);

    const tA = Core.getComponent(eA, "Transform");
    const tB = Core.getComponent(eB, "Transform");
    // A should move away from B (u increases), B should move away from A (u decreases)
    expect(tA.u).toBeLessThan(0);
    expect(tB.u).toBeGreaterThan(0.5);
    // Total separation should increase
    expect(tB.u - tA.u).toBeGreaterThan(0.5);
  });

  it("increases separation distance toward SEP_DIST over time", () => {
    const sys = createEnemySeparationSystem();
    makeEnemy(0, 0);
    makeEnemy(0.3, 0); // nearly on top of each other

    // Run 300 frames (~5s) — push force diminishes as distance grows, needs time to converge
    for (let i = 0; i < 300; i++) sys(1 / 60, Core);

    const all = Core.query("EnemyAI", "Transform");
    const [ta, tb] = all.map(id => Core.getComponent(id, "Transform"));
    const dist = Math.hypot(ta.u - tb.u, ta.v - tb.v);
    expect(dist).toBeGreaterThanOrEqual(ENEMY_SEP_DIST * 0.9); // close to or at SEP_DIST
  });

  it("does NOT push enemies already >= SEP_DIST apart", () => {
    const sys = createEnemySeparationSystem();
    const eA = makeEnemy(0, 0);
    const eB = makeEnemy(1.3, 0); // 1.3m > SEP_DIST(1.2)

    sys(1 / 60, Core);

    expect(Core.getComponent(eA, "Transform").u).toBeCloseTo(0, 5);
    expect(Core.getComponent(eB, "Transform").u).toBeCloseTo(1.3, 5);
  });

  it("skips dead enemies (hp=0)", () => {
    const sys = createEnemySeparationSystem();
    const eA = makeEnemy(0, 0);
    const eB = makeEnemy(0.5, 0, 0); // dead

    sys(1 / 60, Core);

    // eA should not be pushed (no valid pair)
    expect(Core.getComponent(eA, "Transform").u).toBeCloseTo(0, 5);
  });

  it("handles three overlapping enemies — pushes all outward", () => {
    const sys = createEnemySeparationSystem();
    makeEnemy(0, 0);
    makeEnemy(0.4, 0);
    makeEnemy(0.8, 0);

    for (let i = 0; i < 30; i++) sys(1 / 60, Core);

    const all = Core.query("EnemyAI", "Transform");
    const positions = all.map(id => Core.getComponent(id, "Transform").u).sort((a, b) => a - b);
    // Outermost pair should be at least SEP_DIST apart
    expect(positions[2] - positions[0]).toBeGreaterThanOrEqual(ENEMY_SEP_DIST * 0.9);
  });

  it("does not crash with only one enemy", () => {
    const sys = createEnemySeparationSystem();
    makeEnemy(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not crash with no enemies", () => {
    const sys = createEnemySeparationSystem();
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("push vector direction is along separation axis", () => {
    const sys = createEnemySeparationSystem();
    const eA = makeEnemy(0, 0);
    const eB = makeEnemy(0, 0.5); // purely vertical separation

    sys(1 / 60, Core);

    const tA = Core.getComponent(eA, "Transform");
    const tB = Core.getComponent(eB, "Transform");
    // Should push on V axis, U should be unchanged
    expect(Math.abs(tA.u)).toBeLessThan(0.001);
    expect(Math.abs(tB.u)).toBeLessThan(0.001);
    expect(tA.v).toBeLessThan(0);
    expect(tB.v).toBeGreaterThan(0.5);
  });
});
