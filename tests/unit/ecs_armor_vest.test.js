import { describe, it, expect, beforeEach } from "vitest";
import {
  createArmorVestSystem,
  ARMOR_VEST_COLLECT_DIST,
  ARMOR_VEST_GRANT,
  ARMOR_VEST_RESPAWN_DELAY,
} from "../../src/systems/ecs_armor_vest.js";
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
describe("armor vest constants — monolith lines 8441/8444/8436 parity", () => {
  it("COLLECT_DIST = 1.3",      () => expect(ARMOR_VEST_COLLECT_DIST).toBe(1.3));
  it("GRANT = 25",              () => expect(ARMOR_VEST_GRANT).toBe(25));
  it("RESPAWN_DELAY = 60.0",    () => expect(ARMOR_VEST_RESPAWN_DELAY).toBe(60.0));
});

// ── Placement ─────────────────────────────────────────────────────────────────
describe("createArmorVestSystem — placement", () => {
  beforeEach(() => Core._reset());

  it("armor_vest:placed creates an ArmorVest entity that starts active", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    Core.emit("armor_vest:placed", { u: -5, v: 8 });
    const vests = Core.query("ArmorVest");
    expect(vests.length).toBe(1);
    const av = Core.getComponent(vests[0], "ArmorVest");
    expect(av.u).toBe(-5);
    expect(av.v).toBe(8);
    expect(av.active).toBe(true);
  });

  it("multiple placements create multiple vest entities", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    Core.emit("armor_vest:placed", { u: 0, v: 0 });
    Core.emit("armor_vest:placed", { u: 10, v: 10 });
    expect(Core.query("ArmorVest").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createArmorVestSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits armor_vest:collected with amount when hero walks over active vest", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "armor_vest:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].amount).toBe(ARMOR_VEST_GRANT);
  });

  it("vest becomes inactive after collection", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    sys(0.016, Core);
    const av = Core.getComponent(Core.query("ArmorVest")[0], "ArmorVest");
    expect(av.active).toBe(false);
  });

  it("respawnT set to RESPAWN_DELAY after collection", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    sys(0.016, Core);
    const av = Core.getComponent(Core.query("ArmorVest")[0], "ArmorVest");
    expect(av.respawnT).toBeCloseTo(ARMOR_VEST_RESPAWN_DELAY);
  });

  it("inactive vest cannot be collected immediately", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "armor_vest:collected");
    sys(0.016, Core);
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });

  it("no collection when hero is outside collect dist", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("armor_vest:placed", { u: 0, v: 0 });
    const collected = collectEvents(Core, "armor_vest:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero exactly at boundary does NOT collect", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(ARMOR_VEST_COLLECT_DIST, 0);
    Core.emit("armor_vest:placed", { u: 0, v: 0 });
    const collected = collectEvents(Core, "armor_vest:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });
});

// ── Respawn timer ─────────────────────────────────────────────────────────────
describe("createArmorVestSystem — respawn", () => {
  beforeEach(() => Core._reset());

  it("emits armor_vest:respawned after full delay", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    const respawned = collectEvents(Core, "armor_vest:respawned");
    sys(0.016, Core); // collect
    sys(ARMOR_VEST_RESPAWN_DELAY + 0.1, Core);
    expect(respawned.length).toBe(1);
  });

  it("vest is active again after respawn", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(10, 10); // far so no auto-collect on respawn
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    const av = Core.getComponent(Core.query("ArmorVest")[0], "ArmorVest");
    av.active = false;
    av.respawnT = 0.05;
    sys(0.1, Core);
    expect(av.active).toBe(true);
  });

  it("no respawn before delay elapses", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_vest:placed", { u: 0.5, v: 0 });
    const respawned = collectEvents(Core, "armor_vest:respawned");
    sys(0.016, Core); // collect
    sys(ARMOR_VEST_RESPAWN_DELAY - 5, Core); // not yet
    expect(respawned.length).toBe(0);
  });
});

// ── Tick / no hero ────────────────────────────────────────────────────────────
describe("createArmorVestSystem — tick / no hero", () => {
  beforeEach(() => Core._reset());

  it("emits armor_vest:tick each frame when vest is active", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("armor_vest:placed", { u: 0, v: 0 });
    const ticks = collectEvents(Core, "armor_vest:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
  });

  it("no crash when no hero entity exists", () => {
    const sys = createArmorVestSystem();
    sys.wireListeners(Core);
    Core.emit("armor_vest:placed", { u: 0, v: 0 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });
});
