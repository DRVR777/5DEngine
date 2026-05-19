import { it, expect, describe } from "vitest";
import { mountFirePatchTick } from "../../src/systems/fire_patch_tick.js";

function makeMesh() {
  return { material: { opacity: 0.5 }, visible: true };
}

function makePatch(id, { u = 5, v = 5, radius = 2, timeLeft = 3, dmgT = 0.5 } = {}) {
  return { id, u, v, radius, timeLeft, dmgT, mesh: makeMesh() };
}

function makeEnemy(id, { u = 5, v = 5, hp = 30 } = {}) {
  return { id, u, v, hp, dead: false, type: "grunt", dropQty: 12, dropAmmo: "pistol_9mm" };
}

function makeBarrel(id, { u = 5, v = 5, hp = 8 } = {}) {
  return { id, u, v, hp, exploded: false, mesh: { visible: true } };
}

function makeState({ heroHp = 100, heroFireT = 0 } = {}) {
  let hp = heroHp, fireT = heroFireT;
  const removed = [], shakes = [], burnCalls = [], dmgNums = [], kills = [], explosions = [];
  return {
    get: { heroHp: () => hp, heroFireT: () => fireT },
    set: { heroHp: v => { hp = v; }, heroFireT: v => { fireT = v; } },
    actions: {
      removeMesh: mesh => removed.push(mesh),
      applyBurning: () => burnCalls.push(1),
      applyScreenShake: amt => shakes.push(amt),
      spawnDamageNumber: (u, y, v, t, c) => dmgNums.push({ u, y, v, t, c }),
      getEnemyPos: id => {
        const parts = id.split("_");
        return { u: parseFloat(parts[1] || "5"), v: parseFloat(parts[2] || "5") };
      },
      onEnemyKill: (en, u, v) => kills.push({ en, u, v }),
      explodeBarrel: (u, v) => explosions.push({ u, v }),
    },
    getHp: () => hp, getFireT: () => fireT,
    removed, shakes, burnCalls, dmgNums, kills, explosions,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000, nowSec: 1, enemies: [], barrels: [] };

describe("fire_patch_tick — decay", () => {
  it("timeLeft decreases each tick", () => {
    const patches = [makePatch("f1", { u: 10, v: 10 })];
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches });
    expect(patches[0].timeLeft).toBeCloseTo(2.9);
  });

  it("expired patch → removed from array", () => {
    const patches = [makePatch("f1", { u: 10, v: 10, timeLeft: 0.01 })];
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches });
    expect(patches.length).toBe(0);
  });

  it("expired → removeMesh called", () => {
    const patch = makePatch("f1", { u: 10, v: 10, timeLeft: 0.01 });
    const { get, set, actions, removed } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches: [patch] });
    expect(removed).toContain(patch.mesh);
  });

  it("opacity flickers — check formula at nowMs=0", () => {
    const patch = makePatch("f1", { u: 10, v: 10, timeLeft: 3.0 });
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.016, { ...BASE, nowMs: 0, patches: [patch] });
    const expected = 0.55 * 1 * (1 - 0.2 + 0.2 * Math.sin(0));
    expect(patch.mesh.material.opacity).toBeCloseTo(expected);
  });
});

describe("fire_patch_tick — hero damage", () => {
  it("hero inside radius, dmgT ready → heroHp decreases by 6", () => {
    const patches = [makePatch("f1", { u: 0.5, v: 0, radius: 2, dmgT: 0 })];
    const { get, set, actions, getHp } = makeState({ heroHp: 100 });
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(getHp()).toBe(94);
  });

  it("hero inside radius → applyBurning called", () => {
    const patches = [makePatch("f1", { u: 0.5, v: 0, radius: 2, dmgT: 0 })];
    const { get, set, actions, burnCalls } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(burnCalls.length).toBeGreaterThan(0);
  });

  it("hero inside radius → heroFireT set to 2.5", () => {
    const patches = [makePatch("f1", { u: 0.5, v: 0, radius: 2, dmgT: 0 })];
    const { get, set, actions, getFireT } = makeState({ heroFireT: 0 });
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(getFireT()).toBe(2.5);
  });

  it("hero inside radius, dmgT not ready → no damage yet", () => {
    const patches = [makePatch("f1", { u: 0.5, v: 0, radius: 2, dmgT: 0.4 })];
    const { get, set, actions, getHp } = makeState({ heroHp: 100 });
    mountFirePatchTick({ get, set, actions }).tick(0.016, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(getHp()).toBe(100);
  });

  it("hero outside radius → no damage", () => {
    const patches = [makePatch("f1", { u: 5, v: 5, radius: 1, dmgT: 0 })];
    const { get, set, actions, getHp } = makeState({ heroHp: 100 });
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(getHp()).toBe(100);
  });

  it("heroHp cannot go below 0", () => {
    const patches = [makePatch("f1", { u: 0.5, v: 0, radius: 2, dmgT: 0 })];
    const { get, set, actions, getHp } = makeState({ heroHp: 3 });
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, heroU: 0, heroV: 0, patches });
    expect(getHp()).toBe(0);
  });
});

