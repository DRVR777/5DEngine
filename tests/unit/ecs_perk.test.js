import { describe, it, expect, beforeEach } from "vitest";
import { applyPerk, createPerkSystem } from "../../src/systems/ecs_perk.js";
import Core from "../../src/core/core.js";

const CONSTANTS = { HERO_MAX_ARMOR: 75 };

const PERKS = {
  dmg:      { label: "Power Shot",    effect: { op: "multiply", target: "_perkDmgMul",    value: 1.15 } },
  speed:    { label: "Sprinter",      effect: { op: "add",      target: "_perkSpeedBonus", value: 1 } },
  regen:    { label: "Battle Medic",  effect: { op: "add",      target: "_perkRegenBonus", value: 3 } },
  reload:   { label: "Quick Hands",   effect: { op: "multiply", target: "_perkReloadMul",  value: 0.85 } },
  maxhp:    { label: "Resilient",     effect: { op: "add",      target: "_perkMaxHpBonus", value: 25, healOnApply: 15 } },
  grenades: { label: "Grenadier",     effect: { op: "addItem",  target: "grenadeCount",    value: 3, max: 9 } },
  smoke:    { label: "Smoke Screen",  effect: { op: "addItem",  target: "smokeGrenadeCount", value: 2, max: 9 } },
  armor:    { label: "Fortified",     effect: { op: "add",      target: "heroArmor",       value: 30, max: "HERO_MAX_ARMOR" } },
  vampire:  { label: "Vampire",       effect: { op: "flag",     target: "_perkLifesteal",  value: true } },
  ammo:     { label: "Ammo Dump",     effect: { op: "addAmmo",  value: 40 } },
};

function makeHero(hp = 80, maxHp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Faction",       { id: "player" });
  Core.addComponent(id, "Health",        { hp, maxHp });
  Core.addComponent(id, "PerkState",     {
    _perkDmgMul: 1.0, _perkSpeedBonus: 0, _perkRegenBonus: 0,
    _perkReloadMul: 1.0, _perkMaxHpBonus: 0, _perkLifesteal: false,
  });
  Core.addComponent(id, "Counters",      { grenadeCount: 3, smokeGrenadeCount: 2 });
  Core.addComponent(id, "Stats",         { armor: 0, maxArmor: 75 });
  Core.addComponent(id, "Inventory",     { items: { pistol_9mm: 10 } });
  Core.addComponent(id, "ActiveWeapon",  { ammoItem: "pistol_9mm" });
  return id;
}

describe("applyPerk — multiply ops", () => {
  beforeEach(() => { Core._reset(); });

  it("dmg perk multiplies _perkDmgMul by 1.15", () => {
    const id = makeHero();
    applyPerk(PERKS.dmg, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkDmgMul).toBeCloseTo(1.15);
  });

  it("dmg perk stacks multiplicatively on second pick", () => {
    const id = makeHero();
    applyPerk(PERKS.dmg, id, Core, CONSTANTS);
    applyPerk(PERKS.dmg, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkDmgMul).toBeCloseTo(1.15 * 1.15);
  });

  it("reload perk multiplies _perkReloadMul by 0.85", () => {
    const id = makeHero();
    applyPerk(PERKS.reload, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkReloadMul).toBeCloseTo(0.85);
  });
});

