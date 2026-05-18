import { describe, it, expect, beforeEach } from "vitest";
import { Core } from "../../src/core/core.js";

beforeEach(() => { Core._reset(); });

// ── Entity registry ──────────────────────────────────────────────────────────

describe("Entity lifecycle", () => {
  it("creates entities with monotonic IDs starting at 1", () => {
    const a = Core.createEntity();
    const b = Core.createEntity();
    const c = Core.createEntity();
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
  });

  it("alive() returns true immediately after create", () => {
    const id = Core.createEntity();
    expect(Core.alive(id)).toBe(true);
  });

  it("destroyEntity defers removal until flush (called by runSystems)", () => {
    const id = Core.createEntity();
    Core.addComponent(id, "Tag", { v: 1 });
    Core.destroyEntity(id);
    expect(Core.alive(id)).toBe(false);        // _pendingDespawn marks as dead
    expect(Core.getComponent(id, "Tag")).toEqual({ v: 1 }); // still in store
    Core._flushDespawn();
    expect(Core.getComponent(id, "Tag")).toBeUndefined();  // removed after flush
  });

  it("runSystems flushes despawn at end of each step", () => {
    const id = Core.createEntity();
    Core.addSystem((dt, core) => { core.destroyEntity(id); });
    Core.runSystems(1 / 60, {});
    expect(Core.alive(id)).toBe(false);
    expect(Core.getComponent(id, "Transform")).toBeUndefined();
  });
});

// ── Component store ──────────────────────────────────────────────────────────

describe("Component CRUD", () => {
  it("addComponent returns the stored data object", () => {
    const id = Core.createEntity();
    const pos = Core.addComponent(id, "Transform", { u: 5, v: 3 });
    expect(pos).toEqual({ u: 5, v: 3 });
  });

  it("getComponent returns live reference (mutations persist)", () => {
    const id = Core.createEntity();
    const pos = Core.addComponent(id, "Transform", { u: 0 });
    pos.u = 99;
    expect(Core.getComponent(id, "Transform").u).toBe(99);
  });

  it("removeComponent clears the slot", () => {
    const id = Core.createEntity();
    Core.addComponent(id, "Health", { hp: 100 });
    Core.removeComponent(id, "Health");
    expect(Core.getComponent(id, "Health")).toBeUndefined();
    expect(Core.hasComponent(id, "Health")).toBe(false);
  });

  it("multiple component types on one entity are independent", () => {
    const id = Core.createEntity();
    Core.addComponent(id, "Transform", { u: 1 });
    Core.addComponent(id, "Velocity", { u: 5 });
    Core.removeComponent(id, "Transform");
    expect(Core.hasComponent(id, "Transform")).toBe(false);
    expect(Core.hasComponent(id, "Velocity")).toBe(true);
  });
});

// ── Query ────────────────────────────────────────────────────────────────────

describe("query()", () => {
  it("returns only entities with ALL requested components", () => {
    const a = Core.createEntity();
    const b = Core.createEntity();
    const c = Core.createEntity();
    Core.addComponent(a, "Transform", {}); Core.addComponent(a, "Velocity", {});
    Core.addComponent(b, "Transform", {});
    Core.addComponent(c, "Velocity", {});

    const both = Core.query("Transform", "Velocity");
    expect(both).toContain(a);
    expect(both).not.toContain(b);
    expect(both).not.toContain(c);
  });

  it("returns empty array when a component type has no registrations", () => {
    Core.createEntity();
    expect(Core.query("Ghost")).toEqual([]);
  });

  it("returns all entities for zero-arg query", () => {
    const a = Core.createEntity();
    const b = Core.createEntity();
    const all = Core.query();
    expect(all).toContain(a);
    expect(all).toContain(b);
  });

  it("excludes despawn-pending entities from subsequent queries after flush", () => {
    const a = Core.createEntity();
    Core.addComponent(a, "Transform", {});
    Core.destroyEntity(a);
    Core._flushDespawn();
    expect(Core.query("Transform")).not.toContain(a);
  });
});

// ── Event bus ─────────────────────────────────────────────────────────────────

describe("Event bus", () => {
  it("on/emit/off basic round-trip", () => {
    const received = [];
    Core.on("test", d => received.push(d));
    Core.emit("test", 42);
    Core.emit("test", 99);
    expect(received).toEqual([42, 99]);
  });

  it("on() returns an unsub function that works", () => {
    const received = [];
    const unsub = Core.on("ping", d => received.push(d));
    Core.emit("ping", 1);
    unsub();
    Core.emit("ping", 2);
    expect(received).toEqual([1]);
  });

  it("unsubscribing inside emit handler does not corrupt the listener list", () => {
    const received = [];
    let unsub;
    unsub = Core.on("snap", d => { received.push("A:" + d); unsub(); });
    Core.on("snap", d => { received.push("B:" + d); });

    Core.emit("snap", 1);
    Core.emit("snap", 2);
    expect(received).toEqual(["A:1", "B:1", "B:2"]);
  });

  it("emitting to event with no listeners is a no-op", () => {
    expect(() => Core.emit("ghost_channel", {})).not.toThrow();
  });
});

