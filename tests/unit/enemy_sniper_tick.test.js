import { describe, it, expect, vi } from "vitest";
import { mountEnemySniperTick } from "../../src/systems/enemy_sniper_tick.js";

function makeGeo() {
  const geo = { attributes: { position: { array: new Float32Array(6), needsUpdate: false } } };
  geo.setFromPoints = () => geo;
  return geo;
}
function makeMesh() { return { position: { set: vi.fn() } }; }
function makeTHREE() {
  const geo = makeGeo();
  const mesh = makeMesh();
  function FakeVector3(x, y, z) { this.x = x; this.y = y; this.z = z; }
  function FakeBufferGeometry() { Object.assign(this, makeGeo()); this.setFromPoints = () => this; }
  function FakeLineBasicMat() { this.opacity = 0.7; }
  function FakeLine(g, m) { this.geometry = g; this.material = m; this.visible = false; this.renderOrder = 0; }
  function FakeBoxGeo() {}
  function FakeMeshBasicMat() {}
  function FakeMeshCtor() { return mesh; }
  return {
    Vector3: FakeVector3, BufferGeometry: FakeBufferGeometry,
    LineBasicMaterial: FakeLineBasicMat, Line: FakeLine,
    BoxGeometry: FakeBoxGeo, MeshBasicMaterial: FakeMeshBasicMat, Mesh: FakeMeshCtor,
    _mesh: mesh,
  };
}
function makeScene() { return { add: vi.fn() }; }
function makeActions(overrides = {}) {
  return { playSfx: vi.fn(), screenShake: vi.fn(), alertShot: vi.fn(), ...overrides };
}
function makeEnemy(overrides = {}) {
  return {
    type: "sniper", id: "s1", moveSpeed: 3.0, damage: 35,
    _sniperPhaseT: null, _sniperShotT: null, _sniperLockSnd: false,
    _laserLine: null, _meshChildren: [],
    ...overrides,
  };
}
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 14, ep: { u: 0, v: 0, y: 0, x: 0 }, nowMs: 10000, nowSec: 10, heroU: 10, heroV: 0, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemySniperTick({
    THREE: opts.THREE || makeTHREE(),
    scene: opts.scene || makeScene(),
    enemyBullets: opts.enemyBullets || [],
    resolveMove: opts.resolveMove || vi.fn(),
    getEnemyPos: opts.getEnemyPos || (() => ({ x: 0, u: 0, v: 0 })),
    setEnemyPos: opts.setEnemyPos || vi.fn(),
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemySniperTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-sniper enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: backoffDist=9
  it("calls resolveMove when dist < 9 to back off", () => {
    const resolveMove = vi.fn();
    makeSys({ resolveMove }).tick(0.016, makeEnemy(), makeCtx({ dist: 8 }));
    expect(resolveMove).toHaveBeenCalled();
  });

  it("does NOT call resolveMove when dist >= 9", () => {
    const resolveMove = vi.fn();
    makeSys({ resolveMove }).tick(0.016, makeEnemy(), makeCtx({ dist: 9 }));
    expect(resolveMove).not.toHaveBeenCalled();
  });

  it("initializes _sniperPhaseT to nowSec if not set", () => {
    const en = makeEnemy({ _sniperPhaseT: null });
    makeSys().tick(0.016, en, makeCtx({ nowSec: 55 }));
    expect(en._sniperPhaseT).toBe(55);
  });

  // Magic number: lockPhase=2.8
  it("is not in lock-on when snPhase < 2.8", () => {
    const actions = makeActions();
    const en = makeEnemy({ _sniperPhaseT: 9.0 }); // phase = 10-9 = 1.0
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._sniperLockSnd).toBe(false);
  });

  it("sets lock sound flag when snPhase >= 2.8", () => {
    const actions = makeActions();
    const en = makeEnemy({ _sniperPhaseT: 7.1, _sniperLockSnd: false }); // phase = 2.9
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._sniperLockSnd).toBe(true);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1800:40:sine", 0.2);
  });

  it("clears _sniperLockSnd when not in lock-on", () => {
    const en = makeEnemy({ _sniperPhaseT: 9.0, _sniperLockSnd: true }); // phase = 1.0
    makeSys().tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._sniperLockSnd).toBe(false);
  });

  it("creates laser line and adds to scene on first tick", () => {
    const scene = makeScene();
    const en = makeEnemy({ _laserLine: null });
    makeSys({ scene }).tick(0.016, en, makeCtx());
    expect(scene.add).toHaveBeenCalled();
    expect(en._laserLine).toBeTruthy();
  });

  it("sets laser visible=true during lock-on", () => {
    const en = makeEnemy({ _sniperPhaseT: 7.1 }); // phase=2.9 → lock-on
    makeSys().tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._laserLine.visible).toBe(true);
  });

  it("sets laser visible=false when not in lock-on", () => {
    const en = makeEnemy({ _sniperPhaseT: 9.0 }); // phase=1.0 → no lock
    makeSys().tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._laserLine.visible).toBe(false);
  });

  // Magic number: firePhase=3.95, speed=30, range=25
  it("fires bullet when snPhase >= 3.95", () => {
    const enemyBullets = [];
    const en = makeEnemy({ _sniperPhaseT: 6.04 }); // phase = 10-6.04 = 3.96 >= 3.95
    makeSys({ enemyBullets }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(enemyBullets).toHaveLength(1);
    expect(enemyBullets[0].speed).toBe(30);
    expect(enemyBullets[0].range).toBe(25);
  });

  it("does not fire when snPhase < 3.95", () => {
    const enemyBullets = [];
    const en = makeEnemy({ _sniperPhaseT: 7.5 }); // phase = 2.5
    makeSys({ enemyBullets }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(enemyBullets).toHaveLength(0);
  });

  // Magic number: shotCooldown=3.5
  it("does not fire within 3.5s shot cooldown", () => {
    const enemyBullets = [];
    const en = makeEnemy({ _sniperPhaseT: 6.04, _sniperShotT: 7.0 }); // phase=3.96 but shotT=7.0, only 3s ago
    makeSys({ enemyBullets }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(enemyBullets).toHaveLength(0);
  });

  it("fires after shot cooldown elapses", () => {
    const enemyBullets = [];
    const en = makeEnemy({ _sniperPhaseT: 6.04, _sniperShotT: 6.0 }); // 4s ago > 3.5
    makeSys({ enemyBullets }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(enemyBullets).toHaveLength(1);
  });

  it("stamps _sniperShotT and resets _sniperPhaseT on fire", () => {
    const en = makeEnemy({ _sniperPhaseT: 6.04 });
    makeSys().tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._sniperShotT).toBe(10);
    expect(en._sniperPhaseT).toBe(10);
  });

  // Magic number: alertDist=22
  it("calls alertShot when dist < 22 on fire", () => {
    const actions = makeActions();
    const en = makeEnemy({ _sniperPhaseT: 6.04 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10, dist: 15 }));
    expect(actions.alertShot).toHaveBeenCalled();
  });

  it("does not call alertShot when dist >= 22", () => {
    const actions = makeActions();
    const en = makeEnemy({ _sniperPhaseT: 6.04 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10, dist: 22 }));
    expect(actions.alertShot).not.toHaveBeenCalled();
  });

  it("calls screenShake(0.15) on fire", () => {
    const actions = makeActions();
    const en = makeEnemy({ _sniperPhaseT: 6.04 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(actions.screenShake).toHaveBeenCalledWith(0.15);
  });
});
