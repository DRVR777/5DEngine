import { describe, it, expect, vi } from "vitest";
import { mountEnemyFastChargeTick } from "../../src/systems/enemy_fast_charge_tick.js";

function makeActions(overrides = {}) {
  return { playSfx: vi.fn(), spawnParticles: vi.fn(), ...overrides };
}
function makeEnemy(overrides = {}) {
  return { type: "fast", id: "f1", moveSpeed: 4.0, _chargeCD: null, _chargeDur: 0, _chargeInterval: null, ...overrides };
}
function makeCtx(overrides = {}) {
  return { canSee: true, dist: 5, ep: { u: 0, v: 0, y: 0 }, nowSec: 10, dx: 3, dz: 4, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemyFastChargeTick({
    getEnemyPos: opts.getEnemyPos || (() => ({ x: 0, u: 0, v: 0 })),
    resolveMove: opts.resolveMove || vi.fn(),
    setEnemyPos: opts.setEnemyPos || vi.fn(),
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyFastChargeTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-fast enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not trigger when canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist > 2.0
  it("does not trigger when dist <= 2.0", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 2.0 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist < 8
  it("does not trigger when dist >= 8", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 8 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("triggers when dist=3 (inside range)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3 }));
    expect(actions.playSfx).toHaveBeenCalledWith("tone:760:40:square", 0.18);
  });

  // Magic number: default interval 4.0s
  it("does not re-trigger within _chargeInterval cooldown", () => {
    const actions = makeActions();
    const en = makeEnemy({ _chargeCD: 7.0, _chargeInterval: 4.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 3.9s < 4.0
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("triggers after cooldown elapses", () => {
    const actions = makeActions();
    const en = makeEnemy({ _chargeCD: 6.0, _chargeInterval: 4.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // 4.01s > 4.0
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("stamps en._chargeCD with nowSec on trigger", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 77 }));
    expect(en._chargeCD).toBe(77);
  });

  // Magic numbers: intervalBase=3.5, intervalRange=2.0
  it("sets _chargeInterval to 3.5 + random*2.0 on trigger", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx());
    expect(en._chargeInterval).toBeCloseTo(3.5 + 0.5 * 2.0);
    vi.restoreAllMocks();
  });

  // Magic number: chargeDur=0.38
  it("sets _chargeDur=0.38 on trigger", () => {
    const en = makeEnemy();
    makeSys().tick(0, en, makeCtx()); // dt=0 so update decrement doesn't obscure the set value
    expect(en._chargeDur).toBeCloseTo(0.38);
  });

  it("normalizes charge direction from dx/dz", () => {
    const en = makeEnemy();
    // dx=3, dz=4 → dist=5 → dirU=3/5=0.6, dirV=4/5=0.8
    makeSys().tick(0.016, en, makeCtx({ dist: 5, dx: 3, dz: 4 }));
    expect(en._chargeDirU).toBeCloseTo(0.6);
    expect(en._chargeDirV).toBeCloseTo(0.8);
  });

  it("spawns particles at ep on trigger", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ ep: { u: 3, v: 7, y: 1 } }));
    expect(actions.spawnParticles).toHaveBeenCalledWith(3, 1.5, 7, 6, "orange", 6, 0.14);
  });

  // Magic number: chargeSpeedMul=2.2, hitbox {w:0.7, d:0.7}
  it("calls resolveMove at 2.2x moveSpeed when _chargeDur > 0", () => {
    const resolveMove = vi.fn();
    const en = makeEnemy({ _chargeDur: 0.3, _chargeDirU: 1, _chargeDirV: 0, moveSpeed: 4.0 });
    makeSys({ resolveMove }).tick(0.016, en, makeCtx({ canSee: false })); // no new trigger
    expect(resolveMove).toHaveBeenCalledWith(
      expect.objectContaining({ hitbox: { w: 0.7, d: 0.7 } }),
      expect.closeTo(1 * 4.0 * 2.2 * 0.016, 5),
      expect.closeTo(0 * 4.0 * 2.2 * 0.016, 5),
    );
  });

  it("decrements _chargeDur by dt on update", () => {
    const en = makeEnemy({ _chargeDur: 0.3 });
    makeSys().tick(0.016, en, makeCtx({ canSee: false }));
    expect(en._chargeDur).toBeCloseTo(0.284);
  });

  it("calls setEnemyPos with updated mover position", () => {
    const setEnemyPos = vi.fn();
    const resolveMove = vi.fn((mover) => { mover.u += 0.1; mover.v += 0.05; });
    const getEnemyPos = () => ({ x: 2, u: 5, v: 3 });
    const en = makeEnemy({ _chargeDur: 0.3, _chargeDirU: 1, _chargeDirV: 0, moveSpeed: 4.0 });
    makeSys({ getEnemyPos, resolveMove, setEnemyPos }).tick(0.016, en, makeCtx({ canSee: false }));
    expect(setEnemyPos).toHaveBeenCalledWith("f1", 2, 0, 0, expect.closeTo(5.1, 2), expect.closeTo(3.05, 2));
  });
});
