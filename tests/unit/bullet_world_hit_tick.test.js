import { describe, expect, it, vi } from "vitest";
import { mountBulletWorldHitTick } from "../../src/systems/bullet_world_hit_tick.js";

function bullet(overrides = {}) {
  return { posU: 0, posV: 0, posY: 0.5, damage: 10, traveled: 0, range: 30, ...overrides };
}

function makeActions(overrides = {}) {
  return {
    spawnParticles: vi.fn(),
    spawnDamageNumber: vi.fn(),
    playSfx: vi.fn(),
    explodeBarrel: vi.fn(),
    breakCrate: vi.fn(),
    spawnWallScorch: vi.fn(),
    ...overrides,
  };
}

function makeSys({ mp = null, barrels = [], crates = [], buildingBlockers = [], actions = makeActions() } = {}) {
  return {
    sys: mountBulletWorldHitTick({ getMp: () => mp, barrels, crates, buildingBlockers, actions }),
    actions,
    barrels,
    crates,
    buildingBlockers,
  };
}

describe("mountBulletWorldHitTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(bullet())).not.toThrow();
  });

  it("returns remove=false when nothing is hit and bullet is in range", () => {
    const { sys } = makeSys();
    expect(sys.tick(bullet())).toEqual({ remove: false, reason: null });
  });

  it("hits peer inside 0.6m radius and 0.9m torso height", () => {
    const hitPeer = vi.fn();
    const mp = { enabled: true, peers: new Map([["p1", { lastPos: { u: 0.5, v: 0, y: -0.4 } }]]), hitPeer };
    const { sys } = makeSys({ mp });
    expect(sys.tick(bullet({ posY: 0.5 }))).toEqual({ remove: true, reason: "peer" });
    expect(hitPeer).toHaveBeenCalledWith("p1", 10, false);
  });

  it("does not hit peer outside 0.6m radius", () => {
    const hitPeer = vi.fn();
    const mp = { enabled: true, peers: new Map([["p1", { lastPos: { u: 0.61, v: 0, y: -0.4 } }]]), hitPeer };
    const { sys } = makeSys({ mp });
    expect(sys.tick(bullet()).remove).toBe(false);
    expect(hitPeer).not.toHaveBeenCalled();
  });

  it("peer headshot threshold is posY > 1.6 and doubles damage", () => {
    const hitPeer = vi.fn();
    const mp = { enabled: true, peers: new Map([["p1", { lastPos: { u: 0, v: 0, y: 1 } }]]), hitPeer };
    const { sys } = makeSys({ mp });
    sys.tick(bullet({ posY: 1.7, damage: 12 }));
    expect(hitPeer).toHaveBeenCalledWith("p1", 24, true);
  });

  it("damages barrel inside 0.18 radius and below y 0.95", () => {
    const bar = { u: 0.2, v: 0, hp: 20, exploded: false, mesh: { visible: true } };
    const { sys, actions } = makeSys({ barrels: [bar] });
    expect(sys.tick(bullet({ damage: 7 }))).toEqual({ remove: true, reason: "barrel" });
    expect(bar.hp).toBe(13);
    expect(actions.explodeBarrel).not.toHaveBeenCalled();
  });

  it("explodes barrel at hp <= 0", () => {
    const bar = { u: 0.2, v: 0, hp: 5, exploded: false, mesh: { visible: true } };
    const { sys, actions } = makeSys({ barrels: [bar] });
    sys.tick(bullet({ damage: 5 }));
    expect(bar.exploded).toBe(true);
    expect(bar.mesh.visible).toBe(false);
    expect(actions.explodeBarrel).toHaveBeenCalledWith(0.2, 0);
  });

  it("does not hit barrel at y >= 0.95", () => {
    const bar = { u: 0, v: 0, hp: 20, exploded: false, mesh: { visible: true } };
    const { sys } = makeSys({ barrels: [bar] });
    expect(sys.tick(bullet({ posY: 0.95 })).remove).toBe(false);
  });

  it("damages crate inside 0.25 radius and below y 0.95", () => {
    const cr = { u: 0.2, v: 0, hp: 20, broken: false };
    const { sys, actions } = makeSys({ crates: [cr] });
    expect(sys.tick(bullet({ damage: 6 }))).toEqual({ remove: true, reason: "crate" });
    expect(cr.hp).toBe(14);
    expect(actions.breakCrate).not.toHaveBeenCalled();
  });

  it("breaks crate at hp <= 0", () => {
    const cr = { u: 0, v: 0, hp: 4, broken: false };
    const { sys, actions } = makeSys({ crates: [cr] });
    sys.tick(bullet({ damage: 5 }));
    expect(actions.breakCrate).toHaveBeenCalledWith(cr);
  });

  it("hits building blocker within half extents and y height", () => {
    const bl = { u: 0, v: 0, hitbox: { w: 2, d: 2, h: 2 } };
    const { sys, actions } = makeSys({ buildingBlockers: [bl] });
    expect(sys.tick(bullet({ posU: 0.9, posV: 0, posY: 1 }))).toEqual({ remove: true, reason: "blocker" });
    expect(actions.spawnWallScorch).toHaveBeenCalled();
  });

  it("removes bullet when traveled reaches range", () => {
    const { sys } = makeSys();
    expect(sys.tick(bullet({ traveled: 30, range: 30 }))).toEqual({ remove: true, reason: "range" });
  });
});
