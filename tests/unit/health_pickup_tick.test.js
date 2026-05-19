import { it, expect, describe } from "vitest";
import { mountHealthPickupTick } from "../../src/systems/health_pickup_tick.js";

function makeMesh(u = 0, v = 0) {
  return { rotation: { x: 0, y: 0 }, position: { x: u, y: 0.6, z: v } };
}

function makePickup(id, { u = 5, v = 5, amount = 20 } = {}) {
  return { id, u, v, amount, mesh: makeMesh(u, v) };
}

function makeState({ heroHp = 80, maxHp = 100 } = {}) {
  let hp = heroHp;
  const toasts = [], sfx = [], dmgNums = [], removed = [];
  return {
    get: { heroHp: () => hp, maxHp: () => maxHp },
    set: { heroHp: v => { hp = v; } },
    actions: {
      removeMesh: mesh => removed.push(mesh),
      playSfx: (str, vol) => sfx.push({ str, vol }),
      spawnDamageNumber: (u, y, v, text, color) => dmgNums.push({ u, y, v, text, color }),
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
    },
    getHp: () => hp,
    toasts, sfx, dmgNums, removed,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("health_pickup_tick — collection", () => {
  it("pickup within 1.2m → removed from array", () => {
    const pickups = [makePickup("h1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState();
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
  });

  it("collection → heroHp increases by amount (capped at maxHp)", () => {
    const pickups = [makePickup("h1", { u: 0.5, v: 0, amount: 30 })];
    const { get, set, actions, getHp } = makeState({ heroHp: 80, maxHp: 100 });
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getHp()).toBe(100); // 80 + 30 > 100, capped at 100
  });

  it("collection → damage number shows gained HP", () => {
    const pickups = [makePickup("h1", { u: 0.5, v: 0, amount: 15 })];
    const { get, set, actions, dmgNums } = makeState({ heroHp: 80 });
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(dmgNums[0].text).toBe("+15 HP");
  });

  it("collection when hp already near max → gained capped, no toast if gained=0", () => {
    const pickups = [makePickup("h1", { u: 0.5, v: 0, amount: 5 })];
    const { get, set, actions, toasts } = makeState({ heroHp: 100, maxHp: 100 });
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts.length).toBe(0); // gained = 0, no toast
  });

  it("collection → playSfx called", () => {
    const pickups = [makePickup("h1", { u: 0.5, v: 0 })];
    const { get, set, actions, sfx } = makeState();
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBe(1);
    expect(sfx[0].str).toContain("tone:");
  });

  it("pickup beyond 1.2m → not collected", () => {
    const pickups = [makePickup("h1", { u: 5, v: 5 })];
    const { get, set, actions } = makeState();
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(1);
  });
});

describe("health_pickup_tick — animation", () => {
  it("distant pickup → rotates on both axes", () => {
    const p = makePickup("h1", { u: 5, v: 5 });
    const { get, set, actions } = makeState();
    mountHealthPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups: [p] });
    expect(p.mesh.rotation.x).toBeGreaterThan(0);
    expect(p.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("pickup within magnet range → moves toward hero", () => {
    const p = makePickup("h1", { u: 2, v: 0 }); // d=2, within MAGNET_DIST=3
    const origU = p.u;
    const { get, set, actions } = makeState();
    mountHealthPickupTick({ get, set, actions }).tick(0.1, { ...BASE, pickups: [p] });
    expect(p.u).toBeLessThan(origU);
    expect(p.mesh.position.x).toBeCloseTo(p.u);
  });
});

describe("health_pickup_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => makePickup(`h${j}`, { u: (Math.random() - 0.5) * 10, v: (Math.random() - 0.5) * 10, amount: Math.random() * 50 }));
      const { get, set, actions } = makeState({ heroHp: Math.random() * 100, maxHp: 100 });
      expect(() => mountHealthPickupTick({ get, set, actions }).tick(0.016, { heroU: Math.random() * 5, heroV: Math.random() * 5, nowMs: Math.random() * 60000, pickups })).not.toThrow();
    }
  });
});