describe("applyPerk — add ops", () => {
  beforeEach(() => { Core._reset(); });

  it("speed perk adds 1 to _perkSpeedBonus", () => {
    const id = makeHero();
    applyPerk(PERKS.speed, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkSpeedBonus).toBe(1);
  });

  it("regen perk adds 3 to _perkRegenBonus", () => {
    const id = makeHero();
    applyPerk(PERKS.regen, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkRegenBonus).toBe(3);
  });

  it("maxhp perk raises maxHp by 25 and immediately heals 15", () => {
    const id = makeHero(60, 100);
    applyPerk(PERKS.maxhp, id, Core, CONSTANTS);
    const h = Core.getComponent(id, "Health");
    expect(h.maxHp).toBe(125);
    expect(h.hp).toBe(75);
  });

  it("maxhp heal does not exceed new maxHp", () => {
    const id = makeHero(118, 100);
    applyPerk(PERKS.maxhp, id, Core, CONSTANTS);
    const h = Core.getComponent(id, "Health");
    expect(h.hp).toBe(125); // capped at new maxHp
  });

  it("armor perk adds 30 to Stats.armor", () => {
    const id = makeHero();
    applyPerk(PERKS.armor, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Stats").armor).toBe(30);
  });

  it("armor perk clamps to HERO_MAX_ARMOR", () => {
    const id = makeHero();
    Core.getComponent(id, "Stats").armor = 60;
    applyPerk(PERKS.armor, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Stats").armor).toBe(75);
  });
});

describe("applyPerk — flag, addItem, addAmmo ops", () => {
  beforeEach(() => { Core._reset(); });

  it("vampire perk sets _perkLifesteal to true", () => {
    const id = makeHero();
    applyPerk(PERKS.vampire, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "PerkState")._perkLifesteal).toBe(true);
  });

  it("grenades perk adds 3 to grenadeCount, capped at 9", () => {
    const id = makeHero();
    applyPerk(PERKS.grenades, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Counters").grenadeCount).toBe(6);
  });

  it("grenades perk clamps at max 9", () => {
    const id = makeHero();
    Core.getComponent(id, "Counters").grenadeCount = 8;
    applyPerk(PERKS.grenades, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Counters").grenadeCount).toBe(9);
  });

  it("smoke perk adds 2 to smokeGrenadeCount", () => {
    const id = makeHero();
    applyPerk(PERKS.smoke, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Counters").smokeGrenadeCount).toBe(4);
  });

  it("ammo perk adds 40 to active weapon ammo", () => {
    const id = makeHero();
    applyPerk(PERKS.ammo, id, Core, CONSTANTS);
    expect(Core.getComponent(id, "Inventory").items["pistol_9mm"]).toBe(50); // 10 + 40
  });
});

describe("createPerkSystem", () => {
  beforeEach(() => { Core._reset(); });

  it("offers PERK_CHOICES perks on wave:end", () => {
    const sys = createPerkSystem(PERKS, CONSTANTS);
    const id = makeHero();
    sys(0, Core);

    const offers = [];
    Core.on("perk:offer", e => offers.push(e));
    Core.emit("wave:end", { wave: 1 });
    expect(offers.length).toBe(1);
    expect(offers[0].choices.length).toBe(3);
    // All choices must be valid perk IDs
    for (const c of offers[0].choices) {
      expect(Object.keys(PERKS)).toContain(c);
    }
  });

  it("applies perk on perk:selected event", () => {
    const sys = createPerkSystem(PERKS, CONSTANTS);
    const id = makeHero();
    sys(0, Core);

    Core.emit("perk:selected", { perkId: "speed", heroId: id });
    expect(Core.getComponent(id, "PerkState")._perkSpeedBonus).toBe(1);
  });

  it("emits perk:applied after successful application", () => {
    const sys = createPerkSystem(PERKS, CONSTANTS);
    const id = makeHero();
    sys(0, Core);

    const applied = [];
    Core.on("perk:applied", e => applied.push(e));
    Core.emit("perk:selected", { perkId: "dmg", heroId: id });
    expect(applied.length).toBe(1);
    expect(applied[0].perkId).toBe("dmg");
    expect(applied[0].heroId).toBe(id);
  });

  it("emits perk:invalid for unknown perkId", () => {
    const sys = createPerkSystem(PERKS, CONSTANTS);
    const id = makeHero();
    sys(0, Core);

    const invalid = [];
    Core.on("perk:invalid", e => invalid.push(e));
    Core.emit("perk:selected", { perkId: "nonexistent", heroId: id });
    expect(invalid.length).toBe(1);
    expect(invalid[0].perkId).toBe("nonexistent");
  });

  it("sys.catalog exposes the perk map", () => {
    const sys = createPerkSystem(PERKS, CONSTANTS);
    expect(sys.catalog).toBe(PERKS);
  });
});
