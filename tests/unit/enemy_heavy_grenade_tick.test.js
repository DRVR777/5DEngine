import { describe, it, expect, vi } from "vitest";
import { mountEnemyHeavyGrenadeTick } from "../../src/systems/enemy_heavy_grenade_tick.js";

function makeMesh() { return { position: { set: vi.fn() } }; }

function makeTHREE(meshOverride) {
  const m = meshOverride || makeMesh();
  function FakeGeo() {}
  function FakeMat() { this.clone = () => ({}); }
  function FakeMesh() { return m; }
  return { SphereGeometry: FakeGeo, MeshStandardMaterial: FakeMat, Mesh: FakeMesh, _mesh: m };
}

function makeWarnRingGeo() { return {}; }
function makeWarnRingMat() { return { clone: () => ({}) }; }
function makeScene() { return { add: vi.fn() }; }
function makeGrenades() { return []; }
const GRAVITY = -9.8;

function makeActions(overrides = {}) {
  return { playSfx: vi.fn(), ...overrides };
}

function makeEnemy(overrides = {}) {
  return { type: "heavy", _grenadeT: null, _enraged: false, ...overrides };
}

function makeCtx(overrides = {}) {
  return { canSee: true, dist: 6, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 5, ...overrides };
}

function makeSys(opts = {}) {
  return mountEnemyHeavyGrenadeTick({
    THREE: opts.THREE || makeTHREE(),
    scene: opts.scene || makeScene(),
    warnRingGeo: makeWarnRingGeo(),
    warnRingMat: makeWarnRingMat(),
    grenades: opts.grenades || makeGrenades(),
    GRAVITY,
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyHeavyGrenadeTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-heavy enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist must be > 3.5 (lower bound)
  it("does not fire when dist <= 3.5 (too close)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3.5 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 3.51 (just above lower bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3.51 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: dist must be < 12 (upper bound)
  it("does not fire when dist >= 12 (upper bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 12 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 11.99 (just below upper bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 11.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 4.0s cooldown (normal), 2.5s (enraged)
  it("does not re-fire within 4.0s cooldown (normal)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _grenadeT: 7.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 3.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 4.0s cooldown elapses (normal)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _grenadeT: 6.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // > 4.0s elapsed
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("does not re-fire within 2.5s cooldown (enraged)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _grenadeT: 8.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.4 })); // 2.4s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 2.5s cooldown when enraged", () => {
    const actions = makeActions();
    const en = makeEnemy({ _grenadeT: 7.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 9.51 })); // > 2.5s elapsed
    expect(actions.playSfx).toHaveBeenCalledWith("tone:150:80:triangle", 0.22);
  });

  it("stamps en._grenadeT with nowSec on fire", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 55 }));
    expect(en._grenadeT).toBe(55);
  });

  it("adds grenade and warn ring to scene (2 scene.add calls)", () => {
    const scene = makeScene();
    makeSys({ scene }).tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  it("pushes grenade into grenades array with correct fuse (tof+0.3 = 1.8)", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    expect(grenades).toHaveLength(1);
    // Magic number: tof=1.5, fuse = tof + 0.3 = 1.8
    expect(grenades[0].fuse).toBeCloseTo(1.8, 5);
  });

  it("velY uses Math.abs(GRAVITY) * tof/2 = 7.35", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    // Magic number: Math.abs(-9.8) * 1.5 / 2 = 7.35
    expect(grenades[0].velY).toBeCloseTo(7.35, 4);
  });

  // Magic number: grenade y-offset 1.2 above enemy
  it("grenade starts at ep.y + 1.2", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx({ ep: { u: 0, v: 0, y: 2 } }));
    expect(grenades[0].y).toBeCloseTo(3.2, 5);
  });
});
