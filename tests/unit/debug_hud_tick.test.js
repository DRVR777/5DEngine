import { it, expect, describe } from "vitest";
import { mountDebugHudTick } from "../../src/systems/debug_hud_tick.js";

function makeHeroPos(x = 1, y = 2, z = 3) { return { x, y, z }; }

function makeEnemy(hp, maxHp, dead = false, color = 0xff0044, respawnT = 0) {
  return { hp, maxHp, dead, color, respawnT };
}

function makeSpine(zone, localT = 0.5) { return { zone, localT }; }

function makeActions({ vehDists = {}, htmlLog = [], dirty = [true] } = {}) {
  return {
    getVehDist:        id => vehDists[id] ?? Infinity,
    setHudHtml:        html => htmlLog.push(html),
    clearEnemyHpDirty: () => { dirty[0] = false; },
  };
}

const HERO_POS = makeHeroPos(10.5, 1.0, -3.2);

const BASE = {
  heroPos: HERO_POS, heroU: 5.12, heroV: -2.88,
  worldLayerId: 0, insideNow: null,
  inCar: false, activeVehicleId: null, activeVehicleType: "car", carSpeed: 0,
  vehicleInteractDist: 3.0, vehicleDefs: [],
  score: 7, pickupsLen: 10,
  heroHp: 100, heroMaxHp: 100, perkMaxHpBonus: 0,
  enemyKills: 3,
  enemies: [makeEnemy(50, 100)], nowSec: 10, enemyRespawnDelay: 5,
  enemyHpDirty: true,
  nearNpc: null, nearComputer: false, computerOpen: false,
  spine: null, mouseMode: false, buildMode: false,
  reloadMsgUntil: 0, performanceNow: 1000, reloadMsg: "Reloading…",
};

describe("debug_hud_tick — position section", () => {
  it("includes heroPos coordinates", () => {
    const htmlLog = [];
    const sys = mountDebugHudTick({ actions: makeActions({ htmlLog }) });
    sys.tick(0.016, BASE);
    expect(htmlLog[0]).toContain("10.5");
    expect(htmlLog[0]).toContain("-3.2");
  });

  it("includes engine.uv", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) }).tick(0.016, BASE);
    expect(htmlLog[0]).toContain("5.12");
    expect(htmlLog[0]).toContain("-2.88");
  });

  it("includes layer id", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) }).tick(0.016, { ...BASE, worldLayerId: 4 });
    expect(htmlLog[0]).toContain("layer <b>4</b>");
  });

  it("insideNow with known id → shows building name", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, insideNow: { targetLayerId: 2 } });
    expect(htmlLog[0]).toContain("inside <b>shop</b>");
  });

  it("insideNow with unknown id → shows L<id>", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, insideNow: { targetLayerId: 99 } });
    expect(htmlLog[0]).toContain("inside <b>L99</b>");
  });

  it("insideNow=null → no inside line", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) }).tick(0.016, BASE);
    expect(htmlLog[0]).not.toContain("inside");
  });
});

describe("debug_hud_tick — vehicle section", () => {
  it("inCar + activeVehicleId → shows IN <TYPE> speed", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, inCar: true, activeVehicleId: "v1", activeVehicleType: "drone", carSpeed: 12.5 });
    expect(htmlLog[0]).toContain("IN DRONE");
    expect(htmlLog[0]).toContain("12.5");
  });

  it("near vehicle + not inCar → shows press E prompt", () => {
    const htmlLog = [];
    const vd = { id: "v1", type: "car" };
    mountDebugHudTick({ actions: makeActions({ htmlLog, vehDists: { v1: 2.0 } }) })
      .tick(0.016, { ...BASE, vehicleDefs: [vd] });
    expect(htmlLog[0]).toContain("press <b>E</b> to enter car");
  });

  it("vehicle too far → no prompt", () => {
    const htmlLog = [];
    const vd = { id: "v1", type: "car" };
    mountDebugHudTick({ actions: makeActions({ htmlLog, vehDists: { v1: 10 } }) })
      .tick(0.016, { ...BASE, vehicleDefs: [vd] });
    expect(htmlLog[0]).not.toContain("press");
  });
});

