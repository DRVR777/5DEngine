import { describe, it, expect, vi } from "vitest";
import { mountEnemyPoisonerSpitTick } from "../../src/systems/enemy_poisoner_spit_tick.js";

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
function makeEnemy(overrides = {}) { return { type: "poisoner", _acidT: null, ...overrides }; }
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 6, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 5, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemyPoisonerSpitTick({
    THREE: opts.THREE || makeTHREE(),
    scene: opts.scene || makeScene(),
    warnRingGeo: {},
    grenades: opts.grenades || makeGrenades(),
    GRAVITY,
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyPoisonerSpitTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-poisoner enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist must be > 3 (lower bound)
  it("does not fire when dist <= 3", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 3.01 (just above lower bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3.01 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: dist must be < 10 (upper bound)
  it("does not fire when dist >= 10", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 10 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 9.99 (just below upper bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 9.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 4.0s cooldown
  it("does not re-fire within 4.0s cooldown", () => {
    const actions = makeActions();
    const en = makeEnemy({ _acidT: 7.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 3.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 4.0s cooldown elapses", () => {
    const actions = makeActions();
    const en = makeEnemy({ _acidT: 6.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // > 4.0s elapsed
    expect(actions.playSfx).toHaveBeenCalledWith("tone:600:50:sine", 0.22);
  });

  it("stamps en._acidT with nowSec on fire", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 33 }));
    expect(en._acidT).toBe(33);
  });

  it("adds acid mesh and warn ring to scene (2 scene.add calls)", () => {
    const scene = makeScene();
    makeSys({ scene }).tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  // Magic number: fuse = tof + 0.25 = 1.35, _isAcidSpit flag
  it("pushes acid spit with correct fuse (tof+0.25=1.35) and _isAcidSpit flag", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    expect(grenades).toHaveLength(1);
    expect(grenades[0].fuse).toBeCloseTo(1.35, 5);
    expect(grenades[0]._isAcidSpit).toBe(true);
  });

  it("velY uses Math.abs(GRAVITY)*tof/2 with tof=1.1 → 5.39", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    // Magic number: Math.abs(-9.8) * 1.1 / 2 = 5.39
    expect(grenades[0].velY).toBeCloseTo(5.39, 4);
  });

  // Magic number: acid spit y-offset 1.2 above enemy
  it("acid spit starts at ep.y + 1.2", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx({ ep: { u: 0, v: 0, y: 1 } }));
    expect(grenades[0].y).toBeCloseTo(2.2, 5);
  });
});