describe("fire_patch_tick — enemy damage", () => {
  it("enemy in radius, fireDmgT ready → hp decreases by 8", () => {
    const en = makeEnemy("en_0_0", { u: 0, v: 0, hp: 30 });
    en._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 2 })];
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, enemies: [en] });
    expect(en.hp).toBe(22);
  });

  it("enemy killed by fire → onEnemyKill called", () => {
    const en = makeEnemy("en_0_0", { u: 0, v: 0, hp: 5 });
    en._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 2 })];
    const { get, set, actions, kills } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, enemies: [en] });
    expect(kills.length).toBe(1);
    expect(kills[0].en).toBe(en);
  });

  it("enemy killed → marked dead", () => {
    const en = makeEnemy("en_0_0", { u: 0, v: 0, hp: 5 });
    en._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 2 })];
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, enemies: [en] });
    expect(en.dead).toBe(true);
  });

  it("dead enemy → skipped", () => {
    const en = makeEnemy("en_0_0", { u: 0, v: 0, hp: 30 });
    en.dead = true; en._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 2 })];
    const { get, set, actions, kills } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, enemies: [en] });
    expect(kills.length).toBe(0);
    expect(en.hp).toBe(30);
  });
});

describe("fire_patch_tick — barrel ignition", () => {
  it("barrel near fire, _fireDmgT ready → hp decreases by 8", () => {
    const bar = makeBarrel("b1", { u: 0, v: 0, hp: 20 });
    bar._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 1 })];
    const { get, set, actions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, barrels: [bar] });
    expect(bar.hp).toBe(12);
  });

  it("barrel destroyed → explodeBarrel called, hidden", () => {
    const bar = makeBarrel("b1", { u: 0, v: 0, hp: 5 });
    bar._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 1 })];
    const { get, set, actions, explosions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, barrels: [bar] });
    expect(bar.exploded).toBe(true);
    expect(bar.mesh.visible).toBe(false);
    expect(explosions.length).toBe(1);
  });

  it("already exploded barrel → skipped", () => {
    const bar = makeBarrel("b1", { u: 0, v: 0, hp: 5 });
    bar.exploded = true; bar._fireDmgT = 0;
    const patches = [makePatch("f1", { u: 0, v: 0, radius: 1 })];
    const { get, set, actions, explosions } = makeState();
    mountFirePatchTick({ get, set, actions }).tick(0.1, { ...BASE, patches, barrels: [bar] });
    expect(explosions.length).toBe(0);
  });
});

describe("fire_patch_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const patches = Array.from({ length: Math.floor(Math.random() * 3) }, (_, j) =>
        makePatch(`f${j}`, { u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10, radius: 0.5+Math.random()*2, timeLeft: Math.random()*5 })
      );
      const enemies = Array.from({ length: Math.floor(Math.random() * 3) }, (_, j) =>
        makeEnemy(`en_${(Math.random()-0.5)*10}_${(Math.random()-0.5)*10}`, { hp: Math.floor(Math.random()*40) })
      );
      const barrels = Array.from({ length: Math.floor(Math.random() * 2) }, (_, j) =>
        makeBarrel(`b${j}`, { u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10, hp: Math.floor(Math.random()*20) })
      );
      const { get, set, actions } = makeState({ heroHp: Math.random()*100 });
      expect(() =>
        mountFirePatchTick({ get, set, actions }).tick(0.016, {
          heroU: Math.random()*5, heroV: Math.random()*5,
          nowMs: Math.random()*60000, nowSec: Math.random()*60,
          patches, enemies, barrels,
        })
      ).not.toThrow();
    }
  });
});
