import { describe, it, expect, vi } from "vitest";
import { mountEnemyStrafeMeleeTick } from "../../src/systems/enemy_strafe_melee_tick.js";

const ARMOR_ABSORB = 0.5;

function makeActions(overrides = {}) {
  return {
    playSfx: vi.fn(), flashDamage: vi.fn(), screenShake: vi.fn(),
    setHeroHp: vi.fn(), setHeroArmor: vi.fn(), setHeroLastDamageT: vi.fn(),
    setDmgDir: vi.fn(), setHeroKb: vi.fn(), setHeroFireT: vi.fn(),
    emitHeroDied: vi.fn(), onHeroDeath: vi.fn(),
    ...overrides,
  };
}
function makeEnemy(overrides = {}) {
  return {
    type: "grunt", id: "g1", damage: 20, moveSpeed: 3.0,
    _strafeSwitchT: null, _strafeDir: 1, _strafeDur: null, lastAttackT: 0,
    ...overrides,
  };
}
function makeCtx(overrides = {}) {
  return { nowSec: 10, nowMs: 10000, ep: { u: 0, v: 0, y: 0, x: 0 }, heroU: 5, heroV: 0, heroHp: 100, heroArmor: 0, godMode: false, ...overrides };
}
function makeSys(opts = {}) {
  return mountEnemyStrafeMeleeTick({
    ARMOR_ABSORB,
    getHeroPos: opts.getHeroPos || (() => ({ u: 5, v: 0 })),
    getEnemyPos: opts.getEnemyPos || (() => ({ u: 0, v: 0 })),
    resolveMove: opts.resolveMove || vi.fn(),
    setEnemyPos: opts.setEnemyPos || vi.fn(),
    applyStatusEffect: opts.applyStatusEffect || vi.fn(),
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyStrafeMeleeTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("stamps en.lastAttackT with nowSec on every call", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 42 }));
    expect(en.lastAttackT).toBe(42);
  });

  // Magic numbers: sfxRobot=220, sfxHeavy=70, sfxDefault=120
  it("plays robot sfx (220Hz) for robot type", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "robot" }), makeCtx());
    expect(actions.playSfx).toHaveBeenCalledWith("tone:220:90:sawtooth", 0.18);
  });

  it("plays heavy sfx (70Hz) for heavy type", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "heavy" }), makeCtx());
    expect(actions.playSfx).toHaveBeenCalledWith("tone:70:90:sawtooth", 0.18);
  });

  it("plays default sfx (120Hz) for grunt type", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).toHaveBeenCalledWith("tone:120:90:sawtooth", 0.18);
  });

  it("reduces heroHp by enemy damage", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 25 }), makeCtx({ heroHp: 100, heroArmor: 0 }));
    expect(actions.setHeroHp).toHaveBeenCalledWith(75);
  });

  it("applies ARMOR_ABSORB when heroArmor > 0", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 20 }), makeCtx({ heroHp: 100, heroArmor: 10 }));
    // a = min(10, 20*0.5) = 10 → enDmg = 10 → heroHp = 90
    expect(actions.setHeroHp).toHaveBeenCalledWith(90);
    expect(actions.setHeroArmor).toHaveBeenCalledWith(0);
  });

  it("does NOT apply damage in godMode", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ godMode: true }));
    expect(actions.setHeroHp).not.toHaveBeenCalled();
  });

  it("calls flashDamage and screenShake on hit", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 20 }), makeCtx());
    expect(actions.flashDamage).toHaveBeenCalled();
    // 20/55 = 0.364 > 0.35 cap → actual shake = 0.35
    expect(actions.screenShake).toHaveBeenCalledWith(0.35);
  });

  // Magic number: shakeMax=0.35, shakeDiv=55
  it("caps screenShake at 0.35 for high damage", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 100 }), makeCtx());
    expect(actions.screenShake).toHaveBeenCalledWith(0.35);
  });

  it("calls onHeroDeath and emitHeroDied when heroHp reaches 0", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 150 }), makeCtx({ heroHp: 50, heroArmor: 0 }));
    expect(actions.onHeroDeath).toHaveBeenCalled();
    expect(actions.emitHeroDied).toHaveBeenCalledWith("g1");
  });

  it("does NOT call onHeroDeath when hero survives", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ damage: 10 }), makeCtx({ heroHp: 100 }));
    expect(actions.onHeroDeath).not.toHaveBeenCalled();
  });

  // Magic numbers: poisonChance=0.55, burnChance=0.45
  it("applies poison status for poisoner (random forced below 0.55)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    const applyStatusEffect = vi.fn();
    makeSys({ applyStatusEffect }).tick(0.016, makeEnemy({ type: "poisoner" }), makeCtx());
    expect(applyStatusEffect).toHaveBeenCalledWith("poison");
    vi.restoreAllMocks();
  });

  it("applies burning status for incendiary (random forced below 0.45)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    const applyStatusEffect = vi.fn();
    makeSys({ applyStatusEffect }).tick(0.016, makeEnemy({ type: "incendiary" }), makeCtx());
    expect(applyStatusEffect).toHaveBeenCalledWith("burning");
    vi.restoreAllMocks();
  });

  // Magic number: heroFireDur=3.0
  it("sets heroFireT=3.0 for incendiary", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "incendiary" }), makeCtx());
    expect(actions.setHeroFireT).toHaveBeenCalledWith(3.0);
  });

  // Magic numbers: kbBoss=14, kbHeavy=9, kbT=0.22
  it("applies knockback for boss (speed=14, t=0.22)", () => {
    const actions = makeActions();
    const getEnemyPos = () => ({ u: 0, v: 0 });
    const getHeroPos  = () => ({ u: 3, v: 4 }); // dist=5, dirU=0.6, dirV=0.8
    makeSys({ actions, getHeroPos, getEnemyPos }).tick(0.016, makeEnemy({ type: "boss" }), makeCtx({ heroHp: 100 }));
    expect(actions.setHeroKb).toHaveBeenCalledWith(
      expect.closeTo(0.6 * 14, 1), expect.closeTo(0.8 * 14, 1), 0.22
    );
  });

  it("applies knockback for heavy (speed=9, t=0.22)", () => {
    const actions = makeActions();
    const getEnemyPos = () => ({ u: 0, v: 0 });
    const getHeroPos  = () => ({ u: 3, v: 4 });
    makeSys({ actions, getHeroPos, getEnemyPos }).tick(0.016, makeEnemy({ type: "heavy" }), makeCtx({ heroHp: 100 }));
    expect(actions.setHeroKb).toHaveBeenCalledWith(
      expect.closeTo(0.6 * 9, 1), expect.closeTo(0.8 * 9, 1), 0.22
    );
  });

  it("calls resolveMove for strafe-eligible types (grunt)", () => {
    const resolveMove = vi.fn();
    makeSys({ resolveMove }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(resolveMove).toHaveBeenCalled();
  });

  it("does NOT call resolveMove for non-strafe types (boss)", () => {
    const resolveMove = vi.fn();
    makeSys({ resolveMove }).tick(0.016, makeEnemy({ type: "boss" }), makeCtx());
    expect(resolveMove).not.toHaveBeenCalled();
  });

  // Magic number: defaultDur=1.5s
  it("switches strafe direction after _strafeDur cooldown elapses", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.0); // always pick dir=-1... wait dir = 1-1=0? no
    // random < 0.5 → dir = -1 when random=0.0
    const en = makeEnemy({ _strafeSwitchT: 8.0, _strafeDur: 1.5 }); // 2s elapsed > 1.5
    makeSys().tick(0.016, en, makeCtx({ nowSec: 10 }));
    expect(en._strafeSwitchT).toBe(10);
    vi.restoreAllMocks();
  });
});