// ── System runner ─────────────────────────────────────────────────────────────

describe("System runner", () => {
  it("systems run in ascending priority order", () => {
    const order = [];
    Core.addSystem(() => order.push("B"), 10);
    Core.addSystem(() => order.push("A"), 1);
    Core.addSystem(() => order.push("C"), 20);
    Core.runSystems(1 / 60, {});
    expect(order).toEqual(["A", "B", "C"]);
  });

  it("system receives dt, core, and ctx", () => {
    let captured;
    const ctx = { scene: "test" };
    Core.addSystem((dt, core, c) => { captured = { dt, core, ctx: c }; });
    Core.runSystems(1 / 60, ctx);
    expect(captured.dt).toBeCloseTo(1 / 60);
    expect(captured.core).toBe(Core);
    expect(captured.ctx).toBe(ctx);
  });

  it("removeSystem stops it from running", () => {
    const calls = [];
    const fn = () => calls.push(1);
    Core.addSystem(fn);
    Core.runSystems(1 / 60, {});
    Core.removeSystem(fn);
    Core.runSystems(1 / 60, {});
    expect(calls.length).toBe(1);
  });
});

// ── Fixed timestep ────────────────────────────────────────────────────────────

describe("Fixed timestep accumulator", () => {
  it("runs exactly 3 steps for a 50ms frame at 60Hz", () => {
    let steps = 0;
    Core.addSystem(() => { steps++; });
    Core.tick(0.05, {});
    expect(steps).toBe(3);
  });

  it("caps at MAX_FRAME_DT (50ms) regardless of input", () => {
    let steps = 0;
    Core.addSystem(() => { steps++; });
    Core.tick(10.0, {});  // 10 second frame would be 600 steps uncapped
    expect(steps).toBeLessThanOrEqual(3);
  });

  it("accumulates partial steps across ticks", () => {
    let steps = 0;
    Core.addSystem(() => { steps++; });
    Core.tick(0.008, {}); // 8ms < 16.7ms → 0 steps
    expect(steps).toBe(0);
    Core.tick(0.008, {}); // 16ms total → 0 steps (not quite there yet)
    expect(steps).toBe(0);
    Core.tick(0.004, {}); // 20ms total → 1 step
    expect(steps).toBe(1);
  });

  it("returns interpolation alpha in [0, 1)", () => {
    const alpha = Core.tick(0.02, {});
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });
});

// ── Prefab system ─────────────────────────────────────────────────────────────

describe("Prefab system", () => {
  it("instantiates a simple prefab with cloned components", () => {
    Core.registerPrefab("bullet", {
      components: { Transform: { u: 0, v: 0 }, Projectile: { speed: 120, dmg: 20 } },
    });
    const id = Core.instantiate("bullet");
    expect(Core.getComponent(id, "Projectile")).toEqual({ speed: 120, dmg: 20 });
    // structuredClone means mutations don't bleed between instances
    const id2 = Core.instantiate("bullet");
    Core.getComponent(id, "Projectile").speed = 999;
    expect(Core.getComponent(id2, "Projectile").speed).toBe(120);
  });

  it("resolves 'extends' inheritance chain", () => {
    Core.registerPrefab("base_entity", {
      components: { Health: { hp: 100 }, Transform: { u: 0, v: 0 } },
    });
    Core.registerPrefab("enemy_grunt", {
      extends: "base_entity",
      components: { Health: { hp: 80 }, EnemyAI: { type: "grunt", state: "wander" } },
    });
    const id = Core.instantiate("enemy_grunt");
    expect(Core.getComponent(id, "Transform")).toEqual({ u: 0, v: 0 }); // inherited
    expect(Core.getComponent(id, "Health")).toEqual({ hp: 80 });          // overridden
    expect(Core.getComponent(id, "EnemyAI").type).toBe("grunt");          // child-only
  });

  it("detects prefab inheritance cycles and throws", () => {
    Core.registerPrefab("cycleA", { extends: "cycleB", components: {} });
    Core.registerPrefab("cycleB", { extends: "cycleA", components: {} });
    expect(() => Core.instantiate("cycleA")).toThrow(/cycle/i);
  });

  it("emits entity:created event on instantiate", () => {
    const events = [];
    Core.on("entity:created", e => events.push(e));
    Core.registerPrefab("marker", { components: { Tag: { label: "test" } } });
    const id = Core.instantiate("marker");
    expect(events).toEqual([{ id, prefab: "marker" }]);
  });

  it("overrides from instantiate() take priority over prefab defaults", () => {
    Core.registerPrefab("soldier", {
      components: { Health: { hp: 100 }, Transform: { u: 5, v: 5 } },
    });
    const id = Core.instantiate("soldier", {
      components: { Transform: { u: 99, v: 99 } },
    });
    expect(Core.getComponent(id, "Transform")).toEqual({ u: 99, v: 99 });
    expect(Core.getComponent(id, "Health")).toEqual({ hp: 100 });
  });
});
