import { describe, it, expect, beforeEach } from "vitest";
import {
  createCoinDropSystem,
  COIN_DROP_COLLECT_DIST,
  COIN_DROP_MAGNET_DIST,
  COIN_DROP_MAGNET_SPEED,
} from "../../src/systems/ecs_coin_drop.js";
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
describe("coin drop constants — monolith lines 8448/8460 parity", () => {
  it("COLLECT_DIST = 1.2",  () => expect(COIN_DROP_COLLECT_DIST).toBe(1.2));
  it("MAGNET_DIST = 3.0",   () => expect(COIN_DROP_MAGNET_DIST).toBe(3.0));
  it("MAGNET_SPEED = 9.0",  () => expect(COIN_DROP_MAGNET_SPEED).toBe(9.0));
});

// ── Spawn ─────────────────────────────────────────────────────────────────────
describe("createCoinDropSystem — spawn", () => {
  beforeEach(() => Core._reset());

  it("drop_spawned creates a CoinDrop entity", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 4, v: 2, value: 3 });
    const coins = Core.query("CoinDrop");
    expect(coins.length).toBe(1);
    const cd = Core.getComponent(coins[0], "CoinDrop");
    expect(cd.u).toBe(4);
    expect(cd.v).toBe(2);
    expect(cd.value).toBe(3);
  });

  it("value defaults to 1 when omitted", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 0, v: 0 });
    const cd = Core.getComponent(Core.query("CoinDrop")[0], "CoinDrop");
    expect(cd.value).toBe(1);
  });

  it("multiple drops create multiple entities", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    Core.emit("coin:drop_spawned", { u: 5, v: 5, value: 2 });
    expect(Core.query("CoinDrop").length).toBe(2);
  });
});

// ── Collection ────────────────────────────────────────────────────────────────
describe("createCoinDropSystem — collection", () => {
  beforeEach(() => Core._reset());

  it("emits coin:collected when hero is within collect dist", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 0.5, v: 0, value: 5 });
    const collected = collectEvents(Core, "coin:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
    expect(collected[0].value).toBe(5);
  });

  it("destroys entity on collection", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 0.5, v: 0, value: 1 });
    sys(0.016, Core);
    Core._flushDespawn();
    expect(Core.query("CoinDrop").length).toBe(0);
  });

  it("no collection when hero is outside collect dist", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    const collected = collectEvents(Core, "coin:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero at exactly collect dist boundary does NOT collect", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(COIN_DROP_COLLECT_DIST, 0);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    const collected = collectEvents(Core, "coin:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });

  it("hero just inside collect dist collects", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(COIN_DROP_COLLECT_DIST - 0.01, 0);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 2 });
    const collected = collectEvents(Core, "coin:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(1);
  });
});

// ── Magnetic pull ─────────────────────────────────────────────────────────────
describe("createCoinDropSystem — magnetic pull", () => {
  beforeEach(() => Core._reset());

  it("coin moves toward hero when inside magnet range", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 2.0, v: 0, value: 1 }); // d=2, inside magnet
    sys(0.1, Core);
    const cd = Core.getComponent(Core.query("CoinDrop")[0], "CoinDrop");
    expect(cd.u).toBeLessThan(2.0); // pulled toward hero at u=0
  });

  it("coin does NOT move when outside magnet range", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 4.0, v: 0, value: 1 }); // d=4, outside magnet
    sys(0.1, Core);
    const cd = Core.getComponent(Core.query("CoinDrop")[0], "CoinDrop");
    expect(cd.u).toBe(4.0); // no movement
  });

  it("magnetic pull is proportional to distance (stronger when closer)", () => {
    const sys1 = createCoinDropSystem();
    const sys2 = createCoinDropSystem();

    // Core1: coin at d=2.5 (weak pull)
    Core._reset();
    sys1.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 2.5, v: 0, value: 1 });
    sys1(0.1, Core);
    const cdFar = Core.getComponent(Core.query("CoinDrop")[0], "CoinDrop");
    const moveFar = 2.5 - cdFar.u;

    // Core2: coin at d=1.5 (stronger pull)
    Core._reset();
    sys2.wireListeners(Core);
    makeHero(0, 0);
    Core.emit("coin:drop_spawned", { u: 1.5, v: 0, value: 1 });
    sys2(0.1, Core);
    const cdNear = Core.getComponent(Core.query("CoinDrop")[0], "CoinDrop");
    const moveNear = 1.5 - cdNear.u;

    expect(moveNear).toBeGreaterThan(moveFar);
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createCoinDropSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("no crash when no hero entity exists", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    expect(() => sys(0.016, Core)).not.toThrow();
  });

  it("emits coin:tick even when no hero", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 3, v: 3, value: 1 });
    const ticks = collectEvents(Core, "coin:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
  });

  it("no collection events when no hero", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    const collected = collectEvents(Core, "coin:collected");
    sys(0.016, Core);
    expect(collected.length).toBe(0);
  });
});

// ── Tick event ────────────────────────────────────────────────────────────────
describe("createCoinDropSystem — tick event", () => {
  beforeEach(() => Core._reset());

  it("emits coin:tick with current position while alive and outside collect dist", () => {
    const sys = createCoinDropSystem();
    sys.wireListeners(Core);
    makeHero(10, 10);
    Core.emit("coin:drop_spawned", { u: 0, v: 0, value: 1 });
    const ticks = collectEvents(Core, "coin:tick");
    sys(0.016, Core);
    expect(ticks.length).toBe(1);
    expect(typeof ticks[0].u).toBe("number");
    expect(typeof ticks[0].v).toBe("number");
  });
});
