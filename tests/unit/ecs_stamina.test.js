import { describe, it, expect, beforeEach } from "vitest";
import {
  createStaminaSystem,
  STAMINA_MAX, STAMINA_DRAIN, STAMINA_REGEN, STAMINA_LOCKOUT, DODGE_COST,
} from "../../src/systems/ecs_stamina.js";
import Core from "../../src/core/core.js";

function makeHero(opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Stamina", {
    stamina:         opts.stamina         ?? STAMINA_MAX,
    staminaMax:      opts.staminaMax      ?? STAMINA_MAX,
    extraStaminaMax: opts.extraStaminaMax ?? 0,
    wantsSprint:     opts.wantsSprint     ?? false,
    isSprinting:     opts.isSprinting     ?? false,
  });
  return id;
}

describe("Stamina constants — monolith line 6009-6013 parity", () => {
  it("STAMINA_MAX = 100",     () => expect(STAMINA_MAX).toBe(100));
  it("STAMINA_DRAIN = 22",    () => expect(STAMINA_DRAIN).toBe(22));
  it("STAMINA_REGEN = 14",    () => expect(STAMINA_REGEN).toBe(14));
  it("STAMINA_LOCKOUT = 15",  () => expect(STAMINA_LOCKOUT).toBe(15));
  it("DODGE_COST = 20",       () => expect(DODGE_COST).toBe(20));
});

describe("createStaminaSystem — sprint drain", () => {
  beforeEach(() => Core._reset());

  it("sprinting drains stamina at STAMINA_DRAIN/s", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 100, wantsSprint: true, isSprinting: true });
    sys(0, Core); // wire listeners

    sys(1.0, Core); // 1 second of sprinting

    const st = Core.getComponent(hid, "Stamina");
    expect(st.stamina).toBeCloseTo(100 - 22, 5); // 100 - DRAIN*1 = 78
  });

  it("sprint stops automatically when stamina hits 0", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 5, wantsSprint: true, isSprinting: true });
    sys(0, Core);

    sys(1.0, Core); // should drain to 0 and stop sprint

    const st = Core.getComponent(hid, "Stamina");
    expect(st.stamina).toBe(0);
    expect(st.isSprinting).toBe(false);
  });

  it("emits stamina:depleted when stamina hits 0", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 5, wantsSprint: true, isSprinting: true });
    sys(0, Core);

    const depleted = [];
    Core.on("stamina:depleted", e => depleted.push(e));

    sys(1.0, Core);

    expect(depleted.length).toBe(1);
    expect(depleted[0].heroId).toBe(hid);
  });

  it("sprint blocked when stamina < LOCKOUT (15) and not already sprinting", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 10, wantsSprint: true, isSprinting: false });
    sys(0, Core);

    const blocked = [];
    Core.on("stamina:sprint_blocked", e => blocked.push(e));

    sys(0.016, Core);

    expect(Core.getComponent(hid, "Stamina").isSprinting).toBe(false);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("can continue sprinting if stamina drops below LOCKOUT while already sprinting", () => {
    const sys = createStaminaSystem();
    // stamina=12, already sprinting — should continue (monolith: isSprinting ? stamina>=1 : stamina>=LOCKOUT)
    const hid = makeHero({ stamina: 12, wantsSprint: true, isSprinting: true });
    sys(0, Core);

    sys(0.016, Core);

    expect(Core.getComponent(hid, "Stamina").isSprinting).toBe(true);
  });
});

describe("createStaminaSystem — regen", () => {
  beforeEach(() => Core._reset());

  it("stamina regens at STAMINA_REGEN/s when not sprinting", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 50, wantsSprint: false });
    sys(0, Core);

    sys(1.0, Core);

    const st = Core.getComponent(hid, "Stamina");
    expect(st.stamina).toBeCloseTo(50 + 14, 5); // 64
  });

  it("stamina does not exceed max during regen", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 98, wantsSprint: false });
    sys(0, Core);

    sys(2.0, Core); // would add 28 but capped

    expect(Core.getComponent(hid, "Stamina").stamina).toBe(100);
  });

  it("stamina regens even when wantsSprint=true but blocked (stamina < LOCKOUT)", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 5, wantsSprint: true, isSprinting: false });
    sys(0, Core);

    sys(1.0, Core); // blocked sprint → regen

    const st = Core.getComponent(hid, "Stamina");
    expect(st.stamina).toBeGreaterThan(5); // should have regenerated
  });
});

describe("createStaminaSystem — events", () => {
  beforeEach(() => Core._reset());

  it("player:sprint_start sets wantsSprint=true", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ wantsSprint: false });
    sys(0, Core);

    Core.emit("player:sprint_start", { heroId: hid });

    expect(Core.getComponent(hid, "Stamina").wantsSprint).toBe(true);
  });

  it("player:sprint_stop sets wantsSprint=false and isSprinting=false", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ wantsSprint: true, isSprinting: true });
    sys(0, Core);

    Core.emit("player:sprint_stop", { heroId: hid });

    const st = Core.getComponent(hid, "Stamina");
    expect(st.wantsSprint).toBe(false);
    expect(st.isSprinting).toBe(false);
  });

  it("player:dodge costs 20 stamina", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 80 });
    sys(0, Core);

    Core.emit("player:dodge", { heroId: hid });

    expect(Core.getComponent(hid, "Stamina").stamina).toBe(60);
  });

  it("player:dodge clamps stamina to 0 if not enough", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 10 });
    sys(0, Core);

    Core.emit("player:dodge", { heroId: hid });

    expect(Core.getComponent(hid, "Stamina").stamina).toBe(0);
  });

  it("stamina:add_max extends max and immediately tops up (monolith LVL 3 perk)", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 100, extraStaminaMax: 0 });
    sys(0, Core);

    Core.emit("stamina:add_max", { heroId: hid, amount: 25 });

    const st = Core.getComponent(hid, "Stamina");
    expect(st.extraStaminaMax).toBe(25);
    expect(st.stamina).toBe(125); // 100 + 25 = 125, new max is 125
  });

  it("emits stamina:changed on regen", () => {
    const sys = createStaminaSystem();
    const hid = makeHero({ stamina: 50, wantsSprint: false });
    sys(0, Core);

    const changes = [];
    Core.on("stamina:changed", e => changes.push(e));

    sys(1.0, Core);

    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].heroId).toBe(hid);
    expect(changes[0].stamina).toBeCloseTo(64, 0);
  });
});
