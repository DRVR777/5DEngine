import { it, expect, describe } from "vitest";
import { mountWeaponPickupTick } from "../../src/systems/weapon_pickup_tick.js";

function makeMesh(u = 5, v = 5) {
  return { rotation: { y: 0 }, position: { x: u, y: 0.35, z: v } };
}

function makePillar() {
  return { material: { opacity: 0.25 } };
}

function makePickup(id, { u = 5, v = 5, weaponId = "rifle", collected = false, withPillar = false } = {}) {
  return { id, u, v, weaponId, collected, mesh: makeMesh(u, v), pillar: withPillar ? makePillar() : null };
}

const RIFLE_DEF = { id: "rifle", name: "Rifle", magCap: 30, ammoItem: "rifle_556" };

function makeState({ curWeapon = "pistol", curMag = 12, curAmmoItem = "pistol_9mm" } = {}) {
  let weaponId = curWeapon, mag = curMag, switchT = 0;
  const ammo = new Map(), sfx = [], toasts = [], killFeed = [], particles = [], removed = [];
  let reloadCleared = false, meshSwitched = null, selectorShown = false;
  return {
    get: {
      currentWeaponId: () => weaponId,
      currentMag: () => mag,
      currentWeaponAmmoItem: () => curAmmoItem,
    },
    set: {
      currentWeaponId: v => { weaponId = v; },
      currentMag: v => { mag = v; },
      weaponSwitchT: v => { switchT = v; },
    },
    actions: {
      removeMesh: mesh => removed.push(mesh),
      findWeaponDef: id => id === "rifle" ? RIFLE_DEF : null,
      setWeaponAmmo: (id, v) => ammo.set(id, v),
      addReserveAmmo: (item, qty) => ammo.set(item, (ammo.get(item) || 0) + qty),
      countReserveAmmo: item => ammo.get(item) || 0,
      playSfx: (str, vol) => sfx.push({ str, vol }),
      spawnParticles: (u, y, v, n, col) => particles.push({ u, y, v, n, col }),
      clearReload: () => { reloadCleared = true; },
      switchGunMesh: id => { meshSwitched = id; },
      showWeaponSelector: () => { selectorShown = true; },
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
      addKillFeed: (msg, color) => killFeed.push({ msg, color }),
    },
    getWeaponId: () => weaponId,
    getMag: () => mag,
    getSwitchT: () => switchT,
    ammo, sfx, toasts, killFeed, particles, removed,
    reloadCleared: () => reloadCleared,
    meshSwitched: () => meshSwitched,
    selectorShown: () => selectorShown,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("weapon_pickup_tick — collection", () => {
  it("pickup within 1.2m → marked collected", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions } = makeState({ curWeapon: "pistol", curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups[0].collected).toBe(true);
  });

  it("collection → fills weapon ammo to magCap", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, ammo } = makeState({ curWeapon: "pistol", curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(ammo.get("rifle")).toBe(30);
  });

  it("collection → adds 2× magCap reserve ammo", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, ammo } = makeState({ curWeapon: "pistol", curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(ammo.get("rifle_556")).toBe(60);
  });

  it("collection → 2 sfx + particles", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, sfx, particles } = makeState({ curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBeGreaterThanOrEqual(2);
    expect(particles.length).toBe(1);
  });

  it("collection → toast mentions weapon name", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, toasts } = makeState({ curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts[0].msg).toContain("RIFLE");
  });

  it("pickup.collected=true → skipped entirely", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, collected: true })];
    const { get, set, actions, sfx } = makeState();
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx.length).toBe(0);
  });

  it("pickup beyond range → not collected", () => {
    const pickups = [makePickup("w1", { u: 5, v: 5 })];
    const { get, set, actions } = makeState({ curMag: 12 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups[0].collected).toBe(false);
  });
});

describe("weapon_pickup_tick — auto-equip", () => {
  it("dry mag + no reserve → auto-equips picked up weapon", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, getWeaponId } = makeState({ curWeapon: "pistol", curMag: 0, curAmmoItem: "pistol_9mm" });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getWeaponId()).toBe("rifle");
  });

  it("dry mag + no reserve → toast says AUTO-EQUIPPED", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, toasts } = makeState({ curWeapon: "pistol", curMag: 0, curAmmoItem: "pistol_9mm" });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts[0].msg).toContain("AUTO-EQUIPPED");
  });

  it("has ammo → no auto-equip", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, getWeaponId } = makeState({ curWeapon: "pistol", curMag: 8 });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getWeaponId()).toBe("pistol");
  });

  it("auto-equip → switchGunMesh called with new weapon id", () => {
    const pickups = [makePickup("w1", { u: 0.5, v: 0, weaponId: "rifle" })];
    const { get, set, actions, meshSwitched } = makeState({ curWeapon: "pistol", curMag: 0, curAmmoItem: "pistol_9mm" });
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(meshSwitched()).toBe("rifle");
  });
});

describe("weapon_pickup_tick — animation", () => {
  it("uncollected pickup → rotation.y increases", () => {
    const pickup = makePickup("w1", { u: 5, v: 5 });
    const { get, set, actions } = makeState();
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, pickups: [pickup] });
    expect(pickup.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("pickup with pillar → pillar opacity updated", () => {
    const pickup = makePickup("w1", { u: 5, v: 5, withPillar: true });
    const { get, set, actions } = makeState();
    mountWeaponPickupTick({ get, set, actions }).tick(0.016, { ...BASE, nowMs: 0, pickups: [pickup] });
    const expected = 0.25 + 0.15 * Math.sin(0 / 400 + pickup.u);
    expect(pickup.pillar.material.opacity).toBeCloseTo(expected);
  });
});

describe("weapon_pickup_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 4) }, (_, j) =>
        makePickup(`w${j}`, {
          u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10,
          weaponId: Math.random() < 0.5 ? "rifle" : "unknown",
          collected: Math.random() < 0.3,
        })
      );
      const { get, set, actions } = makeState({ curMag: Math.floor(Math.random() * 15) });
      expect(() =>
        mountWeaponPickupTick({ get, set, actions }).tick(0.016, {
          heroU: Math.random()*5, heroV: Math.random()*5, nowMs: Math.random()*60000, pickups,
        })
      ).not.toThrow();
    }
  });
});
