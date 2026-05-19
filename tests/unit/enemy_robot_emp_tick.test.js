import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountEnemyRobotEmpTick } from "../../src/systems/enemy_robot_emp_tick.js";

function makeMesh() { return { rotation: { x: 0 }, position: { set: vi.fn() } }; }

function makeTHREE(mesh) {
  const m = mesh || makeMesh();
  function FakeGeo() {}
  function FakeMat() {}
  function FakeMesh() { return m; }
  return { TorusGeometry: FakeGeo, MeshBasicMaterial: FakeMat, Mesh: FakeMesh, _mesh: m };
}

function makeScene() { return { add: vi.fn() }; }
function makeShockwaves() { return []; }

function makeActions(overrides = {}) {
  return {
    playSfx: vi.fn(),
    setHeroEmpT: vi.fn(),
    showToast: vi.fn(),
    flashDamage: vi.fn(),
    ...overrides,
  };
}

function makeEnemy(overrides = {}) {
  return { type: "robot", _empT: null, ...overrides };
}

function makeCtx(overrides = {}) {
  return {
    canSee: true,
    dist: 6,
    ep: { u: 3, v: 5 },
    nowSec: 10,
    heroDead: false,
    godMode: false,
    ...overrides,
  };
}

function makeSys(threeOverride, actionsOverride) {
  return mountEnemyRobotEmpTick({
    THREE: threeOverride || makeTHREE(),
    scene: makeScene(),
    shockwaves: makeShockwaves(),
    actions: actionsOverride || makeActions(),
  });
}

describe("mountEnemyRobotEmpTick", () => {
  it("does not throw with minimal deps", () => {
    const sys = makeSys();
    expect(() => sys.tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire if enemy type is not robot", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist < 12 fire range
  it("does not fire if dist >= 12 (boundary)", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 12 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 11.99 (just inside range)", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 11.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 8.0s cooldown
  it("does not re-fire within 8.0s cooldown", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy({ _empT: 5.0 }), makeCtx({ nowSec: 12.9 })); // 7.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires again after 8.0s cooldown has elapsed", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy({ _empT: 5.0 }), makeCtx({ nowSec: 13.01 })); // > 8.0s elapsed
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("stamps en._empT with nowSec on fire", () => {
    const sys = makeSys();
    const en = makeEnemy();
    sys.tick(0.016, en, makeCtx({ nowSec: 42 }));
    expect(en._empT).toBe(42);
  });

  it("adds mesh to scene on fire", () => {
    const scene = makeScene();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene, shockwaves: [], actions: makeActions() });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(scene.add).toHaveBeenCalledOnce();
  });

  it("pushes shockwave entry with correct magic numbers (maxR:8, dur:0.7)", () => {
    const shockwaves = [];
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves, actions: makeActions() });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(shockwaves).toHaveLength(1);
    expect(shockwaves[0].maxR).toBe(8);
    expect(shockwaves[0].dur).toBe(0.7);
    expect(shockwaves[0].t).toBe(0);
  });

  it("plays both tone sfx on fire", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx());
    expect(actions.playSfx).toHaveBeenCalledWith("tone:180:200:square", 0.55);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:320:150:square", 0.35);
  });

  // Magic number: dist < 4 hero sprint disable range
  it("disables hero sprint when dist < 4", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 3.99 }));
    expect(actions.setHeroEmpT).toHaveBeenCalledWith(2.5);
    expect(actions.showToast).toHaveBeenCalledWith("EMP! Sprint disabled 2.5s", "danger", 2500);
    expect(actions.flashDamage).toHaveBeenCalledWith(0.35);
  });

  it("does NOT disable sprint when dist >= 4 (boundary)", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 4.0 }));
    expect(actions.setHeroEmpT).not.toHaveBeenCalled();
  });

  it("does NOT disable sprint when heroDead is true", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 2, heroDead: true }));
    expect(actions.setHeroEmpT).not.toHaveBeenCalled();
  });

  it("does NOT disable sprint when godMode is true", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 2, godMode: true }));
    expect(actions.setHeroEmpT).not.toHaveBeenCalled();
  });

  // Magic number: sprint disable duration exactly 2.5s
  it("sets sprint disable duration to exactly 2.5s", () => {
    const actions = makeActions();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(), scene: makeScene(), shockwaves: [], actions });
    sys.tick(0.016, makeEnemy(), makeCtx({ dist: 1 }));
    expect(actions.setHeroEmpT).toHaveBeenCalledWith(2.5);
  });

  // Magic number: ring positioned at 0.12 height
  it("positions the ring mesh at y=0.12", () => {
    const mesh = makeMesh();
    const sys = mountEnemyRobotEmpTick({ THREE: makeTHREE(mesh), scene: makeScene(), shockwaves: [], actions: makeActions() });
    sys.tick(0.016, makeEnemy(), makeCtx({ ep: { u: 3, v: 5 } }));
    expect(mesh.position.set).toHaveBeenCalledWith(3, 0.12, 5);
  });
});
