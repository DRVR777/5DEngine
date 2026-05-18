import { describe, it, expect, beforeEach } from "vitest";
import {
  createMineSystem,
  MINE_ARM_TIME, MINE_TRIGGER_DIST, MINE_BLAST_RADIUS, MINE_MAX_DAMAGE,
} from "../../src/systems/ecs_mine.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 200, maxHp: 200 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("mine constants — monolith lines 2250/2264/2272/2279 parity", () => {
  it("MINE_ARM_TIME = 1.2     (line 2250: armT: 1.2)",        () => expect(MINE_ARM_TIME).toBe(1.2));
  it("MINE_TRIGGER_DIST = 1.2 (line 2264: < 1.2)",           () => expect(MINE_TRIGGER_DIST).toBe(1.2));
  it("MINE_BLAST_RADIUS = 3.0 (line 2272: _mBlast = 3.0)",   () => expect(MINE_BLAST_RADIUS).toBe(3.0));
  it("MINE_MAX_DAMAGE = 90    (line 2279: 90 * (1 - d/R))",  () => expect(MINE_MAX_DAMAGE).toBe(90));
});

// ── Placement ─────────────────────────────────────────────────────────────────
describe("createMineSystem — mine placement via mine:placed", () => {
  beforeEach(() => Core._reset());

  it("creates a Mine entity on mine:placed", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 5, v: 3 });

    const mines = Core.query("Mine");
    expect(mines.length).toBe(1);
    const mn = Core.getComponent(mines[0], "Mine");
    expect(mn.u).toBe(5);
    expect(mn.v).toBe(3);
    expect(mn.armed).toBe(false);
    expect(mn.armT).toBe(MINE_ARM_TIME);
  });

  it("starts unarmed — does not trigger on nearby enemy before ARM_TIME", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    makeEnemy(0.5, 0); // within trigger dist

    const events = [];
    Core.on("mine:detonated", e => events.push(e));
    sys(0.5, Core); // 0.5s < 1.2s arm time

    expect(events.length).toBe(0);
  });
});

// ── Arming ────────────────────────────────────────────────────────────────────
describe("createMineSystem — arming", () => {
  beforeEach(() => Core._reset());

  it("mine becomes armed after ARM_TIME seconds", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);

    const mn = Core.getComponent(Core.query("Mine")[0], "Mine");
    expect(mn.armed).toBe(true);
  });

  it("emits mine:armed when arming completes", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    const events = [];
    Core.on("mine:armed", e => events.push(e));
    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);

    expect(events.length).toBe(1);
  });
});

// ── Detonation ────────────────────────────────────────────────────────────────
describe("createMineSystem — detonation", () => {
  beforeEach(() => Core._reset());

  it("armed mine triggers on enemy within MINE_TRIGGER_DIST", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core); // arm it (no nearby enemies yet)
    makeEnemy(0.5, 0);               // enemy within 1.2m

    const events = [];
    Core.on("mine:detonated", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(1);
    expect(events[0].u).toBe(0);
    expect(events[0].v).toBe(0);
  });

  it("armed mine does NOT trigger on enemy outside MINE_TRIGGER_DIST", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    makeEnemy(2, 0); // d=2 > 1.2

    const events = [];
    Core.on("mine:detonated", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
  });

  it("mine entity is despawned after detonation", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    makeEnemy(0.5, 0);

    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(Core.query("Mine").length).toBe(0);
  });
});

// ── Blast damage ──────────────────────────────────────────────────────────────
describe("createMineSystem — blast damage", () => {
  beforeEach(() => Core._reset());

  it("emits mine:blast_damage for enemy at centre (d=0) with MAX_DAMAGE=90", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    const eid = makeEnemy(0, 0);

    const dmgEvents = [];
    Core.on("mine:blast_damage", e => dmgEvents.push(e));
    sys(1 / 60, Core);

    const hit = dmgEvents.find(e => e.entityId === eid);
    expect(hit).toBeDefined();
    expect(hit.damage).toBe(MINE_MAX_DAMAGE);
  });

  it("emits mine:blast_damage for enemy at midpoint with ~45 damage", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    makeEnemy(0.5, 0); // trigger
    const eid2 = makeEnemy(1.5, 0); // blast victim at midpoint

    const dmgEvents = [];
    Core.on("mine:blast_damage", e => dmgEvents.push(e));
    sys(1 / 60, Core);

    const hit = dmgEvents.find(e => e.entityId === eid2);
    expect(hit).toBeDefined();
    expect(hit.damage).toBe(Math.round(90 * (1 - 1.5 / 3.0)));
  });

  it("does NOT emit mine:blast_damage for enemy outside BLAST_RADIUS", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    makeEnemy(0.5, 0); // trigger
    const farEid = makeEnemy(5, 0); // outside 3.0m blast

    const dmgEvents = [];
    Core.on("mine:blast_damage", e => dmgEvents.push(e));
    sys(1 / 60, Core);

    expect(dmgEvents.find(e => e.entityId === farEid)).toBeUndefined();
  });

  it("does not crash with no enemies", () => {
    const sys = createMineSystem();
    sys.wireListeners(Core);

    Core.emit("mine:placed", { u: 0, v: 0 });
    sys(MINE_ARM_TIME + 0.01, Core);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not crash with no mines", () => {
    const sys = createMineSystem();
    makeEnemy(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});
