import { describe, it, expect, beforeEach } from "vitest";
import { regenSystem } from "../../src/systems/ecs_regen.js";
import Core from "../../src/core/core.js";

function makeHero(hp = 60, maxHp = 100, lastDamageT = -Infinity, regenBonus = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Health",        { hp, maxHp, lastDamageT });
  if (regenBonus > 0) {
    Core.addComponent(id, "PerkState", { _perkRegenBonus: regenBonus, _perkMaxHpBonus: 0 });
  }
  return id;
}

describe("regenSystem", () => {
  beforeEach(() => { Core._reset(); });

  it("does not regen while within 5s of last damage", () => {
    // lastDamageT = -Infinity means a long time ago BUT elapsed starts from 0 in module,
    // so let's test: hero with lastDamageT = elapsed - 3 (only 3s ago, < 5s)
    // We need to advance elapsed first by ticking with no damage
    const id = makeHero(60, 100, -Infinity);
    // Tick 4 seconds with full HP so no regen needed, then set damage time
    const fullHpHero = makeHero(100, 100, -Infinity);
    for (let i = 0; i < 40; i++) regenSystem(0.1, Core); // advance elapsed 4s
    // Now set damage time to current elapsed (≈4s)
    const health = Core.getComponent(id, "Health");
    health.lastDamageT = 4.0; // just took damage
    health.hp = 60;
    regenSystem(0.5, Core); // 0.5s later, still within 5s window
    expect(health.hp).toBe(60);
  });

  it("regens at base rate 4 HP/s after 5s delay", () => {
    const id = makeHero(60, 100, -Infinity);
    const health = Core.getComponent(id, "Health");
    // Advance elapsed past 5s
    for (let i = 0; i < 51; i++) regenSystem(0.1, Core); // advance 5.1s
    health.hp = 60; // reset after dummy ticks
    regenSystem(1.0, Core); // 1 more second — should regen 4 HP
    expect(health.hp).toBeCloseTo(64, 1);
  });

  it("does not exceed maxHp", () => {
    const id = makeHero(99, 100, -Infinity);
    for (let i = 0; i < 60; i++) regenSystem(0.1, Core); // advance past delay
    Core.getComponent(id, "Health").hp = 99;
    regenSystem(10.0, Core); // large tick
    expect(Core.getComponent(id, "Health").hp).toBeLessThanOrEqual(100);
  });

  it("does nothing when hp is already at maxHp", () => {
    const id = makeHero(100, 100, -Infinity);
    for (let i = 0; i < 60; i++) regenSystem(0.1, Core);
    const before = Core.getComponent(id, "Health").hp;
    regenSystem(1.0, Core);
    expect(Core.getComponent(id, "Health").hp).toBe(before);
  });

  it("perk regen bonus adds to base rate", () => {
    const id = makeHero(60, 100, -Infinity, 3); // +3 bonus → 7 HP/s
    for (let i = 0; i < 60; i++) regenSystem(0.1, Core);
    Core.getComponent(id, "Health").hp = 60;
    regenSystem(1.0, Core);
    expect(Core.getComponent(id, "Health").hp).toBeCloseTo(67, 1); // 60 + 7
  });

  it("emits hero:regen event when HP is restored", () => {
    const id = makeHero(60, 100, -Infinity);
    const events = [];
    Core.on("hero:regen", e => events.push(e));
    for (let i = 0; i < 60; i++) regenSystem(0.1, Core);
    Core.getComponent(id, "Health").hp = 60;
    regenSystem(1.0, Core);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].heroId).toBe(id);
    expect(events[0].gained).toBeGreaterThan(0);
  });

  it("does nothing if no PlayerControl+Health entities exist", () => {
    expect(() => regenSystem(1.0, Core)).not.toThrow();
  });
});
