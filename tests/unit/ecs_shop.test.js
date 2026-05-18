import { describe, it, expect, beforeEach } from "vitest";
import { applyShopEffect, tryBuy, createShopSystem } from "../../src/systems/ecs_shop.js";
import Core from "../../src/core/core.js";

const CONSTANTS = { HERO_MAX_ARMOR: 75 };

const ITEMS = {
  ammo_pistol: { name: "Pistol Ammo", cost: 2, effect: { op: "addItem", item: "pistol_9mm", qty: 30 } },
  medkit:      { name: "Medkit",      cost: 4, effect: { op: "addItem", item: "medkit",     qty: 1  } },
  grenade:     { name: "Grenades x3", cost: 5, effect: { op: "addCounter", target: "grenadeCount", value: 3, max: 9 } },
  armor:       { name: "Armor Shard", cost: 8, effect: { op: "addClamped", target: "armor", value: 25, max: "HERO_MAX_ARMOR" } },
  grenade_max: { name: "Grenade Crate", cost: 12, effect: { op: "set", target: "grenadeCount", value: 9 } },
  ammo_max:    { name: "Full Resupply", cost: 15, effect: { op: "bundle", actions: [
    { op: "addItem", item: "pistol_9mm", qty: 60 },
    { op: "addItem", item: "medkit",     qty: 2  },
  ]}},
};

function makeHero(coins = 20, armor = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Faction",       { id: "player" });
  Core.addComponent(id, "Score",         { coins });
  Core.addComponent(id, "Inventory",     { items: {} });
  Core.addComponent(id, "Counters",      { grenadeCount: 3, smokeGrenadeCount: 2, flashbangCount: 2, _mineCount: 2 });
  Core.addComponent(id, "Stats",         { armor, maxArmor: 75 });
  return id;
}