describe("debug_hud_tick — HP bar", () => {
  it("full HP → all filled chars", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) }).tick(0.016, BASE);
    expect(htmlLog[0]).toContain("▰".repeat(16));
  });

  it("0 HP → all empty chars", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, heroHp: 0 });
    expect(htmlLog[0]).toContain("▱".repeat(16));
  });

  it("50% HP → hpColor is yellow (#ffd166)", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, heroHp: 40 }); // 40/100 = 40% → frd166
    expect(htmlLog[0]).toContain("#ffd166");
  });

  it("critical HP (20%) → red color", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, heroHp: 20 });
    expect(htmlLog[0]).toContain("#ff5d5d");
  });
});

describe("debug_hud_tick — enemy HP string caching", () => {
  it("dirty=true → calls clearEnemyHpDirty", () => {
    const dirty = [true];
    const actions = makeActions({ dirty });
    mountDebugHudTick({ actions }).tick(0.016, { ...BASE, enemyHpDirty: true });
    expect(dirty[0]).toBe(false);
  });

  it("dirty=false → does NOT call clearEnemyHpDirty again", () => {
    const calls = [];
    const actions = { getVehDist: () => Infinity, setHudHtml: () => {}, clearEnemyHpDirty: () => calls.push(1) };
    mountDebugHudTick({ actions }).tick(0.016, { ...BASE, enemyHpDirty: false });
    expect(calls.length).toBe(0);
  });

  it("alive enemies → shows hp/maxHp", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, enemies: [makeEnemy(30, 100)] });
    expect(htmlLog[0]).toContain("30/100");
  });

  it("all dead → shows respawn countdown", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, {
        ...BASE,
        enemies: [makeEnemy(0, 100, true, 0xff0044, 8)],
        nowSec: 10, enemyRespawnDelay: 5,
      });
    // respawn in 5 - (10 - 8) = 3s
    expect(htmlLog[0]).toContain("respawn in 3");
  });
});

describe("debug_hud_tick — mode flags", () => {
  it("nearNpc → shows talk prompt", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, nearNpc: { id: "npc_alice" } });
    expect(htmlLog[0]).toContain("[E] talk to ALICE");
  });

  it("nearComputer → shows use computer", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, nearComputer: true });
    expect(htmlLog[0]).toContain("[E] use computer");
  });

  it("computerOpen → shows star open", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, computerOpen: true });
    expect(htmlLog[0]).toContain("★ computer open");
  });

  it("spine zone → shown in cam line", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, spine: makeSpine("INSIDE", 0.75) });
    expect(htmlLog[0]).toContain("INSIDE");
    expect(htmlLog[0]).toContain("75%");
  });

  it("mouseMode → shows MOUSE MODE", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, mouseMode: true });
    expect(htmlLog[0]).toContain("MOUSE MODE");
  });

  it("buildMode → shows BUILD MODE instructions", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, buildMode: true });
    expect(htmlLog[0]).toContain("BUILD MODE");
  });

  it("reloadMsgUntil > performanceNow → shows reload message", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, reloadMsgUntil: 2000, performanceNow: 1500, reloadMsg: "↻ Pistol" });
    expect(htmlLog[0]).toContain("↻ Pistol");
  });

  it("reloadMsgUntil <= performanceNow → no reload message", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, reloadMsgUntil: 500, performanceNow: 1000 });
    expect(htmlLog[0]).not.toContain("↻");
  });
});

describe("debug_hud_tick — score section", () => {
  it("all collected → shows star", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, score: 5, pickupsLen: 5 });
    expect(htmlLog[0]).toContain("★ ALL COLLECTED");
  });

  it("not all collected → no star", () => {
    const htmlLog = [];
    mountDebugHudTick({ actions: makeActions({ htmlLog }) })
      .tick(0.016, { ...BASE, score: 3, pickupsLen: 5 });
    expect(htmlLog[0]).not.toContain("★ ALL COLLECTED");
  });
});
