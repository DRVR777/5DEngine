import { describe, it, expect, beforeEach } from "vitest";
import {
  applyStatus, removeStatus, getStatMul, createStatusEffectSystem
} from "../../src/systems/ecs_status_effects.js";
import Core from "../../src/core/core.js";

function makeEntity(hp = 100, maxHp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "Health", { hp, maxHp });
  return id;
}

describe("applyStatus", () => {
  beforeEach(() => { Core._reset(); });

  it("creates StatusEffect component on first apply", () => {
    const id = makeEntity();
    applyStatus(Core, id, "poison");
    expect(Core.getComponent(id, "StatusEffect")).toBeDefined();
  });

  it("sets timeLeft from def.duration by default", () => {
    const id = makeEntity();
    applyStatus(Core, id, "poison");
    const se = Core.getComponent(id, "StatusEffect");
    expect(se.effects["poison"].timeLeft).toBe(5);
  });

  it("accepts custom duration override", () => {
    const id = makeEntity();
    applyStatus(Core, id, "burning", { duration: 10 });
    expect(Core.getComponent(id, "StatusEffect").effects["burning"].timeLeft).toBe(10);
  });

  it("stacks up to maxStacks", () => {
    const id = makeEntity();
    applyStatus(Core, id, "poison"); // stacks=1
    applyStatus(Core, id, "poison"); // stacks=2
    applyStatus(Core, id, "poison"); // stacks=3
    applyStatus(Core, id, "poison"); // capped at 3
    expect(Core.getComponent(id, "StatusEffect").effects["poison"].stacks).toBe(3);
  });

  it("refreshes timeLeft to max on re-apply (no reduction)", () => {
    const id = makeEntity();
    applyStatus(Core, id, "stun", { duration: 1.5 });
    applyStatus(Core, id, "stun", { duration: 0.5 }); // shorter — keep longer
    expect(Core.getComponent(id, "StatusEffect").effects["stun"].timeLeft).toBe(1.5);
  });

  it("emits status:applied event", () => {
    const id = makeEntity();
    const events = [];
    Core.on("status:applied", e => events.push(e));
    applyStatus(Core, id, "speedup");
    expect(events.length).toBe(1);
    expect(events[0].effectId).toBe("speedup");
    expect(events[0].entityId).toBe(id);
  });

  it("silently ignores unknown effectId", () => {
    const id = makeEntity();
    expect(() => applyStatus(Core, id, "nonexistent")).not.toThrow();
    expect(Core.getComponent(id, "StatusEffect")).toBeUndefined();
  });
});

describe("removeStatus", () => {
  beforeEach(() => { Core._reset(); });

  it("removes the effect from StatusEffect component", () => {
    const id = makeEntity();
    applyStatus(Core, id, "poison");
    removeStatus(Core, id, "poison");
    expect(Core.getComponent(id, "StatusEffect").effects["poison"]).toBeUndefined();
  });

  it("emits status:expired when removed", () => {
    const id = makeEntity();
    applyStatus(Core, id, "poison");
    const events = [];
    Core.on("status:expired", e => events.push(e));
    removeStatus(Core, id, "poison");
    expect(events.length).toBe(1);
    expect(events[0].effectId).toBe("poison");
  });

  it("no-op when effect not present", () => {
    const id = makeEntity();
    expect(() => removeStatus(Core, id, "poison")).not.toThrow();
  });
});

describe("getStatMul", () => {
  beforeEach(() => { Core._reset(); });

  it("returns 1.0 with no active effects", () => {
    const id = makeEntity();
    expect(getStatMul(Core, id, "speedMult")).toBe(1.0);
  });

  it("slowdown × 1 stack → speedMult 0.45", () => {
    const id = makeEntity();
    applyStatus(Core, id, "slowdown");
    expect(getStatMul(Core, id, "speedMult")).toBeCloseTo(0.45);
  });

  it("shield → defenceMult 2.0", () => {
    const id = makeEntity();
    applyStatus(Core, id, "shield");
    expect(getStatMul(Core, id, "defenceMult")).toBe(2.0);
  });

  it("stacks multiply: burning×2 defenceMult = 0.7^2 = 0.49", () => {
    const id = makeEntity();
    applyStatus(Core, id, "burning");
    applyStatus(Core, id, "burning");
    expect(getStatMul(Core, id, "defenceMult")).toBeCloseTo(0.7 * 0.7);
  });
});

describe("createStatusEffectSystem — tick logic", () => {
  beforeEach(() => { Core._reset(); });

  it("poison deals 2 × stacks × dt HP damage each tick", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core); // wire listeners

    applyStatus(Core, id, "poison"); // 1 stack
    sys(1.0, Core); // 1 second
    const hp = Core.getComponent(id, "Health").hp;
    expect(hp).toBeCloseTo(98, 0); // 100 - 2*1*1 = 98
  });

  it("burning deals 3 × stacks × dt HP damage each tick", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    applyStatus(Core, id, "burning");
    sys(1.0, Core);
    expect(Core.getComponent(id, "Health").hp).toBeCloseTo(97, 0);
  });

  it("heal_regen heals 4 × stacks × dt HP each tick", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(60, 100);
    sys(0, Core);

    applyStatus(Core, id, "heal_regen");
    sys(1.0, Core);
    expect(Core.getComponent(id, "Health").hp).toBeCloseTo(64, 0);
  });

  it("heal_regen does not exceed maxHp", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(99, 100);
    sys(0, Core);

    applyStatus(Core, id, "heal_regen", { stacks: 5 }); // lots of heal
    sys(10.0, Core); // large tick
    expect(Core.getComponent(id, "Health").hp).toBeLessThanOrEqual(100);
  });

  it("effect expires after duration and emits status:expired", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    const expired = [];
    Core.on("status:expired", e => expired.push(e));
    applyStatus(Core, id, "stun"); // duration 1.5s
    sys(2.0, Core); // past expiry
    expect(expired.length).toBeGreaterThanOrEqual(1);
    expect(expired.find(e => e.effectId === "stun")).toBeTruthy();
    // Stun should be gone from StatusEffect
    const se = Core.getComponent(id, "StatusEffect");
    expect(se.effects["stun"]).toBeUndefined();
  });

  it("status:apply event applies the effect", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    Core.emit("status:apply", { entityId: id, effectId: "shield" });
    expect(Core.getComponent(id, "StatusEffect").effects["shield"]).toBeDefined();
  });

  it("status:remove event removes the effect", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    applyStatus(Core, id, "poison");
    Core.emit("status:remove", { entityId: id, effectId: "poison" });
    expect(Core.getComponent(id, "StatusEffect").effects["poison"]).toBeUndefined();
  });

  it("status:clear event clears all effects", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    applyStatus(Core, id, "poison");
    applyStatus(Core, id, "burning");
    Core.emit("status:clear", { entityId: id });
    const se = Core.getComponent(id, "StatusEffect");
    expect(Object.keys(se.effects).length).toBe(0);
  });

  it("emits status:tick_dmg on poison tick", () => {
    const sys = createStatusEffectSystem();
    const id = makeEntity(100, 100);
    sys(0, Core);

    const dmgEvents = [];
    Core.on("status:tick_dmg", e => dmgEvents.push(e));
    applyStatus(Core, id, "poison");
    sys(1.0, Core);
    expect(dmgEvents.length).toBeGreaterThan(0);
    expect(dmgEvents[0].effectId).toBe("poison");
  });

  it("sys.defs exposes built-in effect definitions", () => {
    const sys = createStatusEffectSystem();
    expect(sys.defs["poison"]).toBeDefined();
    expect(sys.defs["burning"]).toBeDefined();
  });
});