describe("applyShopEffect", () => {
  beforeEach(() => { Core._reset(); });

  it("addItem — adds qty to Inventory.items", () => {
    const id = makeHero();
    applyShopEffect({ op: "addItem", item: "pistol_9mm", qty: 30 }, id, Core);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(30);
  });

  it("addItem — stacks on existing qty", () => {
    const id = makeHero();
    Core.getComponent(id, "Inventory").items["pistol_9mm"] = 10;
    applyShopEffect({ op: "addItem", item: "pistol_9mm", qty: 30 }, id, Core);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(40);
  });

  it("addCounter — clamps to numeric max", () => {
    const id = makeHero();
    Core.getComponent(id, "Counters").grenadeCount = 8;
    applyShopEffect({ op: "addCounter", target: "grenadeCount", value: 3, max: 9 }, id, Core);
    expect(Core.getComponent(id, "Counters").grenadeCount).toBe(9);
  });

  it("addClamped — resolves string constant for max", () => {
    const id = makeHero(20, 60);
    applyShopEffect({ op: "addClamped", target: "armor", value: 25, max: "HERO_MAX_ARMOR" }, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Stats").armor).toBe(75); // capped at 75
  });

  it("addClamped — applies numeric max directly", () => {
    const id = makeHero(20, 0);
    applyShopEffect({ op: "addClamped", target: "armor", value: 25, max: 75 }, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Stats").armor).toBe(25);
  });

  it("set — sets counter to exact value", () => {
    const id = makeHero();
    applyShopEffect({ op: "set", target: "grenadeCount", value: 9 }, id, Core);
    expect(Core.getComponent(id, "Counters").grenadeCount).toBe(9);
  });

  it("bundle — runs all child actions", () => {
    const id = makeHero();
    applyShopEffect({ op: "bundle", actions: [
      { op: "addItem", item: "pistol_9mm", qty: 60 },
      { op: "addItem", item: "medkit",     qty: 2  },
    ]}, id, Core);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(60);
    expect(Core.getComponent(id, "Inventory").items["medkit"]).toBe(2);
  });

  it("no-op on unknown op — does not throw", () => {
    const id = makeHero();
    expect(() => applyShopEffect({ op: "unknown" }, id, Core)).not.toThrow();
  });
});

describe("tryBuy", () => {
  beforeEach(() => { Core._reset(); });

  it("returns ok:true and deducts coins on affordable purchase", () => {
    const id = makeHero(10);
    const result = tryBuy(ITEMS, id, "ammo_pistol", Core, CONSTANTS);
    expect(result.ok).toBe(true);
    expect(Core.getComponent(id, "Score").coins).toBe(8); // 10 - 2
  });

  it("applies the item effect on success", () => {
    const id = makeHero(10);
    tryBuy(ITEMS, id, "ammo_pistol", Core, CONSTANTS);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(30);
  });

  it("returns ok:false reason:insufficient when coins too low", () => {
    const id = makeHero(1); // only 1 coin, ammo_pistol costs 2
    const result = tryBuy(ITEMS, id, "ammo_pistol", Core, CONSTANTS);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficient");
    expect(result.cost).toBe(2);
    expect(result.have).toBe(1);
  });

  it("does NOT deduct coins on insufficient funds", () => {
    const id = makeHero(1);
    tryBuy(ITEMS, id, "ammo_pistol", Core, CONSTANTS);
    expect(Core.getComponent(id, "Score").coins).toBe(1);
  });

  it("returns ok:false reason:unknown_item for unknown item", () => {
    const id = makeHero(20);
    const result = tryBuy(ITEMS, id, "nonexistent", Core, CONSTANTS);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unknown_item");
  });

  it("armor purchase respects HERO_MAX_ARMOR cap", () => {
    const id = makeHero(20, 60);
    tryBuy(ITEMS, id, "armor", Core, CONSTANTS);
    expect(Core.getComponent(id, "Stats").armor).toBe(75);
  });

  it("grenade_max sets grenadeCount to 9", () => {
    const id = makeHero(20);
    tryBuy(ITEMS, id, "grenade_max", Core, CONSTANTS);
    expect(Core.getComponent(id, "Counters").grenadeCount).toBe(9);
  });

  it("ammo_max bundle adds all items", () => {
    const id = makeHero(20);
    tryBuy(ITEMS, id, "ammo_max", Core, CONSTANTS);
    const inv = Core.getComponent(id, "Inventory").items;
    expect(inv["pistol_9mm"]).toBe(60);
    expect(inv["medkit"]).toBe(2);
  });
});

describe("createShopSystem", () => {
  beforeEach(() => { Core._reset(); });

  it("wires shop:buy event listener on first tick", () => {
    const sys = createShopSystem(ITEMS, CONSTANTS);
    const id = makeHero(20);
    sys(0, Core); // wire listener

    const bought = [];
    Core.on("shop:bought", e => bought.push(e));
    Core.emit("shop:buy", { heroId: id, itemId: "ammo_pistol" });
    expect(bought.length).toBe(1);
    expect(bought[0].itemId).toBe("ammo_pistol");
    expect(bought[0].remainingCoins).toBe(18);
  });

  it("emits shop:insufficient when hero cannot afford item", () => {
    const sys = createShopSystem(ITEMS, CONSTANTS);
    const id = makeHero(1); // 1 coin, ammo_pistol costs 2
    sys(0, Core);

    const insuf = [];
    Core.on("shop:insufficient", e => insuf.push(e));
    Core.emit("shop:buy", { heroId: id, itemId: "ammo_pistol" });
    expect(insuf.length).toBe(1);
    expect(insuf[0].cost).toBe(2);
    expect(insuf[0].have).toBe(1);
  });

  it("emits shop:unknown_item for unrecognized itemId", () => {
    const sys = createShopSystem(ITEMS, CONSTANTS);
    const id = makeHero(20);
    sys(0, Core);

    const unknown = [];
    Core.on("shop:unknown_item", e => unknown.push(e));
    Core.emit("shop:buy", { heroId: id, itemId: "xyz" });
    expect(unknown.length).toBe(1);
  });

  it("sys.buy() is a shorthand for emitting shop:buy", () => {
    const sys = createShopSystem(ITEMS, CONSTANTS);
    const id = makeHero(20);
    sys(0, Core);

    const bought = [];
    Core.on("shop:bought", e => bought.push(e));
    sys.buy(Core, id, "medkit");
    expect(bought.length).toBe(1);
    expect(Core.getComponent(id, "Inventory").items["medkit"]).toBe(1);
  });

  it("sys.catalog exposes the shop items map", () => {
    const sys = createShopSystem(ITEMS, CONSTANTS);
    expect(sys.catalog).toBe(ITEMS);
  });
});
