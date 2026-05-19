import { describe, it, expect, vi } from "vitest";
import { mountEnemyRobotPlasmaTick } from "../../src/systems/enemy_robot_plasma_tick.js";

function makeMesh() { return { position: { set: vi.fn() } }; }
function makeTHREE() {
  const mesh = makeMesh();
  function FakeGeo() {}
  function FakeMat() {}
  function FakeMesh() { return mesh; }
  return { SphereGeometry: FakeGeo, MeshBasicMaterial: FakeMat, Mesh: FakeMesh, _mesh: mesh };
}
function makeScene() { return { add: vi.fn() }; }
function makeActions(overrides = {}) { return { playSfx: vi.fn(), ...overrides }; }
function makeEnemy(overrides = {}) {
  return { type: "robot", id: "r1", _lastShootT: null, ...overrides };
}
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 6, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 0, ...overrides };
}
function makeSys(opts = {}) {
  const THREE = opts.THREE || makeTHREE();
  const scene = opts.scene || makeScene();
  const enemyBullets = opts.enemyBullets || [];
  const actions = opts.actions || makeActions();
  return { sys: mountEnemyRobotPlasmaTick({ THREE, scene, enemyBullets, actions }), THREE, scene, enemyBullets, actions };
}

describe("mountEnemyRobotPlasmaTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-robot enemy", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: distMax=10
  it("does not fire when dist >= 10", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 10 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist = 9 (inside range)", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 9 }));
    expect(actions.playSfx).toHaveBeenCalledWith("tone:600:40:sine", 0.3);
  });

  // Magic number: cooldown=1.5s
  it("does not re-fire within 1.5s cooldown", () => {
    const { sys, actions } = makeSys();
    const en = makeEnemy({ _lastShootT: 8.6 }); // 1.4s elapsed
    sys.tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 1.5s cooldown elapses", () => {
    const { sys, actions } = makeSys();
    const en = makeEnemy({ _lastShootT: 8.5 }); // 1.5s elapsed → exactly at boundary
    sys.tick(0.016, en, makeCtx({ nowSec: 10.01 })); // 1.51s
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("stamps en._lastShootT with nowSec on fire", () => {
    const { sys } = makeSys();
    const en = makeEnemy();
    sys.tick(0.016, en, makeCtx({ nowSec: 77 }));
    expect(en._lastShootT).toBe(77);
  });

  // Magic numbers: speed=14, damage=12, range=12
  it("pushes bullet with speed=14, damage=12, range=12", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(enemyBullets).toHaveLength(1);
    expect(enemyBullets[0].speed).toBe(14);
    expect(enemyBullets[0].damage).toBe(12);
    expect(enemyBullets[0].range).toBe(12);
  });

  // Magic number: yOffset=1.3
  it("bullet starts at ep position with yOffset=1.3", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx({ ep: { u: 3, v: 7, y: 2 } }));
    expect(enemyBullets[0].posU).toBe(3);
    expect(enemyBullets[0].posV).toBe(7);
    expect(enemyBullets[0].posY).toBeCloseTo(3.3); // 2 + 1.3
  });

  it("adds mesh to scene", () => {
    const scene = makeScene();
    const { sys } = makeSys({ scene });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalled();
  });

  // Magic number: pitchNumerator=1.1 (1.2-0.1)
  it("bullet dirY = sin(atan2(1.1, dist))", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 6 }));
    const expectedPitch = Math.atan2(1.1, 6);
    expect(enemyBullets[0].dirY).toBeCloseTo(Math.sin(expectedPitch), 4);
  });
});
