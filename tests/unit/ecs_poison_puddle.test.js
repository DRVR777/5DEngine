import { describe, it, expect, beforeEach } from "vitest";
import {
  createPoisonPuddleSystem,
  POISON_PUDDLE_RADIUS,
  POISON_PUDDLE_DURATION,
  POISON_PUDDLE_APPLY_INTERVAL,
} from "../../src/systems/ecs_poison_puddle.js";
import Core from "../../src/core/core.js";

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform",     { u, v, y: 0 });
  Core.addComponent(id, "PlayerControl", {});
  return id;
}

function collectEvents(core, name) {
  const evts = [];
  core.on(name, e => evts.push(e));
  return evts;
}

// ── Constants ────────────────────────────────────────────────────────────────
describe("poison puddle constants — monolith lines 3841 parity", () => {
  it("RADIUS = 1.2",          () => expect(POISON_PUDDLE_RADIUS).toBe(1.2));
  it("DURATION = 4.0",        () => expect(POISON_PUDDLE_DURATION).toBe(4.0));
  it("APPLY_INTERVAL = 0.8",  () => expect(POISON_PUDDLE_APPLY_INTERVAL).toBe(0.8));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createPoisonPuddleSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("puddle_spawned creates a PoisonPuddle entity", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 3, v: 7 });
    const puddles = Core.query("PoisonPuddle");
    expect(puddles.length).toBe(1);
    const pp = Core.getComponent(puddles[0], "PoisonPuddle");
    expect(pp.u).toBe(3);
    expect(pp.v).toBe(7);
    expect(pp.radius).toBe(POISON_PUDDLE_RADIUS);
    expect(pp.timeLeft).toBe(POISON_PUDDLE_DURATION);
    expect(pp.applyT).toBe(0);
  });

  it("multiple spawns create multiple puddles", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    Core.emit("poison:puddle_spawned", { u: 5, v: 5 });
    expect(Core.query("PoisonPuddle").length).toBe(2);
  });
});

// ── Expiry ────────────────────────────────────────────────────────────────────
describe("createPoisonPuddleSystem — expiry", () => {
  beforeEach(() => Core._reset());

  it("decrements timeLeft each tick", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    sys(0.1, Core);
    const pp = Core.getComponent(Core.query("PoisonPuddle")[0], "PoisonPuddle");
    expect(pp.timeLeft).toBeCloseTo(POISON_PUDDLE_DURATION - 0.1);
  });

  it("emits puddle_expired when timeLeft reaches 0", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 2, v: 4 });
    const expired = collectEvents(Core, "poison:puddle_expired");
    sys(POISON_PUDDLE_DURATION + 0.01, Core);
    expect(expired.length).toBe(1);
    expect(expired[0].u).toBe(2);
    expect(expired[0].v).toBe(4);
  });

  it("destroys entity when puddle expires", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    sys(POISON_PUDDLE_DURATION + 0.01, Core);
    Core._flushDespawn();
    expect(Core.query("PoisonPuddle").length).toBe(0);
  });

  it("emits puddle_tick while alive", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 1, v: 2 });
    const ticks = collectEvents(Core, "poison:puddle_tick");
    sys(0.1, Core);
    expect(ticks.length).toBe(1);
    expect(ticks[0].u).toBe(1);
    expect(ticks[0].v).toBe(2);
    expect(ticks[0].timeLeft).toBeGreaterThan(0);
  });
});

// ── Hero proximity ────────────────────────────────────────────────────────────
describe("createPoisonPuddleSystem — hero proximity", () => {
  beforeEach(() => Core._reset());

  it("no hero_apply when hero is outside radius", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(10, 10); // far away
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(1.0, Core);
    expect(applied.length).toBe(0);
  });

  it("applies poison when hero is inside radius (applyT starts at 0)", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core); // tiny dt, applyT goes negative immediately
    expect(applied.length).toBe(1);
  });

  it("hero_apply includes puddle position", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(0.5, 0.5);
    Core.emit("poison:puddle_spawned", { u: 0.5, v: 0.5 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core);
    expect(applied[0].u).toBe(0.5);
    expect(applied[0].v).toBe(0.5);
  });

  it("respects apply interval — no second apply until 0.8s elapses", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core); // triggers first apply, resets to 0.8
    sys(0.3, Core);  // only 0.3s elapsed — no apply
    sys(0.3, Core);  // 0.6s total — still no apply
    expect(applied.length).toBe(1);
  });

  it("applies a second time after full interval", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core); // first apply
    sys(POISON_PUDDLE_APPLY_INTERVAL + 0.01, Core); // second apply
    expect(applied.length).toBe(2);
  });

  it("no crash and no apply when no hero entity exists", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    expect(() => sys(0.5, Core)).not.toThrow();
    expect(applied.length).toBe(0);
  });

  it("hero just outside edge of radius gets no apply", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(POISON_PUDDLE_RADIUS + 0.01, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.5, Core);
    expect(applied.length).toBe(0);
  });

  it("hero just inside edge of radius gets apply", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(POISON_PUDDLE_RADIUS - 0.01, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core);
    expect(applied.length).toBe(1);
  });

  it("two independent puddles both apply when hero overlaps both", () => {
    const sys = createPoisonPuddleSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("poison:puddle_spawned", { u: 0, v: 0 });
    Core.emit("poison:puddle_spawned", { u: 0.5, v: 0 });
    const applied = collectEvents(Core, "poison:hero_apply");
    sys(0.01, Core);
    expect(applied.length).toBe(2);
  });
});
