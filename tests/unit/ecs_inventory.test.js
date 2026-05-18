import { describe, it, expect, beforeEach } from "vitest";
import {
  invAdd, invRemove, invCount, invHas, invClear,
  createInventorySystem,
} from "../../src/systems/ecs_inventory.js";
import Core from "../../src/core/core.js";

// ── Pure helper tests ─────────────────────────────────────────────────────────
describe("invAdd", () => {
  it("adds qty to empty inventory", () => {
    const inv = { items: {} };
    const result = invAdd(inv, "pistol_9mm", 30);
    expect(result).toBe(30);
    expect(inv.items.pistol_9mm).toBe(30);
  });

  it("stacks onto existing qty", () => {
    const inv = { items: { pistol_9mm: 10 } };
    invAdd(inv, "pistol_9mm", 20);
    expect(inv.items.pistol_9mm).toBe(30);
  });

  it("defaults qty to 1", () => {
    const inv = { items: {} };
    invAdd(inv, "medkit");
    expect(inv.items.medkit).toBe(1);
  });

  it("ignores zero and negative qty", () => {
    const inv = { items: { medkit: 5 } };
    invAdd(inv, "medkit", 0);
    invAdd(inv, "medkit", -3);
    expect(inv.items.medkit).toBe(5);
  });

  it("handles null inv gracefully", () => {
    expect(() => invAdd(null, "medkit", 1)).not.toThrow();
  });
});

describe("invRemove", () => {
  it("removes qty from inventory", () => {
    const inv = { items: { pistol_9mm: 30 } };
    const removed = invRemove(inv, "pistol_9mm", 10);
    expect(removed).toBe(10);
    expect(inv.items.pistol_9mm).toBe(20);
  });

  it("clamps removal to available qty (can't go negative)", () => {
    const inv = { items: { medkit: 2 } };
    const removed = invRemove(inv, "medkit", 5);
    expect(removed).toBe(2); // only had 2
    expect(inv.items.medkit).toBeUndefined(); // deleted when 0
  });

  it("deletes key when qty reaches 0", () => {
    const inv = { items: { rifle_556: 1 } };
    invRemove(inv, "rifle_556", 1);
    expect(inv.items.rifle_556).toBeUndefined();
  });

  it("returns 0 for item not in inventory", () => {
    const inv = { items: {} };
    expect(invRemove(inv, "unknown_item", 1)).toBe(0);
  });

  it("ignores zero and negative qty", () => {
    const inv = { items: { medkit: 5 } };
    invRemove(inv, "medkit", 0);
    invRemove(inv, "medkit", -2);
    expect(inv.items.medkit).toBe(5);
  });
});

describe("invCount", () => {
  it("returns qty for present item", () => {
    const inv = { items: { pistol_9mm: 42 } };
    expect(invCount(inv, "pistol_9mm")).toBe(42);
  });

  it("returns 0 for absent item", () => {
    const inv = { items: {} };
    expect(invCount(inv, "missing")).toBe(0);
  });

  it("returns 0 for null inv", () => {
    expect(invCount(null, "medkit")).toBe(0);
  });
});

describe("invHas", () => {
  it("returns true when qty met", () => {
    const inv = { items: { medkit: 3 } };
    expect(invHas(inv, "medkit", 2)).toBe(true);
    expect(invHas(inv, "medkit", 3)).toBe(true);
  });

  it("returns false when qty not met", () => {
    const inv = { items: { medkit: 1 } };
    expect(invHas(inv, "medkit", 2)).toBe(false);
  });

  it("defaults qty check to 1", () => {
    const inv = { items: { medkit: 1 } };
    expect(invHas(inv, "medkit")).toBe(true);
    expect(invHas(inv, "missing")).toBe(false);
  });
});

describe("invClear", () => {
  it("removes all of an item", () => {
    const inv = { items: { pistol_9mm: 99 } };
    invClear(inv, "pistol_9mm");
    expect(inv.items.pistol_9mm).toBeUndefined();
  });

  it("no-ops on absent item", () => {
    const inv = { items: {} };
    expect(() => invClear(inv, "nope")).not.toThrow();
  });
});

// ── Event-driven system tests ─────────────────────────────────────────────────
describe("createInventorySystem", () => {
  beforeEach(() => Core._reset());

  function makeEntity(items = {}) {
    const id = Core.createEntity();
    Core.addComponent(id, "Inventory", { items: { ...items } });
    return id;
  }

  it("inventory:add increases qty and emits inventory:changed", () => {
    const sys = createInventorySystem();
    const id = makeEntity({ pistol_9mm: 10 });
    sys(0, Core);

    const changed = [];
    Core.on("inventory:changed", e => changed.push(e));

    Core.emit("inventory:add", { entityId: id, item: "pistol_9mm", qty: 5 });

    expect(Core.getComponent(id, "Inventory").items.pistol_9mm).toBe(15);
    expect(changed.length).toBe(1);
    expect(changed[0].qty).toBe(15);
    expect(changed[0].delta).toBe(5);
  });

  it("inventory:remove decreases qty", () => {
    const sys = createInventorySystem();
    const id = makeEntity({ medkit: 3 });
    sys(0, Core);

    Core.emit("inventory:remove", { entityId: id, item: "medkit", qty: 1 });

    expect(Core.getComponent(id, "Inventory").items.medkit).toBe(2);
  });

  it("inventory:remove emits inventory:empty when qty hits 0", () => {
    const sys = createInventorySystem();
    const id = makeEntity({ rifle_556: 1 });
    sys(0, Core);

    const empties = [];
    Core.on("inventory:empty", e => empties.push(e));

    Core.emit("inventory:remove", { entityId: id, item: "rifle_556", qty: 1 });

    expect(empties.length).toBe(1);
    expect(empties[0].item).toBe("rifle_556");
    expect(Core.getComponent(id, "Inventory").items.rifle_556).toBeUndefined();
  });

  it("inventory:add to entity with no Inventory component is a no-op", () => {
    const sys = createInventorySystem();
    const id = Core.createEntity(); // no Inventory component
    sys(0, Core);

    expect(() => Core.emit("inventory:add", { entityId: id, item: "medkit", qty: 1 })).not.toThrow();
  });

  it("does not re-wire listeners on subsequent ticks", () => {
    const sys = createInventorySystem();
    const id = makeEntity({ medkit: 0 });
    sys(0, Core);
    sys(0, Core);
    sys(0, Core);

    Core.emit("inventory:add", { entityId: id, item: "medkit", qty: 1 });

    // If listeners were wired 3×, qty would be 3 instead of 1
    expect(Core.getComponent(id, "Inventory").items.medkit).toBe(1);
  });
});
