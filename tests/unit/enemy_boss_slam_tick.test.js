import { describe, it, expect, vi } from "vitest";
import { mountEnemyBossSlamTick } from "../../src/systems/enemy_boss_slam_tick.js";

const ARMOR_ABSORB = 0.5;

function makeActions(overrides = {}) {
  return {
    playSfx: vi.fn(), screenShake: vi.fn(),
    spawnParticles: vi.fn(), spawnShockwave: vi.fn(),
    flashDamage: vi.fn(), onHeroDeath: vi.fn(),
    setHeroHp: vi.fn(), setHeroArmor: vi.fn(), setHeroLastDamageT: vi.fn(),
    ...overrides,
  };
}
function makeEnemy(overrides = {}) {
  return { type: "boss", id: "boss1", _slamT: null, _enraged: false, ...overrides };
}
function makeCtx(overrides = {}) {
  return {
    canSee: true, dist: 2,
    ep: { u: 0, v: 0, y: 0 },
    nowSec: 10, dodgeT: 0, heroDead: false, godMode: false,
    heroHp: 100, heroArmor: 0,
    ...overrides,
  };
}
function makeSys(opts = {}) {
  return mountEnemyBossSlamTick({
    ARMOR_ABSORB,
    getHeroPos: opts.getHeroPos || (() => ({ u: 0.5, v: 0.5 })),
    getEnemyPos: opts.getEnemyPos || (() => ({ u: 99, v: 99 })),
    enemies: opts.enemies || [],
    actions: opts.actions || makeActions(),
  });
}

describe("mountEnemyBossSlamTick", () => {
  it("does not throw with minimal deps", () => {
    expect(() => makeSys().tick(0.016, makeEnemy(), makeCtx())).not.toThrow();
  });

  it("does not fire for non-boss enemy", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy({ type: "grunt" }), makeCtx());
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("does not fire if canSee is false", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ canSee: false }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  // Magic number: dist < 4 (trigger range)
  it("does not fire when dist >= 4", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 4 }));
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires when dist is 3.99 (just inside range)", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx({ dist: 3.99 }));
    expect(actions.playSfx).toHaveBeenCalled();
  });

  // Magic number: 5.0s cooldown (normal), 2.8s (enraged)
  it("does not re-fire within 5.0s cooldown (normal)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _slamT: 6.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.9 })); // 4.9s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 5.0s cooldown elapses", () => {
    const actions = makeActions();
    const en = makeEnemy({ _slamT: 5.0 });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.01 })); // > 5.0s elapsed
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("does not re-fire within 2.8s cooldown (enraged)", () => {
    const actions = makeActions();
    const en = makeEnemy({ _slamT: 8.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 10.7 })); // 2.7s elapsed
    expect(actions.playSfx).not.toHaveBeenCalled();
  });

  it("fires after 2.8s cooldown when enraged", () => {
    const actions = makeActions();
    const en = makeEnemy({ _slamT: 7.0, _enraged: true });
    makeSys({ actions }).tick(0.016, en, makeCtx({ nowSec: 9.81 })); // > 2.8s elapsed
    expect(actions.playSfx).toHaveBeenCalled();
  });

  it("stamps en._slamT with nowSec on fire", () => {
    const en = makeEnemy();
    makeSys().tick(0.016, en, makeCtx({ nowSec: 99 }));
    expect(en._slamT).toBe(99);
  });

  it("fires VFX: shockwave, particles (x2), screen shake", () => {
    const actions = makeActions();
    makeSys({ actions }).tick(0.016, makeEnemy(), makeCtx());
    expect(actions.spawnShockwave).toHaveBeenCalledWith(0, 0);
    expect(actions.spawnParticles).toHaveBeenCalledTimes(2);
    expect(actions.screenShake).toHaveBeenCalledWith(0.6);
  });

  // Magic number: slamRadius=5, damage applies when hero within 5m
  it("does NOT damage hero beyond slamRadius=5", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 5.1, v: 0 }) }).tick(0.016, makeEnemy(), makeCtx());
    expect(actions.setHeroHp).not.toHaveBeenCalled();
  });

  it("damages hero within slamRadius=5", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 0, v: 0 }) }).tick(0.016, makeEnemy(), makeCtx({ heroHp: 100, heroArmor: 0 }));
    // hero at ep (0,0) → shd=0 → hd2 = round(50*(1-0/5)) = 50
    expect(actions.setHeroHp).toHaveBeenCalledWith(50);
  });

  it("does NOT damage hero if dodging (dodgeT > 0)", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 0, v: 0 }) }).tick(0.016, makeEnemy(), makeCtx({ dodgeT: 0.1 }));
    expect(actions.setHeroHp).not.toHaveBeenCalled();
  });

  it("does NOT damage hero in godMode", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 0, v: 0 }) }).tick(0.016, makeEnemy(), makeCtx({ godMode: true }));
    expect(actions.setHeroHp).not.toHaveBeenCalled();
  });

  // Magic number: ARMOR_ABSORB=0.5, friendlyFireDmg=30, friendlyFireRadius=5*0.6=3
  it("applies armor absorption (ARMOR_ABSORB=0.5) to slam damage", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 0, v: 0 }) })
      .tick(0.016, makeEnemy(), makeCtx({ heroHp: 100, heroArmor: 10 }));
    // hd2=50, armor absorbs min(10, 50*0.5)=10 → sdmg=40, heroHp=60
    expect(actions.setHeroHp).toHaveBeenCalledWith(60);
    expect(actions.setHeroArmor).toHaveBeenCalledWith(0);
  });

  it("calls onHeroDeath when heroHp drops to 0", () => {
    const actions = makeActions();
    makeSys({ actions, getHeroPos: () => ({ u: 0, v: 0 }) })
      .tick(0.016, makeEnemy(), makeCtx({ heroHp: 30, heroArmor: 0 }));
    // hd2=50, sdmg=50, heroHp=30-50<0 → death
    expect(actions.onHeroDeath).toHaveBeenCalled();
  });

  it("deals friendly fire to nearby enemies within slamRadius*0.6=3", () => {
    const nearbyEnemy = { id: "grunt1", dead: false, hp: 100 };
    const actions = makeActions();
    const sys = mountEnemyBossSlamTick({
      ARMOR_ABSORB, actions,
      getHeroPos: () => ({ u: 99, v: 99 }), // far away, no hero damage
      getEnemyPos: id => id === "grunt1" ? { u: 2, v: 0 } : { u: 99, v: 99 },
      enemies: [nearbyEnemy],
    });
    sys.tick(0.016, makeEnemy(), makeCtx({ heroHp: 100 }));
    // grunt1 at dist=2 < 3 → takes 30 dmg
    expect(nearbyEnemy.hp).toBe(70);
  });

  it("does NOT deal friendly fire to boss itself", () => {
    const bossEnemy = { id: "boss1", dead: false, hp: 100 };
    makeSys({ enemies: [bossEnemy], getHeroPos: () => ({ u: 99, v: 99 }) })
      .tick(0.016, makeEnemy({ id: "boss1" }), makeCtx());
    expect(bossEnemy.hp).toBe(100);
  });
});
