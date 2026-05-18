import { describe, it, expect, beforeEach } from "vitest";
import {
  createAmmoPickupSystem,
  AMMO_PICKUP_COLLECT_DIST,
  AMMO_PICKUP_MAGNET_DIST,
  AMMO_PICKUP_MAGNET_SPEED,
} from "../../src/systems/ecs_ammo_pickup.js";
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
describe("ammo pickup constants — monolith lines 8194/8206 parity", () => {
  it("COLLECT_DIST = 1.2",  () => expect(AMMO_PICKUP_COLLECT_DIST).toBe(1.2));
  it("MAGNET_DIST = 3.0",   () => expect(AMMO_PICKUP_MAGNET_DIST).toBe(3.0));
  it("MAGNET_SPEED = 8.0",  () => expect(AMMO_PICKUP_MAGNET_SPEED).toBe(8.0));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createAmmoPickupSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("ammo_pickup:spawned creates an AmmoPickup entity", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    Core.emit("ammo_pickup:spawned", { u: 2, v: 3, qty: 20, ammoItem: "rifle_556" });
    const pks = Core.query("AmmoPickup");
    expect(pks.length).toBe(1);
    const ap = Core.getComponent(pks[0], "AmmoPickup");
    expect(ap.u).toBe(2);
    expect(ap.v).toBe(3);
    expect(ap.qty).toBe(20);
    expect(ap.ammoItem).toBe("rifle_556");
  });

  it("qty defaults to 12 when omitted", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0 });
    const ap = Core.getComponent(Core.query("AmmoPickup")[0], "AmmoPickup");
    expect(ap.qty).toBe(12);
  });

  it("ammoItem defaults to pistol_9mm when omitted", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0 });
    const ap = Core.getComponent(Core.query("AmmoPickup")[0], "AmmoPickup");
    expect(ap.ammoItem).toBe("pistol_9mm");
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createAmmoPickupSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits ammo_pickup:collected with qty and ammoItem when hero in range", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("ammo_pickup:spawned", { u: 0.5, v: 0, qty: 15, ammoItem: "smg_9mm" });
    const collected = collectEvents(Core, "ammo_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].qty).toBe(15);
    expect(collected[0].ammoItem).toBe("smg_9mm");
  });

  it("destroys entity on collection", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("ammo_pickup:spawned", { u: 0.5, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("AmmoPickup").length).toBe(0);
  });

  it("no collection outside collect dist", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    const collected = collectEvents(Core, "ammo_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero at boundary does NOT collect", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(AMMO_PICKUP_COLLECT_DIST, 0);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    const collected = collectEvents(Core, "ammo_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside boundary collects", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(AMMO_PICKUP_COLLECT_DIST - 0.01, 0);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0, qty: 8, ammoItem: "shotgun_12g" });
    const collected = collectEvents(Core, "ammo_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].ammoItem).toBe("shotgun_12g");
  });
});

// ── Magnet pull ───────────────────────────────────────────────────────────────
describe("createAmmoPickupSystem — magnet pull", () => {
  beforeEach(() => Core._reset());

  it("pickup moves toward hero when inside magnet range", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("ammo_pickup:spawned", { u: 2.0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    sys(0.1, Core);
    const ap = Core.getComponent(Core.query("AmmoPickup")[0], "AmmoPickup");
    expect(ap.u).toBeLessThan(2.0);
  });

  it("pickup does NOT move outside magnet range", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("ammo_pickup:spawned", { u: 4.0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    sys(0.1, Core);
    const ap = Core.getComponent(Core.query("AmmoPickup")[0], "AmmoPickup");
    expect(ap.u).toBe(4.0);
  });
});

// ── No hero / tick ────────────────────────────────────────────────────────────
describe("createAmmoPickupSystem — no hero / tick", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("emits ammo_pickup:tick while alive", () => {
    const sys = createAmmoPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("ammo_pickup:spawned", { u: 0, v: 0, qty: 10, ammoItem: "pistol_9mm" });
    const ticks = collectEvents(Core, "ammo_pickup:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
  });
});
