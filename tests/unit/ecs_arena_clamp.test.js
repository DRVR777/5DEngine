import { describe, it, expect, beforeEach } from "vitest";
import {
  createArenaClampSystem,
  ARENA_RADIUS,
} from "../../src/systems/ecs_arena_clamp.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("arena clamp constants — monolith line 7589 parity", () => {
  it("ARENA_RADIUS = 27.5m (line 7589: _AR = 27.5)", () => expect(ARENA_RADIUS).toBe(27.5));
});

// ── Clamp logic ───────────────────────────────────────────────────────────────
describe("createArenaClampSystem — boundary enforcement", () => {
  beforeEach(() => Core._reset());

  it("does NOT move entity within arena bounds", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(10, -5);

    sys(1 / 60, Core);

    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBe(10);
    expect(t.v).toBe(-5);
  });

  it("clamps entity past +ARENA_RADIUS on U axis", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(30, 0); // u=30 > 27.5

    sys(1 / 60, Core);

    expect(Core.getComponent(eid, "Transform").u).toBe(ARENA_RADIUS);
  });

  it("clamps entity past -ARENA_RADIUS on U axis", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(-30, 0);

    sys(1 / 60, Core);

    expect(Core.getComponent(eid, "Transform").u).toBe(-ARENA_RADIUS);
  });

  it("clamps entity past +ARENA_RADIUS on V axis", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(0, 35);

    sys(1 / 60, Core);

    expect(Core.getComponent(eid, "Transform").v).toBe(ARENA_RADIUS);
  });

  it("clamps entity past -ARENA_RADIUS on V axis", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(0, -35);

    sys(1 / 60, Core);

    expect(Core.getComponent(eid, "Transform").v).toBe(-ARENA_RADIUS);
  });

  it("clamps both axes simultaneously when both out of bounds", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(50, -50);

    sys(1 / 60, Core);

    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBe(ARENA_RADIUS);
    expect(t.v).toBe(-ARENA_RADIUS);
  });

  it("emits arena:clamped with prevU, prevV when clamping", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(30, 0);

    const events = [];
    Core.on("arena:clamped", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(1);
    expect(events[0].entityId).toBe(eid);
    expect(events[0].prevU).toBe(30);
    expect(events[0].prevV).toBe(0);
  });

  it("does NOT emit arena:clamped when within bounds", () => {
    const sys = createArenaClampSystem();
    makeEnemy(5, -5);

    const events = [];
    Core.on("arena:clamped", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
  });

  it("entity at exact boundary (27.5) is NOT clamped", () => {
    const sys = createArenaClampSystem();
    const eid = makeEnemy(ARENA_RADIUS, ARENA_RADIUS);

    const events = [];
    Core.on("arena:clamped", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBe(ARENA_RADIUS);
    expect(t.v).toBe(ARENA_RADIUS);
  });

  it("does not crash with no enemies", () => {
    const sys = createArenaClampSystem();
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});
