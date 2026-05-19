import { it, expect, describe } from "vitest";
import { mountCombatAmbientTick } from "../../src/systems/combat_ambient_tick.js";

function makeState(ambT = 0) {
  let _ambT = ambT;
  return {
    get: { ambT: () => _ambT },
    set: { ambT: v => { _ambT = v; } },
    _getAmbT: () => _ambT,
  };
}

function makeActions(ready = true, log = []) {
  return {
    isAmbientReady: () => ready,
    setAmbient: (key, freq, type, vol, fade) => log.push({ key, freq, type, vol, fade }),
  };
}

function makeTick(ambT = 0, ready = true) {
  const state = makeState(ambT);
  const log = [];
  const { tick } = mountCombatAmbientTick({ ...state, actions: makeActions(ready, log) });
  return { tick, log, state };
}

const NO_ENEMIES = [];
function makeEnemy({ dead = false, id = "en_spawned_1", wasChasing = false } = {}) {
  return { dead, id, _wasChasing: wasChasing };
}

describe("combat_ambient_tick — throttle", () => {
  it("does not fire when ambient not ready", () => {
    const { tick, log } = makeTick(0, false);
    tick(10, NO_ENEMIES, false, false);
    expect(log.length).toBe(0);
  });

  it("fires on first call (ambT = 0)", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    expect(log.length).toBeGreaterThan(0);
  });

  it("does not fire again within 1 second", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    const countAfterFirst = log.length;
    tick(10.5, NO_ENEMIES, false, false);
    expect(log.length).toBe(countAfterFirst);
  });

  it("fires again after 1 second has elapsed", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    const countAfterFirst = log.length;
    tick(11.1, NO_ENEMIES, false, false);
    expect(log.length).toBeGreaterThan(countAfterFirst);
  });

  it("updates ambT on fire", () => {
    const { tick, state } = makeTick(0);
    tick(42.5, NO_ENEMIES, false, false);
    expect(state._getAmbT()).toBe(42.5);
  });
});

describe("combat_ambient_tick — wind", () => {
  it("always calls setAmbient for wind when firing", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    expect(log.some(e => e.key === "wind")).toBe(true);
  });

  it("wind uses sawtooth at 220Hz", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    const wind = log.find(e => e.key === "wind");
    expect(wind.freq).toBe(220);
    expect(wind.type).toBe("sawtooth");
  });
});

describe("combat_ambient_tick — calm pad", () => {
  it("calm volume is 0.024 when no enemies, no boss, hero alive", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    const calm = log.find(e => e.key === "calm");
    expect(calm.vol).toBeCloseTo(0.024);
  });

  it("calm2 volume is calm * 0.65", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    const calm  = log.find(e => e.key === "calm");
    const calm2 = log.find(e => e.key === "calm2");
    expect(calm2.vol).toBeCloseTo(calm.vol * 0.65);
  });

  it("calm volume is 0 when hero is dead", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, true);
    expect(log.find(e => e.key === "calm").vol).toBe(0);
  });

  it("calm volume is 0 when boss is alive", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, true, false);
    expect(log.find(e => e.key === "calm").vol).toBe(0);
  });

  it("calm volume is 0 when enemies are chasing", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ wasChasing: true })];
    tick(10, enemies, false, false);
    expect(log.find(e => e.key === "calm").vol).toBe(0);
  });

  it("calm is NOT zero when enemies alive but none chasing", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ wasChasing: false })];
    tick(10, enemies, false, false);
    expect(log.find(e => e.key === "calm").vol).toBeGreaterThan(0);
  });
});

describe("combat_ambient_tick — tension", () => {
  it("tension vol scales with chasing enemy count", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ wasChasing: true }), makeEnemy({ wasChasing: true })];
    tick(10, enemies, false, false);
    const tension = log.find(e => e.key === "tension");
    expect(tension.vol).toBeCloseTo(0.020);
  });

  it("tension vol caps at 0.055", () => {
    const { tick, log } = makeTick(0);
    const enemies = Array.from({ length: 20 }, () => makeEnemy({ wasChasing: true }));
    tick(10, enemies, false, false);
    expect(log.find(e => e.key === "tension").vol).toBe(0.055);
  });

  it("tension uses low freq when boss alive", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, true, false);
    expect(log.find(e => e.key === "tension").freq).toBe(38);
    expect(log.find(e => e.key === "tension2").freq).toBe(42);
  });

  it("tension uses normal freq when no boss", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    expect(log.find(e => e.key === "tension").freq).toBe(55);
    expect(log.find(e => e.key === "tension2").freq).toBe(58);
  });

  it("tension2 vol is 55% of tension vol", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ wasChasing: true })];
    tick(10, enemies, false, false);
    const t1 = log.find(e => e.key === "tension");
    const t2 = log.find(e => e.key === "tension2");
    expect(t2.vol).toBeCloseTo(t1.vol * 0.55);
  });
});

describe("combat_ambient_tick — boss rumble", () => {
  it("bossRumble vol is 0.018 when boss alive", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, true, false);
    expect(log.find(e => e.key === "bossRumble").vol).toBeCloseTo(0.018);
  });

  it("bossRumble vol is 0 when no boss", () => {
    const { tick, log } = makeTick(0);
    tick(10, NO_ENEMIES, false, false);
    expect(log.find(e => e.key === "bossRumble").vol).toBe(0);
  });
});

describe("combat_ambient_tick — enemy counting", () => {
  it("dead enemies are excluded from chasing count", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ dead: true, wasChasing: true })];
    tick(10, enemies, false, false);
    expect(log.find(e => e.key === "calm").vol).toBeGreaterThan(0); // no live chasers
  });

  it("enemy with non-spawned id does not count as anyAlive", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ id: "boss_golem", wasChasing: false })];
    tick(10, enemies, false, false);
    // anyAlive is false, aliveChasing is 0, so calm should be 0.024
    expect(log.find(e => e.key === "calm").vol).toBeCloseTo(0.024);
  });

  it("spawned enemy (en_spawned_) sets anyAlive", () => {
    const { tick, log } = makeTick(0);
    const enemies = [makeEnemy({ id: "en_spawned_42", wasChasing: false })];
    tick(10, enemies, false, false);
    // anyAlive=true, but aliveChasing=0 → calm is still active
    expect(log.find(e => e.key === "calm").vol).toBeGreaterThan(0);
  });
});

describe("combat_ambient_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    const state = makeState(0);
    const log = [];
    const { tick } = mountCombatAmbientTick({ ...state, actions: makeActions(true, log) });
    for (let i = 0; i < 20; i++) {
      const nowSec = Math.random() * 1000;
      const nEnemies = Math.floor(Math.random() * 10);
      const enemies = Array.from({ length: nEnemies }, () => makeEnemy({
        dead: Math.random() > 0.5,
        wasChasing: Math.random() > 0.5,
        id: Math.random() > 0.5 ? "en_spawned_x" : "custom_enemy",
      }));
      expect(() => tick(nowSec, enemies, Math.random() > 0.5, Math.random() > 0.5)).not.toThrow();
    }
  });
});
