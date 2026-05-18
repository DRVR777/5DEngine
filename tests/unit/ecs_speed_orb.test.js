import { describe, it, expect, beforeEach } from "vitest";
import {
  createSpeedOrbSystem,
  SPEED_ORB_COLLECT_DIST,
  SPEED_ORB_BOOST_DURATION,
} from "../../src/systems/ecs_speed_orb.js";
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
describe("speed orb constants — monolith lines 8239/8243 parity", () => {
  it("COLLECT_DIST = 1.2",      () => expect(SPEED_ORB_COLLECT_DIST).toBe(1.2));
  it("BOOST_DURATION = 4.0",    () => expect(SPEED_ORB_BOOST_DURATION).toBe(4.0));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createSpeedOrbSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("speed_orb:spawned creates a SpeedOrb entity", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    Core.emit("speed_orb:spawned", { u: 3, v: 5 });
    const orbs = Core.query("SpeedOrb");
    expect(orbs.length).toBe(1);
    const so = Core.getComponent(orbs[0], "SpeedOrb");
    expect(so.u).toBe(3);
    expect(so.v).toBe(5);
  });

  it("multiple spawns create multiple orb entities", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    Core.emit("speed_orb:spawned", { u: 5, v: 5 });
    expect(Core.query("SpeedOrb").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createSpeedOrbSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits speed_orb:collected when hero is within collect dist", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });

  it("collected event includes boostDuration", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected[0].boostDuration).toBe(SPEED_ORB_BOOST_DURATION);
  });

  it("collected event includes orb position", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.8, v: 0.2 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected[0].u).toBe(0.8);
    expect(collected[0].v).toBe(0.2);
  });

  it("destroys orb entity on collection", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.5, v: 0 });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("SpeedOrb").length).toBe(0);
  });

  it("no collection when hero is outside collect dist", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero exactly at collect dist boundary does NOT collect", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(SPEED_ORB_COLLECT_DIST, 0);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside collect dist collects", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(SPEED_ORB_COLLECT_DIST - 0.01, 0);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });

  it("two nearby orbs both collected in one tick", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.3, v: 0 });
    Core.emit("speed_orb:spawned", { u: 0.0, v: 0.3 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(2);
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createSpeedOrbSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("no collection events without a hero", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    const collected = collectEvents(Core, "speed_orb:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });
});

// ── Tick ─────────────────────────────────────────────────────────────────────
describe("createSpeedOrbSystem — tick", () => {
  beforeEach(() => Core._reset());

  it("emits speed_orb:tick when orb is alive and not collected", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(10, 10); // far away
    Core.emit("speed_orb:spawned", { u: 0, v: 0 });
    const ticks = collectEvents(Core, "speed_orb:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
    expect(ticks[0].u).toBe(0);
    expect(ticks[0].v).toBe(0);
  });

  it("no tick event emitted in same frame as collection", () => {
    const sys = createSpeedOrbSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("speed_orb:spawned", { u: 0.5, v: 0 });
    const ticks = collectEvents(Core, "speed_orb:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(0);
  });
});
