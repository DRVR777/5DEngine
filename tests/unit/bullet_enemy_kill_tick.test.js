import { describe, expect, it, vi } from "vitest";
import { mountBulletEnemyKillTick } from "../../src/systems/bullet_enemy_kill_tick.js";

function makeState(overrides = {}) {
  const s = {
    bulletTimeLeft: 0, enemyKills: 0, heroLevel: 0, heroApexMode: false,
    stamina: 10, staminaMax: 100, heroExtraStaminaMax: 0, heroArmor: 0,
    heroMaxArmor: 100, score: 0, lastKillT: -99, streakWindow: 4,
    streakCount: 0, comboCount: 0, heroHp: 100, heroMaxHp: 100,
    heroDead: false, vignetteAmt: 0, liveBoss: {},
    killMarkerUntil: 0, killMarkerHs: false, comboLastT: 0,
    ...overrides,
  };
  return s;
}

function makeAccess(s) {
  const get = Object.fromEntries(Object.keys(s).map(k => [k, () => s[k]]));
  const set = Object.fromEntries(Object.keys(s).map(k => [k, v => { s[k] = v; }]));
  return { get, set };
}

function makeActions(overrides = {}) {
  return {
    playSfx: vi.fn(),
    spawnDecal: vi.fn(),
    spawnFirePatch: vi.fn(),
    spawnPoisonPuddle: vi.fn(),
    applyLevelUpBuff: vi.fn(),
    showToast: vi.fn(),
    addKillFeedEntry: vi.fn(),
    spawnDamageNumber: vi.fn(),
    trackKillAndPanic: vi.fn(),
    emitEnemyKilled: vi.fn(),
    completeQuestStep: vi.fn(),
    getWaveState: vi.fn(() => null),
    spawnAmmoPickup: vi.fn(),
    spawnHealthPickup: vi.fn(),
    spawnCoinDrop: vi.fn(),
    spawnWeaponPickup: vi.fn(),
    spawnParticles: vi.fn(),
    emitParticle: vi.fn(),
    applyScreenShake: vi.fn(),
    spawnArmorShard: vi.fn(),
    ...overrides,
  };
}

function makeSys({ state = makeState(), enemies = [], actions = makeActions() } = {}) {
  const access = makeAccess(state);
  return {
    sys: mountBulletEnemyKillTick({
      enemies,
      coinByType: { grunt: 1, heavy: 4, robot: 8, boss: 30, sniper: 3 },
      weaponDropMap: { robot: "laser" },
      levelThresholds: [1, 10, 20, 30, 40],
      get: access.get,
      set: access.set,
      actions,
    }),
    state,
    actions,
  };
}

function enemy(overrides = {}) {
  return { id: "e1", type: "grunt", hp: 0, dead: false, dropQty: 12, maxHp: 100, ...overrides };
}

const EP = { u: 2, v: 3 };

describe("mountBulletEnemyKillTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(enemy(), EP, { nowMs: 1000, headshot: false })).not.toThrow();
  });

  it("marks enemy dead, clamps hp to 0, and stamps respawn time", () => {
    const en = enemy({ hp: -5 });
    const { sys } = makeSys();
    sys.tick(en, EP, { nowMs: 2500, headshot: false });
    expect(en.hp).toBe(0);
    expect(en.dead).toBe(true);
    expect(en.respawnT).toBe(2.5);
  });

  it("headshot sets 0.22s minimum bullet time and kill marker for now+300", () => {
    const { sys, state } = makeSys();
    sys.tick(enemy(), EP, { nowMs: 1000, headshot: true });
    expect(state.bulletTimeLeft).toBe(0.22);
    expect(state.killMarkerUntil).toBe(1300);
    expect(state.killMarkerHs).toBe(true);
  });

  it("increments enemyKills and comboCount", () => {
    const { sys, state } = makeSys();
    sys.tick(enemy(), EP, { nowMs: 1000, headshot: false });
    expect(state.enemyKills).toBe(1);
    expect(state.comboCount).toBe(1);
  });

  it("level-up threshold calls applyLevelUpBuff with next level", () => {
    const { sys, state, actions } = makeSys({ state: makeState({ enemyKills: 0, heroLevel: 0 }) });
    sys.tick(enemy(), EP, { nowMs: 1000, headshot: false });
    expect(state.heroLevel).toBe(1);
    expect(actions.applyLevelUpBuff).toHaveBeenCalledWith(1);
  });

  it("apex mode restores exactly 5 stamina up to stamina max plus extra", () => {
    const { sys, state } = makeSys({ state: makeState({ heroApexMode: true, stamina: 98, staminaMax: 100, heroExtraStaminaMax: 2 }) });
    sys.tick(enemy(), EP, { nowMs: 1000, headshot: false });
    expect(state.stamina).toBe(102);
  });

  it("elite kill grants 15 score and 20 armor capped by max armor", () => {
    const { sys, state } = makeSys({ state: makeState({ score: 4, heroArmor: 90, heroMaxArmor: 100 }) });
    sys.tick(enemy({ _elite: true }), EP, { nowMs: 1000, headshot: false });
    expect(state.score).toBe(19);
    expect(state.heroArmor).toBe(100);
  });

  it("low HP lifesteal restores exactly 8 HP up to max", () => {
    const { sys, state, actions } = makeSys({ state: makeState({ heroHp: 35, heroMaxHp: 100 }) });
    sys.tick(enemy(), EP, { nowMs: 1000, headshot: false });
    expect(state.heroHp).toBe(43);
    expect(actions.spawnDamageNumber).toHaveBeenCalledWith(2, 2.2, 3, "+8 HP", "#00ff88");
  });

  it("robot death uses oil decal, weapon drop, 0.4 bullet-time, and 0.6 screen shake", () => {
    const { sys, state, actions } = makeSys();
    sys.tick(enemy({ type: "robot" }), EP, { nowMs: 1000, headshot: false });
    expect(actions.spawnDecal).toHaveBeenCalledWith(2, 3, "oil");
    expect(actions.spawnWeaponPickup).toHaveBeenCalledWith(2.5, 3.5, "laser");
    expect(state.bulletTimeLeft).toBe(0.4);
    expect(actions.applyScreenShake).toHaveBeenCalledWith(0.6);
  });

  it("boss death clears liveBoss, grants 50 score bonus, and 0.6 bullet-time", () => {
    const { sys, state, actions } = makeSys({ state: makeState({ score: 10 }) });
    sys.tick(enemy({ type: "boss" }), EP, { nowMs: 1000, headshot: false });
    expect(state.liveBoss).toBe(null);
    expect(state.score).toBe(60);
    expect(state.bulletTimeLeft).toBe(0.6);
    expect(actions.spawnArmorShard).toHaveBeenCalledWith(2, 3, 40);
  });

  it("last spawned enemy in active wave sets 0.55 bullet-time", () => {
    const enemies = [enemy({ id: "en_spawned_1", dead: false })];
    const actions = makeActions({ getWaveState: vi.fn(() => ({ phase: "spawning" })) });
    const { sys, state } = makeSys({ enemies, actions });
    sys.tick(enemies[0], EP, { nowMs: 1000, headshot: false });
    expect(state.bulletTimeLeft).toBe(0.55);
  });
});
