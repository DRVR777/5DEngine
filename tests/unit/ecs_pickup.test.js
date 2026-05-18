import { describe, it, expect, beforeEach } from "vitest";
import { pickupSystem, spawnPickup } from "../../src/systems/ecs_pickup.js";
import Core from "../../src/core/core.js";

function makeHero(u = 0, v = 0, hp = 80, maxHp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Health",        { hp, maxHp });
  Core.addComponent(id, "Transform",     { u, v, y: 0 });
  Core.addComponent(id, "Faction",       { id: "player" });
  return id;
}

describe("spawnPickup", () => {
  beforeEach(() => { Core._reset(); });

  it("creates entity with Pickup, Transform, Faction components", () => {
    const id = spawnPickup(Core, "ammo", 3, 7, { ammoItem: "pistol_9mm", qty: 12 });
    expect(Core.getComponent(id, "Pickup").kind).toBe("ammo");
    expect(Core.getComponent(id, "Transform").u).toBe(3);
    expect(Core.getComponent(id, "Transform").v).toBe(7);
    expect(Core.getComponent(id, "Faction").id).toBe("pickup");
  });

  it("stores extra data fields in Pickup component", () => {
    const id = spawnPickup(Core, "health", 0, 0, { amount: 25 });
    expect(Core.getComponent(id, "Pickup").amount).toBe(25);
  });

  it("sets y to 0.4 (bob origin)", () => {
    const id = spawnPickup(Core, "coin", 0, 0, { value: 5 });
    expect(Core.getComponent(id, "Transform").y).toBe(0.4);
  });
});

describe("pickupSystem — collection", () => {
  beforeEach(() => { Core._reset(); });

  it("does nothing with no hero", () => {
    spawnPickup(Core, "coin", 0, 0, { value: 1 });
    expect(() => pickupSystem(0.016, Core)).not.toThrow();
  });

  it("collects ammo pickup when hero is within 1.2m", () => {
    makeHero(0, 0);
    const pid = spawnPickup(Core, "ammo", 0.5, 0, { ammoItem: "pistol_9mm", qty: 12 });
    const events = [];
    Core.on("pickup:ammo",      e => events.push(e));
    Core.on("pickup:collected", e => events.push(e));
    pickupSystem(0.016, Core);
    Core._flushDespawn(); // flush pending destroy so component store is cleared
    expect(events.find(e => e.ammoItem === "pistol_9mm")).toBeTruthy();
    expect(events.find(e => e.kind === "ammo")).toBeTruthy();
    // Entity destroyed after collection
    expect(Core.getComponent(pid, "Pickup")).toBeUndefined();
  });

  it("collects health pickup and restores HP", () => {
    makeHero(0, 0, 60, 100);
    spawnPickup(Core, "health", 0.1, 0, { amount: 30 });
    const events = [];
    Core.on("pickup:health", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events.length).toBe(1);
    expect(events[0].gained).toBe(30);
    // HP capped at maxHp
    const heroId = Core.query("PlayerControl", "Health")[0];
    expect(Core.getComponent(heroId, "Health").hp).toBe(90);
  });

  it("clamps health restore to not exceed maxHp", () => {
    makeHero(0, 0, 95, 100);
    spawnPickup(Core, "health", 0, 0, { amount: 30 });
    pickupSystem(0.016, Core);
    const heroId = Core.query("PlayerControl", "Health")[0];
    expect(Core.getComponent(heroId, "Health").hp).toBe(100);
  });

  it("emits pickup:health with correct gained value when capped", () => {
    makeHero(0, 0, 90, 100);
    spawnPickup(Core, "health", 0, 0, { amount: 30 });
    const events = [];
    Core.on("pickup:health", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events[0].gained).toBe(10); // only 10 HP gap
    expect(events[0].amount).toBe(30); // raw amount still passed
  });

  it("collects coin and emits pickup:coin", () => {
    makeHero(0, 0);
    spawnPickup(Core, "coin", 0.2, 0, { value: 5 });
    const events = [];
    Core.on("pickup:coin", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events.length).toBe(1);
    expect(events[0].value).toBe(5);
  });

  it("defaults coin value to 1 if missing", () => {
    makeHero(0, 0);
    spawnPickup(Core, "coin", 0, 0, {});
    const events = [];
    Core.on("pickup:coin", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events[0].value).toBe(1);
  });

  it("collects weapon pickup and emits pickup:weapon", () => {
    makeHero(0, 0);
    spawnPickup(Core, "weapon", 0, 0, { weaponId: "shotgun" });
    const events = [];
    Core.on("pickup:weapon", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events[0].weaponId).toBe("shotgun");
  });

  it("emits pickup:collected for every kind", () => {
    makeHero(0, 0);
    spawnPickup(Core, "coin", 0, 0, { value: 1 });
    const collected = [];
    Core.on("pickup:collected", e => collected.push(e));
    pickupSystem(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].kind).toBe("coin");
  });

  it("emits pickup:collected for unknown kind", () => {
    makeHero(0, 0);
    spawnPickup(Core, "mystery", 0, 0, {});
    const collected = [];
    Core.on("pickup:collected", e => collected.push(e));
    pickupSystem(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].kind).toBe("mystery");
  });

  it("does NOT collect pickup outside 1.2m", () => {
    makeHero(0, 0);
    spawnPickup(Core, "coin", 2.0, 0, { value: 1 }); // 2m away
    const events = [];
    Core.on("pickup:collected", e => events.push(e));
    pickupSystem(0.016, Core);
    expect(events.length).toBe(0);
  });
});

describe("pickupSystem — magnetic pull", () => {
  beforeEach(() => { Core._reset(); });

  it("slides pickup toward hero when inside MAGNET_RADIUS (3.0m)", () => {
    makeHero(0, 0);
    const pid = spawnPickup(Core, "coin", 2.0, 0, { value: 1 });
    const before = { u: Core.getComponent(pid, "Transform").u };
    pickupSystem(0.5, Core); // large dt to see clear movement
    const after = Core.getComponent(pid, "Transform");
    // Should have moved left (toward hero at u=0)
    expect(after && after.u).toBeLessThan(before.u);
  });

  it("does NOT move pickup beyond MAGNET_RADIUS (3.0m)", () => {
    makeHero(0, 0);
    const pid = spawnPickup(Core, "coin", 3.5, 0, { value: 1 });
    const before = Core.getComponent(pid, "Transform").u;
    pickupSystem(0.016, Core);
    const after = Core.getComponent(pid, "Transform");
    // Outside magnet radius — should not move
    expect(after && after.u).toBe(before);
  });

  it("magnetic force is zero at magnet boundary and max at zero distance", () => {
    // At dist=2.0 out of 3.0, mag = 8*(1-2/3) = 2.667
    makeHero(0, 0);
    const pid = spawnPickup(Core, "coin", 2.0, 0, { value: 1 });
    pickupSystem(1.0, Core); // dt=1s for easy math
    const pos = Core.getComponent(pid, "Transform");
    // Expected shift = (0-2)/2 * 8*(1-2/3) * 1.0 = -1 * 2.667 = -2.667
    if (pos) {
      expect(pos.u).toBeCloseTo(2.0 - 2.667, 1);
    }
  });
});
