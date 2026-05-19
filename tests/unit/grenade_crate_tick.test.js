import { it, expect, describe } from "vitest";
import { mountGrenadeCrateTick } from "../../src/systems/grenade_crate_tick.js";

function makeMesh() {
  return { visible: true, rotation: { y: 0 }, position: { y: 0.2 } };
}

function makeCrate(id, { u = 5, v = 5, active = true, respawnT = 0 } = {}) {
  return { id, u, v, active, respawnT, mesh: makeMesh() };
}

function makeState({ grenadeCount = 3 } = {}) {
  let count = grenadeCount;
  const sfx = [], toasts = [];
  return {
    get: { grenadeCount: () => count },
    set: { grenadeCount: v => { count = v; } },
    actions: {
      playSfx: (str, vol) => sfx.push({ str, vol }),
      showToast: (msg, type, dur) => toasts.push({ msg, type, dur }),
    },
    getCount: () => count,
    sfx, toasts,
  };
}

const BASE = { heroU: 0, heroV: 0, nowSec: 100, nowMs: 100000 };

describe("grenade_crate_tick — collection", () => {
  it("crate within 1.3m → active becomes false", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(crates[0].active).toBe(false);
  });

  it("collection → grenadeCount increases by 3", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions, getCount } = makeState({ grenadeCount: 3 });
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(getCount()).toBe(6);
  });

  it("collection → grenadeCount capped at 9", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions, getCount } = makeState({ grenadeCount: 8 });
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(getCount()).toBe(9);
  });

  it("collection → respawnT set to nowSec", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 42, crates });
    expect(crates[0].respawnT).toBe(42);
  });

  it("collection → showToast mentions grenades", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions, toasts } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(toasts[0].msg).toContain("grenades");
  });

  it("collection → playSfx called", () => {
    const crates = [makeCrate("g1", { u: 0.5, v: 0 })];
    const { get, set, actions, sfx } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(sfx.length).toBe(1);
    expect(sfx[0].str).toContain("tone:");
  });

  it("crate beyond range → not collected", () => {
    const crates = [makeCrate("g1", { u: 5, v: 5 })];
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, crates });
    expect(crates[0].active).toBe(true);
  });
});

describe("grenade_crate_tick — respawn", () => {
  it("inactive crate → mesh hidden", () => {
    const crate = makeCrate("g1", { u: 0.5, v: 0, active: false, respawnT: 100 });
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 100, crates: [crate] });
    expect(crate.mesh.visible).toBe(false);
  });

  it("inactive after 30s → reactivated", () => {
    const crate = makeCrate("g1", { u: 0.5, v: 0, active: false, respawnT: 50 });
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 81, crates: [crate] });
    expect(crate.active).toBe(true);
    expect(crate.mesh.visible).toBe(true);
  });

  it("inactive, 29s elapsed → still inactive", () => {
    const crate = makeCrate("g1", { u: 0.5, v: 0, active: false, respawnT: 50 });
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { ...BASE, nowSec: 79, crates: [crate] });
    expect(crate.active).toBe(false);
  });
});

describe("grenade_crate_tick — animation", () => {
  it("active crate beyond range → rotation.y increases", () => {
    const crate = makeCrate("g1", { u: 5, v: 5 });
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.1, { ...BASE, crates: [crate] });
    expect(crate.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("active crate beyond range → position.y bobs", () => {
    const crate = makeCrate("g1", { u: 0, v: 5 });
    const { get, set, actions } = makeState();
    mountGrenadeCrateTick({ get, set, actions }).tick(0.016, { heroU: 0, heroV: 0, nowSec: 0, nowMs: 0, crates: [crate] });
    const expected = 0.2 + Math.sin(0 / 700 + 0) * 0.04;
    expect(crate.mesh.position.y).toBeCloseTo(expected);
  });
});

describe("grenade_crate_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const crates = Array.from({ length: Math.floor(Math.random() * 4) }, (_, j) =>
        makeCrate(`g${j}`, {
          u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10,
          active: Math.random() < 0.7,
          respawnT: Math.random() * 200,
        })
      );
      const { get, set, actions } = makeState({ grenadeCount: Math.floor(Math.random() * 10) });
      expect(() =>
        mountGrenadeCrateTick({ get, set, actions }).tick(0.016, {
          heroU: Math.random()*5, heroV: Math.random()*5,
          nowSec: Math.random()*200, nowMs: Math.random()*200000, crates,
        })
      ).not.toThrow();
    }
  });
});
