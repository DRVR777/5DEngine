import { describe, it, expect, beforeEach } from "vitest";
import {
  createGrenadeCrateSystem,
  GRENADE_CRATE_COLLECT_DIST,
  GRENADE_CRATE_GRANT,
  GRENADE_CRATE_RESPAWN_DELAY,
} from "../../src/systems/ecs_grenade_crate.js";
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
describe("grenade crate constants — monolith lines 8421/8423/8417 parity", () => {
  it("COLLECT_DIST = 1.3",      () => expect(GRENADE_CRATE_COLLECT_DIST).toBe(1.3));
  it("GRANT = 3",               () => expect(GRENADE_CRATE_GRANT).toBe(3));
  it("RESPAWN_DELAY = 30.0",    () => expect(GRENADE_CRATE_RESPAWN_DELAY).toBe(30.0));
});

// ── Placement ─────────────────────────────────────────────────────────────────
describe("createGrenadeCrateSystem — placement", () => {
  beforeEach(() => Core._reset());

  it("grenade_crate:placed creates a GrenadeCrate entity that starts active", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    Core.emit("grenade_crate:placed", { u: 10, v: -10 });
    const crates = Core.query("GrenadeCrate");
    expect(crates.length).toBe(1);
    const gc = Core.getComponent(crates[0], "GrenadeCrate");
    expect(gc.u).toBe(10);
    expect(gc.v).toBe(-10);
    expect(gc.active).toBe(true);
  });

  it("multiple placements create multiple crate entities", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    Core.emit("grenade_crate:placed", { u: 0, v: 0 });
    Core.emit("grenade_crate:placed", { u: 5, v: 5 });
    expect(Core.query("GrenadeCrate").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createGrenadeCrateSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits grenade_crate:collected with count when hero walks over active crate", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "grenade_crate:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].count).toBe(GRENADE_CRATE_GRANT);
  });

  it("collected event includes position", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0.3 });
    const collected = collectEvents(Core, "grenade_crate:collected");
    sys(0.016, Core);
    expect(collected[0].u).toBe(0.5);
    expect(collected[0].v).toBe(0.3);
  });

  it("crate becomes inactive after collection", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    sys(0.016, Core);
    const gc = Core.getComponent(Core.query("GrenadeCrate")[0], "GrenadeCrate");
    expect(gc.active).toBe(false);
  });

  it("inactive crate cannot be collected again immediately", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    const collected = collectEvents(Core, "grenade_crate:collected");
    sys(0.016, Core); // first collect
    sys(0.016, Core); // still in range, but crate is inactive
    expect(collected.length).toBe(1);
  });

  it("no collection when hero is outside collect dist", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("grenade_crate:placed", { u: 0, v: 0 });
    const collected = collectEvents(Core, "grenade_crate:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero at boundary does NOT collect", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(GRENADE_CRATE_COLLECT_DIST, 0);
    Core.emit("grenade_crate:placed", { u: 0, v: 0 });
    const collected = collectEvents(Core, "grenade_crate:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });
});

// ── Respawn timer ─────────────────────────────────────────────────────────────
describe("createGrenadeCrateSystem — respawn", () => {
  beforeEach(() => Core._reset());

  it("respawn timer counts down after collection", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    sys(0.016, Core); // collect
    sys(5.0, Core);   // advance timer
    const gc = Core.getComponent(Core.query("GrenadeCrate")[0], "GrenadeCrate");
    expect(gc.active).toBe(false);
    expect(gc.respawnT).toBeLessThan(GRENADE_CRATE_RESPAWN_DELAY);
  });

  it("emits grenade_crate:respawned after delay elapses", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    const respawned = collectEvents(Core, "grenade_crate:respawned");
    sys(0.016, Core); // collect
    sys(GRENADE_CRATE_RESPAWN_DELAY + 0.1, Core); // wait full delay
    expect(respawned.length).toBe(1);
    expect(respawned[0].u).toBe(0.5);
  });

  it("crate is active again after respawn delay", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(10, 10); // far so no auto-collect on respawn
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    // manually deactivate
    const gc = Core.getComponent(Core.query("GrenadeCrate")[0], "GrenadeCrate");
    gc.active = false;
    gc.respawnT = 0.05;
    sys(0.1, Core);
    expect(gc.active).toBe(true);
  });

  it("no respawn event before delay elapses", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("grenade_crate:placed", { u: 0.5, v: 0 });
    const respawned = collectEvents(Core, "grenade_crate:respawned");
    sys(0.016, Core); // collect
    sys(GRENADE_CRATE_RESPAWN_DELAY - 1.0, Core); // not yet
    expect(respawned.length).toBe(0);
  });
});

// ── Tick / no hero ────────────────────────────────────────────────────────────
describe("createGrenadeCrateSystem — tick / no hero", () => {
  beforeEach(() => Core._reset());

  it("emits grenade_crate:tick each frame when crate is active", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("grenade_crate:placed", { u: 0, v: 0 });
    const ticks = collectEvents(Core, "grenade_crate:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
  });

  it("no crash when no hero entity exists", () => {
    const sys = createGrenadeCrateSystem();
    sys.wireListeners(Core);
    Core.emit("grenade_crate:placed", { u: 0, v: 0 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });
});
