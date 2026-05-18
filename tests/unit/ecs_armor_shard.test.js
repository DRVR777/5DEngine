import { describe, it, expect, beforeEach } from "vitest";
import {
  createArmorShardSystem,
  ARMOR_SHARD_COLLECT_DIST,
  ARMOR_SHARD_MAGNET_DIST,
  ARMOR_SHARD_MAGNET_SPEED,
} from "../../src/systems/ecs_armor_shard.js";
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
describe("armor shard constants — monolith lines 8257/8270 parity", () => {
  it("COLLECT_DIST = 1.2",  () => expect(ARMOR_SHARD_COLLECT_DIST).toBe(1.2));
  it("MAGNET_DIST = 3.0",   () => expect(ARMOR_SHARD_MAGNET_DIST).toBe(3.0));
  it("MAGNET_SPEED = 9.0",  () => expect(ARMOR_SHARD_MAGNET_SPEED).toBe(9.0));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createArmorShardSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("armor_shard:spawned creates an ArmorShard entity", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    Core.emit("armor_shard:spawned", { u: 2, v: 4, amount: 20 });
    const shards = Core.query("ArmorShard");
    expect(shards.length).toBe(1);
    const as = Core.getComponent(shards[0], "ArmorShard");
    expect(as.u).toBe(2);
    expect(as.v).toBe(4);
    expect(as.amount).toBe(20);
  });

  it("amount defaults to 1 when omitted", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    Core.emit("armor_shard:spawned", { u: 0, v: 0 });
    const as = Core.getComponent(Core.query("ArmorShard")[0], "ArmorShard");
    expect(as.amount).toBe(1);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createArmorShardSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits armor_shard:collected with amount when hero in range", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_shard:spawned", { u: 0.5, v: 0, amount: 15 });
    const collected = collectEvents(Core, "armor_shard:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].amount).toBe(15);
  });

  it("destroys entity on collection", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_shard:spawned", { u: 0.5, v: 0, amount: 10 });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("ArmorShard").length).toBe(0);
  });

  it("no collection outside collect dist", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("armor_shard:spawned", { u: 0, v: 0, amount: 10 });
    const collected = collectEvents(Core, "armor_shard:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero at boundary does NOT collect", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(ARMOR_SHARD_COLLECT_DIST, 0);
    Core.emit("armor_shard:spawned", { u: 0, v: 0, amount: 5 });
    const collected = collectEvents(Core, "armor_shard:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside boundary collects", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(ARMOR_SHARD_COLLECT_DIST - 0.01, 0);
    Core.emit("armor_shard:spawned", { u: 0, v: 0, amount: 5 });
    const collected = collectEvents(Core, "armor_shard:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });
});

// ── Magnet pull ───────────────────────────────────────────────────────────────
describe("createArmorShardSystem — magnet pull", () => {
  beforeEach(() => Core._reset());

  it("shard moves toward hero when inside magnet range", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_shard:spawned", { u: 2.0, v: 0, amount: 5 }); // d=2, inside magnet
    sys(0.1, Core);
    const as = Core.getComponent(Core.query("ArmorShard")[0], "ArmorShard");
    expect(as.u).toBeLessThan(2.0);
  });

  it("shard does NOT move outside magnet range", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_shard:spawned", { u: 4.0, v: 0, amount: 5 }); // d=4, outside
    sys(0.1, Core);
    const as = Core.getComponent(Core.query("ArmorShard")[0], "ArmorShard");
    expect(as.u).toBe(4.0);
  });

  it("no crash with hero at exact shard position (d=0 guard)", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("armor_shard:spawned", { u: 0, v: 0, amount: 5 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createArmorShardSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    Core.emit("armor_shard:spawned", { u: 0, v: 0, amount: 10 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("emits armor_shard:tick when no hero", () => {
    const sys = createArmorShardSystem();
    sys.wireListeners(Core);
    Core.emit("armor_shard:spawned", { u: 1, v: 2, amount: 5 });
    const ticks = collectEvents(Core, "armor_shard:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
  });
});
