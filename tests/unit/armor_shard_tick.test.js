import { it, expect, describe } from "vitest";
import { mountArmorShardTick } from "../../src/systems/armor_shard_tick.js";

function makeMesh(u = 0, v = 0) {
  return { rotation: { x: 0, y: 0 }, position: { x: u, y: 0.5, z: v } };
}

function makeShard(id, { u = 5, v = 5, amount = 25 } = {}) {
  return { id, u, v, amount, mesh: makeMesh(u, v) };
}

function makeState({ heroArmor = 50, maxArmor = 100 } = {}) {
  let armor = heroArmor;
  const sfx = [], toasts = [], dmgNums = [], removed = [];
  return {
    get: { heroArmor: () => armor, maxArmor: () => maxArmor },
    set: { heroArmor: v => { armor = v; } },
    actions: {
      removeMesh: mesh => removed.push(mesh),
      playSfx: (str, vol) => sfx.push({ str, vol }),
      spawnDamageNumber: (u, y, v, text, color) => dmgNums.push({ u, y, v, text, color }),
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
    },
    getArmor: () => armor,
    sfx, toasts, dmgNums, removed,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("armor_shard_tick — collection", () => {
  it("shard within 1.2m → removed from array", () => {
    const pickups = [makeShard("s1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState();
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
  });

  it("collection → heroArmor increases (capped at maxArmor)", () => {
    const pickups = [makeShard("s1", { u: 0.5, v: 0, amount: 60 })];
    const { get, set, actions, getArmor } = makeState({ heroArmor: 80, maxArmor: 100 });
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getArmor()).toBe(100); // 80+60>100, capped
  });

  it("collection → damage number shows gained ARM", () => {
    const pickups = [makeShard("s1", { u: 0.5, v: 0, amount: 20 })];
    const { get, set, actions, dmgNums } = makeState({ heroArmor: 50 });
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(dmgNums[0].text).toBe("+20 ARM");
    expect(dmgNums[0].color).toBe("#ffd166");
  });

  it("collection → two sfx calls (dual tone)", () => {
    const pickups = [makeShard("s1", { u: 0.5, v: 0 })];
    const { get, set, actions, sfx } = makeState();
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBe(2);
    expect(sfx[0].str).toContain("880");
    expect(sfx[1].str).toContain("1100");
  });

  it("no toast when gained = 0 (armor full)", () => {
    const pickups = [makeShard("s1", { u: 0.5, v: 0, amount: 10 })];
    const { get, set, actions, toasts } = makeState({ heroArmor: 100, maxArmor: 100 });
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts.length).toBe(0);
  });

  it("shard beyond range → not collected", () => {
    const pickups = [makeShard("s1", { u: 5, v: 5 })];
    const { get, set, actions } = makeState();
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(1);
  });
});

describe("armor_shard_tick — animation", () => {
  it("distant shard → rotates on both axes", () => {
    const s = makeShard("s1", { u: 5, v: 5 });
    const { get, set, actions } = makeState();
    mountArmorShardTick({ get, set, actions }).tick(0.016, { ...BASE, pickups: [s] });
    expect(s.mesh.rotation.y).toBeGreaterThan(0);
    expect(s.mesh.rotation.x).toBeGreaterThan(0);
  });

  it("within magnet range → pulled toward hero", () => {
    const s = makeShard("s1", { u: 2, v: 0 }); // d=2 < 3
    const origU = s.u;
    const { get, set, actions } = makeState();
    mountArmorShardTick({ get, set, actions }).tick(0.1, { ...BASE, pickups: [s] });
    expect(s.u).toBeLessThan(origU);
    expect(s.mesh.position.x).toBeCloseTo(s.u);
  });
});

describe("armor_shard_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => makeShard(`s${j}`, { u: (Math.random() - 0.5) * 10, v: (Math.random() - 0.5) * 10, amount: Math.random() * 50 }));
      const { get, set, actions } = makeState({ heroArmor: Math.random() * 100, maxArmor: 100 });
      expect(() => mountArmorShardTick({ get, set, actions }).tick(0.016, { heroU: Math.random() * 5, heroV: Math.random() * 5, nowMs: Math.random() * 60000, pickups })).not.toThrow();
    }
  });
});
