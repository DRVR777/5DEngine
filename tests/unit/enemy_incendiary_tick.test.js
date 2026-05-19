import { describe, it, expect, vi } from "vitest";
import { mountEnemyIncendiaryTick } from "../../src/systems/enemy_incendiary_tick.js";

function makeMesh() { return { position: { set: vi.fn() } }; }
function makeTHREE(meshOverride) {
  const m = meshOverride || makeMesh();
  function FakeGeo() {}
  function FakeMat() {}
  function FakeMesh() { return m; }
  return { SphereGeometry: FakeGeo, MeshStandardMaterial: FakeMat, MeshBasicMaterial: FakeMat, Mesh: FakeMesh, _mesh: m };
}
function makeScene() { return { add: vi.fn() }; }
function makeGrenades() { return []; }
const GRAVITY = -9.8;

function makeActions(overrides = {}) { return { playSfx: vi.fn(), ...overrides }; }
function makeEnemy(overrides = {}) { return { type: "incendiary", _fireT: null, ...overrides }; }
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 7, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 5, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemyIncendiaryTick({
    THREE: opts.THREE || makeTHREE(),
    scene: opts.scene || makeScene(),
    warnRingGeo: {},
    grenades: opts.grenades || makeGrenades(),
    GRAVITY,
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyIncendiaryTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-incendiary enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist must be > 4 (lower bound)
  it("does not fire when dist <= 4", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 4 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 4.01 (just above lower bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 4.01 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: dist must be < 12 (upper bound)
  it("does not fire when dist >= 12", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 12 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 11.99 (just below upper bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 11.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 5.0s cooldown
  it("does not re-fire within 5.0s cooldown", () => {
    const actions = makeActions();
    const en = makeEnemy({ _fireT: 6.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 4.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 5.0s cooldown elapses", () => {
    const actions = makeActions();
    const en = makeEnemy({ _fireT: 5.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // > 5.0s elapsed
    expect(actions.playSfx).toHaveBeenCalledWith("tone:400:60:sawtooth", 0.3);
  });

  it("stamps en._fireT with nowSec on fire", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 88 }));
    expect(en._fireT).toBe(88);
  });

  it("adds fireball and warn ring to scene (2 scene.add calls)", () => {
    const scene = makeScene();
    makeSys({ scene }).tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  // Magic number: fuse = tof + 0.3 = 1.7, _isFireball flag
  it("pushes fireball with correct fuse (tof+0.3=1.7) and _isFireball flag", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    expect(grenades).toHaveLength(1);
    expect(grenades[0].fuse).toBeCloseTo(1.7, 5);
    expect(grenades[0]._isFireball).toBe(true);
  });

  it("velY uses Math.abs(GRAVITY)*tof/2 with tof=1.4 → 6.86", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    // Magic number: Math.abs(-9.8) * 1.4 / 2 = 6.86
    expect(grenades[0].velY).toBeCloseTo(6.86, 4);
  });

  // Magic number: fireball y-offset 1.2 above enemy
  it("fireball starts at ep.y + 1.2", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx({ ep: { u: 0, v: 0, y: 2 } }));
    expect(grenades[0].y).toBeCloseTo(3.2, 5);
  });
});
