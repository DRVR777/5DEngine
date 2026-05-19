import { it, expect, describe } from "vitest";
import { mountArmorVestTick } from "../../src/systems/armor_vest_tick.js";

function makeMesh() {
  return { visible: true, rotation: { y: 0 }, position: { y: 0.3 } };
}

function makeVest(id, { u = 5, v = 5, active = true, respawnT = 0 } = {}) {
  return { id, u, v, active, respawnT, mesh: makeMesh() };
}

function makeState({ heroArmor = 50, maxArmor = 100 } = {}) {
  let armor = heroArmor;
  const sfx = [], toasts = [];
  return {
    get: { heroArmor: () => armor, maxArmor: () => maxArmor },
    set: { heroArmor: v => { armor = v; } },
    actions: {
      playSfx: (str, vol) => sfx.push({ str, vol }),
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
    },
    getArmor: () => armor,
    sfx, toasts,
  };
}

const BASE = { heroU: 0, heroV: 0, nowSec: 100, nowMs: 100000 };

describe("armor_vest_tick — collection", () => {
  it("vest within 1.3m with armor room → active becomes false", () => {
    const pickups = [makeVest("v1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState({ heroArmor: 50 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups[0].active).toBe(false);
  });

  it("collection → heroArmor increases by 25 (capped at maxArmor)", () => {
    const pickups = [makeVest("v1", { u: 0.5, v: 0 })];
    const { get, set, actions, getArmor } = makeState({ heroArmor: 90, maxArmor: 100 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(getArmor()).toBe(100);
  });

  it("collection → showToast shows gained amount", () => {
    const pickups = [makeVest("v1", { u: 0.5, v: 0 })];
    const { get, set, actions, toasts } = makeState({ heroArmor: 50, maxArmor: 100 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(toasts[0].msg).toBe("+25 armor");
  });

  it("collection when armor full → not collected", () => {
    const pickups = [makeVest("v1", { u: 0.5, v: 0 })];
    const { get, set, actions, sfx } = makeState({ heroArmor: 100, maxArmor: 100 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups[0].active).toBe(true);
    expect(sfx.length).toBe(0);
  });

  it("vest beyond range → not collected", () => {
    const pickups = [makeVest("v1", { u: 5, v: 5 })];
    const { get, set, actions } = makeState({ heroArmor: 50 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups[0].active).toBe(true);
  });

  it("collection → respawnT set to nowSec", () => {
    const pickups = [makeVest("v1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState({ heroArmor: 50 });
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 77, pickups });
    expect(pickups[0].respawnT).toBe(77);
  });
});

describe("armor_vest_tick — respawn", () => {
  it("inactive vest → mesh hidden", () => {
    const vest = makeVest("v1", { active: false, respawnT: 100 });
    const { get, set, actions } = makeState();
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 100, pickups: [vest] });
    expect(vest.mesh.visible).toBe(false);
  });

  it("inactive after 60s → reactivated", () => {
    const vest = makeVest("v1", { active: false, respawnT: 10 });
    const { get, set, actions } = makeState();
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 71, pickups: [vest] });
    expect(vest.active).toBe(true);
    expect(vest.mesh.visible).toBe(true);
  });

  it("inactive, 59s elapsed → still inactive", () => {
    const vest = makeVest("v1", { active: false, respawnT: 10 });
    const { get, set, actions } = makeState();
    mountArmorVestTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 69, pickups: [vest] });
    expect(vest.active).toBe(false);
  });
});

describe("armor_vest_tick — animation", () => {
  it("active vest beyond range → rotation.y increases", () => {
    const vest = makeVest("v1", { u: 5, v: 5 });
    const { get, set, actions } = makeState();
    mountArmorVestTick({ get, set, actions }).tick(0.1, { ...BASE, pickups: [vest] });
    expect(vest.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("active vest → position.y bobs", () => {
    const vest = makeVest("v1", { u: 0, v: 5 });
    const { get, set, actions } = makeState();
    mountArmorVestTick({ get, set, actions }).tick(0.016, { heroU: 0, heroV: 0, nowSec: 0, nowMs: 0, pickups: [vest] });
    const expected = 0.3 + Math.sin(0 / 500 + 0) * 0.08;
    expect(vest.mesh.position.y).toBeCloseTo(expected);
  });
});

describe("armor_vest_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 4) }, (_, j) =>
        makeVest(`v${j}`, {
          u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10,
          active: Math.random() < 0.7, respawnT: Math.random() * 200,
        })
      );
      const { get, set, actions } = makeState({ heroArmor: Math.random() * 100, maxArmor: 100 });
      expect(() =>
        mountArmorVestTick({ get, set, actions }).tick(0.016, {
          heroU: Math.random()*5, heroV: Math.random()*5,
          nowSec: Math.random()*200, nowMs: Math.random()*200000, pickups,
        })
      ).not.toThrow();
    }
  });
});
