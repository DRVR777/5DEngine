import { describe, it, expect, vi } from "vitest";
import { mountEnemyBossRockTick } from "../../src/systems/enemy_boss_rock_tick.js";

function makeMesh() { return { position: { set: vi.fn() } }; }
function makeTHREE(meshOverride) {
  const m = meshOverride || makeMesh();
  function FakeGeo() {}
  function FakeMat() { this.clone = () => ({}); }
  function FakeMesh() { return m; }
  return { DodecahedronGeometry: FakeGeo, MeshStandardMaterial: FakeMat, Mesh: FakeMesh, _mesh: m };
}
function makeWarnRingGeo() { return {}; }
function makeWarnRingMat() { return { clone: () => ({}) }; }
function makeScene() { return { add: vi.fn() }; }
function makeGrenades() { return []; }
const GRAVITY = -9.8;

function makeActions(overrides = {}) {
  return { playSfx: vi.fn(), screenShake: vi.fn(), ...overrides };
}
function makeEnemy(overrides = {}) {
  return { type: "boss", _rockT: null, _enraged: false, ...overrides };
}
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 8, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 5, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemyBossRockTick({
    THREE: opts.THREE || makeTHREE(),
    scene: opts.scene || makeScene(),
    warnRingGeo: makeWarnRingGeo(),
    warnRingMat: makeWarnRingMat(),
    grenades: opts.grenades || makeGrenades(),
    GRAVITY,
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyBossRockTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-boss enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "heavy" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist must be >= 5 (lower bound)
  it("does not fire when dist < 5", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 4.99 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is exactly 5 (lower boundary)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 5 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: dist must be < 15 (upper bound)
  it("does not fire when dist >= 15", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 15 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 14.99 (just below upper bound)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 14.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 6.0s cooldown (normal), 3.5s (enraged)
  it("does not re-fire within 6.0s cooldown (normal)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _rockT: 5.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 5.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 6.0s cooldown elapses", () => {
    const actions = makeActions();
    const en = makeEnemy({ _rockT: 4.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // > 6.0s elapsed
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("does not re-fire within 3.5s cooldown (enraged)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _rockT: 7.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.4 })); // 3.4s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 3.5s cooldown when enraged", () => {
    const actions = makeActions();
    const en = makeEnemy({ _rockT: 6.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 9.51 })); // > 3.5s elapsed
    expect(actions.playSfx).toHaveBeenCalledWith("tone:80:200:sawtooth", 0.55);
  });

  it("stamps en._rockT with nowSec on fire", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 77 }));
    expect(en._rockT).toBe(77);
  });

  it("triggers screen shake on fire", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx());
    expect(actions.screenShake).toHaveBeenCalledWith(0.2);
  });

  it("adds rock mesh and warn ring to scene (2 scene.add calls)", () => {
    const scene = makeScene();
    makeSys({ scene }).tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalledTimes(2);
  });

  // Magic number: fuse = tof + 0.5 = 2.3, velY uses tof=1.8
  it("pushes rock into grenades with correct fuse (tof+0.5 = 2.3) and _isBossRock flag", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    expect(grenades).toHaveLength(1);
    expect(grenades[0].fuse).toBeCloseTo(2.3, 5);
    expect(grenades[0]._isBossRock).toBe(true);
  });

  it("velY uses Math.abs(GRAVITY) * tof/2 = 8.82", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx());
    // Magic number: Math.abs(-9.8) * 1.8 / 2 = 8.82
    expect(grenades[0].velY).toBeCloseTo(8.82, 4);
  });

  // Magic number: rock y-offset 2.0 above enemy
  it("rock starts at ep.y + 2.0", () => {
    const grenades = [];
    makeSys({ grenades }).tick(0.016, makeEnemy(), makeCtx({ ep: { u: 0, v: 0, y: 3 } }));
    expect(grenades[0].y).toBeCloseTo(5.0, 5);
  });
});
