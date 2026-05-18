import { describe, it, expect, beforeEach } from "vitest";
import {
  createWeaponPickupSystem,
  WEAPON_PICKUP_COLLECT_DIST,
} from "../../src/systems/ecs_weapon_pickup.js";
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
describe("weapon pickup constants — monolith line 8384 parity", () => {
  it("COLLECT_DIST = 1.2",  () => expect(WEAPON_PICKUP_COLLECT_DIST).toBe(1.2));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createWeaponPickupSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("weapon_pickup:spawned creates a WeaponPickup entity", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    Core.emit("weapon_pickup:spawned", { u: 5, v: 3, weaponId: "rifle" });
    const pks = Core.query("WeaponPickup");
    expect(pks.length).toBe(1);
    const wp = Core.getComponent(pks[0], "WeaponPickup");
    expect(wp.u).toBe(5);
    expect(wp.v).toBe(3);
    expect(wp.weaponId).toBe("rifle");
  });

  it("weaponId defaults to pistol when omitted", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0 });
    const wp = Core.getComponent(Core.query("WeaponPickup")[0], "WeaponPickup");
    expect(wp.weaponId).toBe("pistol");
  });

  it("multiple spawns create multiple entities", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "rifle" });
    Core.emit("weapon_pickup:spawned", { u: 5, v: 5, weaponId: "sniper" });
    expect(Core.query("WeaponPickup").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createWeaponPickupSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits weapon_pickup:collected with weaponId when hero in range", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("weapon_pickup:spawned", { u: 0.5, v: 0, weaponId: "smg" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].weaponId).toBe("smg");
  });

  it("collected event includes position", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("weapon_pickup:spawned", { u: 0.5, v: 0.3, weaponId: "shotgun" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected[0].u).toBe(0.5);
    expect(collected[0].v).toBe(0.3);
  });

  it("destroys entity on collection", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("weapon_pickup:spawned", { u: 0.5, v: 0, weaponId: "rifle" });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("WeaponPickup").length).toBe(0);
  });

  it("no collection outside collect dist", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "rifle" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero at exact boundary does NOT collect", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(WEAPON_PICKUP_COLLECT_DIST, 0);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "rifle" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside boundary collects", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(WEAPON_PICKUP_COLLECT_DIST - 0.01, 0);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "sniper" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });

  it("two nearby pickups both collected in one tick", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("weapon_pickup:spawned", { u: 0.3, v: 0, weaponId: "rifle" });
    Core.emit("weapon_pickup:spawned", { u: 0.0, v: 0.3, weaponId: "smg" });
    const collected = collectEvents(Core, "weapon_pickup:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(2);
    const ids = collected.map(c => c.weaponId).sort();
    expect(ids).toEqual(["rifle", "smg"]);
  });
});

// ── No hero / tick ────────────────────────────────────────────────────────────
describe("createWeaponPickupSystem — no hero / tick", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "rifle" });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("emits weapon_pickup:tick with weaponId while alive", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("weapon_pickup:spawned", { u: 0, v: 0, weaponId: "shotgun" });
    const ticks = collectEvents(Core, "weapon_pickup:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
    expect(ticks[0].weaponId).toBe("shotgun");
  });

  it("no tick emitted in same frame as collection", () => {
    const sys = createWeaponPickupSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("weapon_pickup:spawned", { u: 0.5, v: 0, weaponId: "rifle" });
    const ticks = collectEvents(Core, "weapon_pickup:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(0);
  });
});
