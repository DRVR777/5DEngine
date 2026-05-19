import { describe, it, expect, vi } from "vitest";
import { mountEnemyPoisonerRangedSpitTick } from "../../src/systems/enemy_poisoner_ranged_spit_tick.js";

function makeMesh() {
  return { position: { set: vi.fn() } };
}
function makeTHREE() {
  const mesh = makeMesh();
  function FakeGeo() {}
  function FakeMat() {}
  function FakeMesh(g, m) { return mesh; }
  return { SphereGeometry: FakeGeo, MeshBasicMaterial: FakeMat, Mesh: FakeMesh, _mesh: mesh };
}
function makeScene() { return { add: vi.fn() }; }
function makeActions(overrides = {}) {
  return { playSfx: vi.fn(), ...overrides };
}
function makeEnemy(overrides = {}) {
  return { type: "poisoner", id: "p1", _spitT: null, _spitInterval: null, ...overrides };
}
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 6, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, heroU: 5, heroV: 0, ...overrides };
}
function makeSys(opts = {}) {
  const THREE = opts.THREE || makeTHREE();
  const scene = opts.scene || makeScene();
  const enemyBullets = opts.enemyBullets || [];
  const actions = opts.actions || makeActions();
  return { sys: mountEnemyPoisonerRangedSpitTick({ THREE, scene, enemyBullets, actions }), THREE, scene, enemyBullets, actions };
}

describe("mountEnemyPoisonerRangedSpitTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-poisoner", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist > 3.5
  it("does not fire when dist <= 3.5", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 3.5 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist < 10
  it("does not fire when dist >= 10", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 10 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 4 (inside range)", () => {
    const { sys, actions } = makeSys();
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 4 }));
    expect(actions.playSfx).toHaveBeenCalledWith("tone:200:70:sawtooth", 0.22);
  });

  // Magic number: default interval 3.5s
  it("does not re-fire within _spitInterval cooldown", () => {
    const { sys, actions } = makeSys();
    const en = makeEnemy({ _spitT: 7.0, _spitInterval: 3.5 });
    sys.tick(0.016, en, makeCtx({ nowSec: 10.4 })); // 3.4s elapsed < 3.5
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after cooldown elapses", () => {
    const { sys, actions } = makeSys();
    const en = makeEnemy({ _spitT: 6.5, _spitInterval: 3.5 });
    sys.tick(0.016, en, makeCtx({ nowSec: 10.01 })); // 3.51s elapsed > 3.5
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("stamps en._spitT with nowSec on fire", () => {
    const { sys } = makeSys();
    const en = makeEnemy();
    sys.tick(0.016, en, makeCtx({ nowSec: 42 }));
    expect(en._spitT).toBe(42);
  });

  // Magic numbers: intervalBase=3.0, intervalRange=1.5
  it("sets _spitInterval to 3.0 + random*1.5 on fire", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { sys } = makeSys();
    const en = makeEnemy();
    sys.tick(0.016, en, makeCtx());
    expect(en._spitInterval).toBeCloseTo(3.0 + 0.5 * 1.5);
    vi.restoreAllMocks();
  });

  // Magic numbers: damage=4, range=11, poisonOnHit=true
  it("pushes bullet with damage=4, range=11, poisonOnHit=true", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(enemyBullets).toHaveLength(1);
    expect(enemyBullets[0].damage).toBe(4);
    expect(enemyBullets[0].range).toBe(11);
    expect(enemyBullets[0].poisonOnHit).toBe(true);
  });

  it("pushes bullet starting at ep position with yOffset=1.1", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx({ ep: { u: 3, v: 7, y: 2 } }));
    expect(enemyBullets[0].posU).toBe(3);
    expect(enemyBullets[0].posV).toBe(7);
    expect(enemyBullets[0].posY).toBe(3.1); // y+1.1 = 2+1.1
  });

  // Magic number: dirY=0.18
  it("bullet has dirY=0.18", () => {
    const enemyBullets = [];
    const { sys } = makeSys({ enemyBullets });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(enemyBullets[0].dirY).toBe(0.18);
  });

  it("adds mesh to scene", () => {
    const scene = makeScene();
    const { sys } = makeSys({ scene });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalled();
  });
});
