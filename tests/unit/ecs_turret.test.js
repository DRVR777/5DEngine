import { describe, it, expect, beforeEach } from "vitest";
import {
  createTurretSystem,
  TURRET_HP, TURRET_AMMO, TURRET_RANGE, TURRET_FIRE_RATE,
  TURRET_BULLET_DAMAGE, TURRET_BULLET_SPEED, TURRET_BULLET_RANGE,
  TURRET_IDLE_ROTATE, TURRET_MELEE_FACTOR,
} from "../../src/systems/ecs_turret.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, damage = 6, attackRange = 1.6) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 200, maxHp: 200 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, damage, attackRange });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("turret constants — monolith lines 2136-2141 parity", () => {
  it("TURRET_HP = 60",             () => expect(TURRET_HP).toBe(60));
  it("TURRET_AMMO = 40",           () => expect(TURRET_AMMO).toBe(40));
  it("TURRET_RANGE = 10",          () => expect(TURRET_RANGE).toBe(10));
  it("TURRET_FIRE_RATE = 1.8",     () => expect(TURRET_FIRE_RATE).toBe(1.8));
  it("TURRET_BULLET_DAMAGE = 20",  () => expect(TURRET_BULLET_DAMAGE).toBe(20));
  it("TURRET_BULLET_SPEED = 90",   () => expect(TURRET_BULLET_SPEED).toBe(90));
  it("TURRET_BULLET_RANGE = 14",   () => expect(TURRET_BULLET_RANGE).toBe(14));
  it("TURRET_IDLE_ROTATE = 0.9",   () => expect(TURRET_IDLE_ROTATE).toBe(0.9));
  it("TURRET_MELEE_FACTOR = 0.8",  () => expect(TURRET_MELEE_FACTOR).toBe(0.8));
});

// ── Placement ─────────────────────────────────────────────────────────────────
describe("createTurretSystem — placement via turret:placed", () => {
  beforeEach(() => Core._reset());

  it("creates a Turret entity on turret:placed", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 5, v: 3 });

    const turrets = Core.query("Turret");
    expect(turrets.length).toBe(1);
    const t = Core.getComponent(turrets[0], "Turret");
    expect(t.u).toBe(5);
    expect(t.v).toBe(3);
    expect(t.hp).toBe(TURRET_HP);
    expect(t.ammo).toBe(TURRET_AMMO);
    expect(t.fireT).toBe(0);
  });
});

// ── Firing ────────────────────────────────────────────────────────────────────
describe("createTurretSystem — firing", () => {
  beforeEach(() => Core._reset());

  it("fires on first tick when enemy is in range", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0);

    const events = [];
    Core.on("turret:fired", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(1);
  });

  it("turret:fired includes correct fields", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0);

    const events = [];
    Core.on("turret:fired", e => events.push(e));
    sys(1 / 60, Core);

    const ev = events[0];
    expect(ev.speed).toBe(TURRET_BULLET_SPEED);
    expect(ev.damage).toBe(TURRET_BULLET_DAMAGE);
    expect(ev.range).toBe(TURRET_BULLET_RANGE);
    expect(typeof ev.dirU).toBe("number");
    expect(typeof ev.dirV).toBe("number");
  });

  it("does NOT fire when no enemy in range", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(15, 0); // outside TURRET_RANGE=10

    const events = [];
    Core.on("turret:fired", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
  });

  it("respects fire rate — does not fire again within 1/FIRE_RATE seconds", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0);

    const events = [];
    Core.on("turret:fired", e => events.push(e));
    sys(1 / 60, Core); // first shot
    sys(1 / 60, Core); // too soon

    expect(events.length).toBe(1);
  });

  it("fires again after 1/FIRE_RATE seconds have elapsed", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0);

    const events = [];
    Core.on("turret:fired", e => events.push(e));
    sys(1 / 60, Core);             // first shot
    sys(1 / TURRET_FIRE_RATE + 0.01, Core); // enough time

    expect(events.length).toBe(2);
  });

  it("decrements ammo on each shot", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0);

    sys(1 / 60, Core);

    const t = Core.getComponent(Core.query("Turret")[0], "Turret");
    expect(t.ammo).toBe(TURRET_AMMO - 1);
  });

  it("turret heading tracks nearest enemy", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(5, 0); // due east → heading = atan2(5,0)

    sys(1 / 60, Core);

    const t = Core.getComponent(Core.query("Turret")[0], "Turret");
    expect(t.heading).toBeCloseTo(Math.atan2(5, 0), 5);
  });
});

// ── Idle rotation and ammo out ─────────────────────────────────────────────────
describe("createTurretSystem — idle rotation and ammo empty", () => {
  beforeEach(() => Core._reset());

  it("rotates heading when idle (no enemies in range)", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });

    sys(1.0, Core);

    const t = Core.getComponent(Core.query("Turret")[0], "Turret");
    expect(t.heading).toBeCloseTo(TURRET_IDLE_ROTATE * 1.0, 5);
  });

  it("emits turret:ammo_empty and despawns when no enemies and ammo=0", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    const t = Core.getComponent(Core.query("Turret")[0], "Turret");
    t.ammo = 0; // drain ammo

    const events = [];
    Core.on("turret:ammo_empty", e => events.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(events.length).toBe(1);
    expect(Core.query("Turret").length).toBe(0);
  });
});

// ── Melee damage and destruction ───────────────────────────────────────────────
describe("createTurretSystem — melee damage and destruction", () => {
  beforeEach(() => Core._reset());

  it("turret takes damage when enemy is within attackRange", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    makeEnemy(1.0, 0, 6, 1.6); // enemy at d=1.0 < attackRange=1.6

    sys(1.0, Core); // dt=1s for measurable damage

    const t = Core.getComponent(Core.query("Turret")[0], "Turret");
    expect(t.hp).toBeCloseTo(TURRET_HP - 6 * 1.0 * TURRET_MELEE_FACTOR, 5);
  });

  it("emits turret:destroyed and despawns when hp reaches 0", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);

    Core.emit("turret:placed", { u: 0, v: 0 });
    const tid = Core.query("Turret")[0];
    Core.getComponent(tid, "Turret").hp = 1; // near death
    makeEnemy(0.5, 0, 100, 1.6); // high damage enemy

    const events = [];
    Core.on("turret:destroyed", e => events.push(e));
    sys(1.0, Core);
    Core._flushDespawn();

    expect(events.length).toBe(1);
    expect(Core.query("Turret").length).toBe(0);
  });

  it("does not crash with no enemies", () => {
    const sys = createTurretSystem();
    sys.wireListeners(Core);
    Core.emit("turret:placed", { u: 0, v: 0 });
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not crash with no turrets", () => {
    const sys = createTurretSystem();
    makeEnemy(5, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});
