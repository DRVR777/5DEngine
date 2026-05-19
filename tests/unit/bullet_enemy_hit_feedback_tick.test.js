import { describe, expect, it, vi } from "vitest";
import { mountBulletEnemyHitFeedbackTick } from "../../src/systems/bullet_enemy_hit_feedback_tick.js";

function makeSet(state = {}) {
  return {
    hudEnemyHpDirty: v => { state.hudDirty = v; },
    shotsHitDelta: v => { state.shotsHit = (state.shotsHit || 0) + v; },
    damageDealtDelta: v => { state.damageDealt = (state.damageDealt || 0) + v; },
    hitMarkerUntil: v => { state.hitMarkerUntil = v; },
    waveChallengeHitsDelta: v => { state.waveChallengeHits = (state.waveChallengeHits || 0) + v; },
  };
}

function makeActions(overrides = {}) {
  return {
    spawnDamageNumber: vi.fn(),
    playSfx: vi.fn(),
    showToast: vi.fn(),
    spawnParticles: vi.fn(),
    emitParticle: vi.fn(),
    spawnFirePatch: vi.fn(),
    ...overrides,
  };
}

function makeSys({ state = {}, actions = makeActions(), hurt = { tone: "hurt", vol: 0.2 } } = {}) {
  const computeHurtSfx = vi.fn(() => hurt);
  return {
    sys: mountBulletEnemyHitFeedbackTick({ computeHurtSfx, set: makeSet(state), actions }),
    state,
    actions,
    computeHurtSfx,
  };
}

function enemy(overrides = {}) {
  return { type: "grunt", hp: 20, maxHp: 100, ...overrides };
}

const EP = { u: 3, v: 4 };
const B = { posU: 2, posV: 4, posY: 1.1 };

describe("mountBulletEnemyHitFeedbackTick", () => {
  it("does not throw with minimal deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10 })).not.toThrow();
  });

  it("marks hp bar time, hit flash, hud dirty, shot count, and damage dealt", () => {
    const en = enemy();
    const { sys, state } = makeSys();
    sys.tick(en, EP, B, { nowMs: 2000, dmg: 12 });
    expect(en._hpBarShowT).toBe(2);
    expect(en._hitFlashT).toBe(0.08);
    expect(state.hudDirty).toBe(true);
    expect(state.shotsHit).toBe(1);
    expect(state.damageDealt).toBe(12);
  });

  it("normal hit marker lasts 120ms", () => {
    const { sys, state } = makeSys();
    sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10 });
    expect(state.hitMarkerUntil).toBe(1120);
  });

  it("headshot hit marker lasts 200ms and increments wave challenge hits", () => {
    const { sys, state, actions } = makeSys();
    sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10, headshot: true });
    expect(state.hitMarkerUntil).toBe(1200);
    expect(state.waveChallengeHits).toBe(1);
    expect(actions.showToast).toHaveBeenCalledWith("HEADSHOT!", "danger", 600);
  });

  it("backstab hit marker lasts 160ms and plays 900Hz tone", () => {
    const { sys, state, actions } = makeSys();
    sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10, backstab: true });
    expect(state.hitMarkerUntil).toBe(1160);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:900:40:sine", 0.22);
  });

  it("frontal block hit marker lasts 80ms and plays block tones", () => {
    const { sys, state, actions } = makeSys();
    sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10, frontalBlock: true });
    expect(state.hitMarkerUntil).toBe(1080);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:220:60:sawtooth", 0.28);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:180:40:square", 0.15);
  });

  it("critical hit marker lasts 180ms and plays 1400Hz tone", () => {
    const { sys, state, actions } = makeSys();
    sys.tick(enemy(), EP, B, { nowMs: 1000, dmg: 10, isCrit: true });
    expect(state.hitMarkerUntil).toBe(1180);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1400:50:sine", 0.18);
  });

  it("applies knockback strength 3.5, kbT 0.1, and normal flinch -0.3", () => {
    const en = enemy();
    const { sys } = makeSys();
    sys.tick(en, EP, B, { nowMs: 1000, dmg: 10 });
    expect(en._kbU).toBeCloseTo(3.5);
    expect(en._kbV).toBeCloseTo(0);
    expect(en._kbT).toBe(0.1);
    expect(en._flinchX).toBe(-0.3);
  });

  it("heavy hit staggers non-boss for 0.6s when damage is 25 percent max HP", () => {
    const en = enemy({ hp: 75, maxHp: 100 });
    const { sys } = makeSys();
    sys.tick(en, EP, B, { nowMs: 1000, dmg: 25 });
    expect(en._staggerT).toBe(0.6);
  });

  it("does not stagger boss on heavy hit", () => {
    const en = enemy({ type: "boss", hp: 75, maxHp: 100 });
    const { sys } = makeSys();
    sys.tick(en, EP, B, { nowMs: 1000, dmg: 25 });
    expect(en._staggerT).toBeUndefined();
  });

  it("hurt grunt is throttled by 0.25s", () => {
    const en = enemy({ _hurtT: 9.8 });
    const { sys, actions, computeHurtSfx } = makeSys();
    sys.tick(en, EP, B, { nowMs: 10000, dmg: 10 });
    expect(computeHurtSfx).not.toHaveBeenCalled();
    expect(actions.playSfx).toHaveBeenCalledWith("blip", 0.2);
  });

  it("incendiary survivor spawns 1.0m fire patch for 2.2s once per second", () => {
    const en = enemy({ type: "incendiary", hp: 5 });
    const { sys, actions } = makeSys();
    sys.tick(en, EP, B, { nowMs: 2000, dmg: 10 });
    expect(actions.spawnFirePatch).toHaveBeenCalledWith(3, 4, 1.0, 2.2);
  });
});
