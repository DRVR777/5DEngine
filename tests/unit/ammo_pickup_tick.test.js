import { it, expect, describe } from "vitest";
import { mountAmmoPickupTick } from "../../src/systems/ammo_pickup_tick.js";

function makeMesh(u = 0, v = 0) {
  return { rotation: { y: 0 }, position: { x: u, y: 0.4, z: v }, _u: u, _v: v };
}

function makePickup(id, { u = 5, v = 5, ammoItem = "pistol_9mm", qty = 12 } = {}) {
  return { id, u, v, ammoItem, qty, mesh: makeMesh(u, v) };
}

function makeActions() {
  const removed = [], added = [], sfx = [], dmgNums = [];
  return {
    actions: {
      removeMesh: mesh => removed.push(mesh),
      addAmmo: (item, qty) => added.push({ item, qty }),
      playSfx: (str, vol) => sfx.push({ str, vol }),
      spawnDamageNumber: (u, y, v, text, color) => dmgNums.push({ u, y, v, text, color }),
    },
    removed, added, sfx, dmgNums,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("ammo_pickup_tick — collection", () => {
  it("pickup within COLLECT_DIST → removed from array", () => {
    const pickups = [makePickup("a1", { u: 0.5, v: 0 })]; // d = 0.5 < 1.2
    const { actions } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
  });

  it("pickup within range → removeMesh called", () => {
    const p = makePickup("a1", { u: 0.5, v: 0 });
    const pickups = [p];
    const { actions, removed } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(removed.length).toBe(1);
    expect(removed[0]).toBe(p.mesh);
  });

  it("pickup collected → addAmmo called with correct item and qty", () => {
    const pickups = [makePickup("a1", { u: 0.5, v: 0, ammoItem: "rifle_556", qty: 30 })];
    const { actions, added } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(added[0]).toEqual({ item: "rifle_556", qty: 30 });
  });

  it("pickup collected → playSfx called", () => {
    const pickups = [makePickup("a1", { u: 0.5, v: 0 })];
    const { actions, sfx } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBe(1);
    expect(sfx[0].str).toBe("blip");
  });

  it("pickup collected → damage number shows quantity and label", () => {
    const pickups = [makePickup("a1", { u: 0.5, v: 0, ammoItem: "pistol_9mm", qty: 12 })];
    const { actions, dmgNums } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(dmgNums[0].text).toBe("+12 9MM");
  });

  it("unknown ammo type → uses 'AMMO' label", () => {
    const pickups = [makePickup("a1", { u: 0.5, v: 0, ammoItem: "mystery_rounds", qty: 5 })];
    const { actions, dmgNums } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(dmgNums[0].text).toContain("AMMO");
  });

  it("pickup beyond COLLECT_DIST → not collected", () => {
    const pickups = [makePickup("a1", { u: 5, v: 5 })]; // d ~= 7 > 1.2
    const { actions } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(1);
  });
});

describe("ammo_pickup_tick — animation", () => {
  it("distant pickup → mesh rotates each frame", () => {
    const p = makePickup("a1", { u: 5, v: 5 });
    const { actions } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups: [p] });
    expect(p.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("distant pickup → mesh bobs (y changes)", () => {
    const p = makePickup("a1", { u: 5, v: 5 });
    const { actions } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups: [p] });
    // y should be close to BOB_BASE but not exactly 0
    expect(p.mesh.position.y).toBeGreaterThan(0);
  });
});

describe("ammo_pickup_tick — magnet", () => {
  it("pickup within magnet range (< 3m) → pulled toward hero", () => {
    const p = makePickup("a1", { u: 2, v: 0 }); // d=2 < 3, > 1.2
    const origU = p.u;
    const { actions } = makeActions();
    mountAmmoPickupTick({ actions }).tick(0.1, { ...BASE, pickups: [p] }); // larger dt to see movement
    expect(p.u).toBeLessThan(origU); // moved toward hero at u=0
    expect(p.mesh.position.x).toBeCloseTo(p.u);
  });

  it("pickup at exact hero position (d=0) — no NaN", () => {
    const p = makePickup("a1", { u: 0, v: 0 }); // d=0 → would collect
    const { actions } = makeActions();
    expect(() => mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups: [p] })).not.toThrow();
  });
});

describe("ammo_pickup_tick — empty / fuzz", () => {
  it("empty pickups → no throw", () => {
    const { actions } = makeActions();
    expect(() => mountAmmoPickupTick({ actions }).tick(0.016, { ...BASE, pickups: [] })).not.toThrow();
  });

  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const count = Math.floor(Math.random() * 5);
      const pickups = Array.from({ length: count }, (_, j) => makePickup(`p${j}`, { u: (Math.random() - 0.5) * 10, v: (Math.random() - 0.5) * 10 }));
      const { actions } = makeActions();
      expect(() => mountAmmoPickupTick({ actions }).tick(0.016, { heroU: Math.random() * 5, heroV: Math.random() * 5, nowMs: Math.random() * 60000, pickups })).not.toThrow();
    }
  });
});
