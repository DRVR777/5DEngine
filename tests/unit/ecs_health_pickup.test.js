import { describe, it, expect, beforeEach } from "vitest";
import {
  createHealthPickupSystem,
  HEALTH_PICKUP_COLLECT_DIST,
} from "../../src/systems/ecs_health_pickup.js";
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
describe("health pickup constants — monolith line 8217 parity", () => {
  it("COLLECT_DIST = 1.2",  () => expect(HEALTH_PICKUP_COLLECT_DIST).toBe(1.2));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createHealthPickupSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("health_pickup:spawned creates a HealthPickup entity", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    Core.emit("health_pickup:spawned", { u: 3, v: 6, amount: 30 });
    const pks = Core.query("HealthPickup");
    expect(pks.length).toBe(1);
    const pk = Core.getComponent(pks[0], "HealthPickup");
    expect(pk.u).toBe(3);
    expect(pk.v).toBe(6);
    expect(pk.amount).toBe(30);
  });

  it("amount defaults to 25 when omitted", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    Core.emit("health_pickup:spawned", { u: 0, v: 0 });
    const pk = Core.getComponent(Core.query("HealthPickup")[0], "HealthPickup");
    expect(pk.amount).toBe(25);
  });

  it("multiple spawns create multiple pickup entities", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 10 });
    Core.emit("health_pickup:spawned", { u: 5, v: 5, amount: 20 });
    expect(Core.query("HealthPickup").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createHealthPickupSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits health_pickup:collected when hero walks over pickup", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("health_pickup:spawned", { u: 0.5, v: 0, amount: 25 });
    const collected = collectEvents(Core, "health_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].amount).toBe(25);
  });

  it("collected event includes position", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("health_pickup:spawned", { u: 0.5, v: 0.2, amount: 10 });
    const collected = collectEvents(Core, "health_pickup:collected");
    sys(0.016, Core);
    expect(collected[0].u).toBe(0.5);
    expect(collected[0].v).toBe(0.2);
  });

  it("destroys entity on collection", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("health_pickup:spawned", { u: 0.5, v: 0, amount: 25 });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("HealthPickup").length).toBe(0);
  });

  it("no collection when hero is outside collect dist", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 25 });
    const collected = collectEvents(Core, "health_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero exactly at boundary does NOT collect", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(HEALTH_PICKUP_COLLECT_DIST, 0);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 25 });
    const collected = collectEvents(Core, "health_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside boundary collects", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(HEALTH_PICKUP_COLLECT_DIST - 0.01, 0);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 15 });
    const collected = collectEvents(Core, "health_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });
});

// ── No hero / tick ────────────────────────────────────────────────────────────
describe("createHealthPickupSystem — no hero / tick", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 25 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("emits health_pickup:tick when pickup is alive", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("health_pickup:spawned", { u: 0, v: 0, amount: 25 });
    const ticks = collectEvents(Core, "health_pickup:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
    expect(ticks[0].u).toBe(0);
    expect(ticks[0].v).toBe(0);
  });

  it("no tick emitted in same frame as collection", () => {
    const sys = createHealthPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("health_pickup:spawned", { u: 0.5, v: 0, amount: 25 });
    const ticks = collectEvents(Core, "health_pickup:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(0);
  });
});
