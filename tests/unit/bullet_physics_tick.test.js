import { describe, expect, it, vi } from "vitest";
import { mountBulletPhysicsTick } from "../../src/systems/bullet_physics_tick.js";

function bullet(overrides = {}) {
  return {
    posU: 0, posV: 0, posY: 1.0,
    dirU: 1, dirV: 0, dirY: 0,
    speed: 20, traveled: 0, range: 30,
    damage: 10, weaponId: "pistol",
    mesh: { position: { set: vi.fn() } },
    ...overrides,
  };
}

function enemy(overrides = {}) {
  return { id: "e1", type: "grunt", hp: 50, maxHp: 100, dead: false, ...overrides };
}

function makeActions() {
  return { removeMesh: vi.fn(), spawnDamageNumber: vi.fn(), playSfx: vi.fn() };
}

function makeSys({
  bullets = [],
  enemies = [],
  playerPositions = new Map(),
  dmgResult = { dmg: 10, headshot: false, backstab: false, frontalBlock: false, isCrit: false },
  hitFeedbackTick = { tick: vi.fn() },
  killTick = { tick: vi.fn() },
  worldHitResult = { remove: false, reason: null },
  worldHitTick = { tick: vi.fn(() => worldHitResult) },
  state = { pistolCooldown: 0 },
  actions = makeActions(),
} = {}) {
  const sys = mountBulletPhysicsTick({
    bullets3D: bullets,
    enemies,
    getPlayerPos: id => playerPositions.get(id) || null,
    computeBulletDamage: vi.fn(() => dmgResult),
    hitFeedbackTick,
    killTick,
    worldHitTick,
    get: {
      pistolCooldown: () => state.pistolCooldown,
      dmgMul: () => 1,
      lvlDmgMul: () => 1,
      perkDmgMul: () => 1,
    },
    set: {
      pistolCooldown: v => { state.pistolCooldown = v; },
    },
    actions,
  });
  return { sys, bullets, enemies, playerPositions, actions, state, hitFeedbackTick, killTick, worldHitTick };
}

describe("mountBulletPhysicsTick", () => {
  it("does not throw with empty deps", () => {
    const { sys } = makeSys();
    expect(() => sys.tick(0.016, { nowMs: 1000 })).not.toThrow();
  });

  it("decrements pistolCooldown and clamps to 0", () => {
    const { sys, state } = makeSys({ state: { pistolCooldown: 0.1 } });
    sys.tick(0.016, { nowMs: 1000 });
    expect(state.pistolCooldown).toBeCloseTo(0.084);
    sys.tick(1.0, { nowMs: 1016 });
    expect(state.pistolCooldown).toBe(0);
  });

  it("advances bullet position by speed*dt across all 5 substeps", () => {
    const b = bullet({ speed: 10, dirU: 1, dirV: 0 });
    const { sys, bullets } = makeSys({ bullets: [b] });
    sys.tick(0.1, { nowMs: 1000 });
    // speed 10 * dt 0.1 = 1.0 total advance in U; worldHit returns remove:false so bullet stays
    expect(b.posU).toBeCloseTo(1.0);
  });

  it("removes bullet and calls removeMesh when worldHit.remove is true", () => {
    const b = bullet({ speed: 0 });
    const actions = makeActions();
    const { sys, bullets } = makeSys({
      bullets: [b],
      worldHitTick: { tick: vi.fn(() => ({ remove: true, reason: "blocker" })) },
      actions,
    });
    sys.tick(0.016, { nowMs: 1000 });
    expect(bullets.length).toBe(0);
    expect(actions.removeMesh).toHaveBeenCalledWith(b.mesh);
  });

  it("calls hitFeedbackTick and deducts hp on enemy within 0.6m", () => {
    const en = enemy({ hp: 50 });
    const b = bullet({ posU: 0, posV: 0, speed: 0 });
    const pos = new Map([["e1", { u: 0.3, v: 0 }]]);
    const hitFeedbackTick = { tick: vi.fn() };
    const { sys } = makeSys({
      bullets: [b], enemies: [en], playerPositions: pos, hitFeedbackTick,
      dmgResult: { dmg: 10, headshot: false, backstab: false, frontalBlock: false, isCrit: false },
    });
    sys.tick(0.016, { nowMs: 1000 });
    expect(en.hp).toBe(40);
    expect(hitFeedbackTick.tick).toHaveBeenCalled();
  });

  it("calls killTick and removes bullet when enemy hp drops to 0", () => {
    const en = enemy({ hp: 10 });
    const b = bullet({ posU: 0, posV: 0, speed: 0 });
    const pos = new Map([["e1", { u: 0.3, v: 0 }]]);
    const killTick = { tick: vi.fn() };
    const actions = makeActions();
    const { sys, bullets } = makeSys({
      bullets: [b], enemies: [en], playerPositions: pos, killTick, actions,
      dmgResult: { dmg: 10, headshot: false, backstab: false, frontalBlock: false, isCrit: false },
    });
    sys.tick(0.016, { nowMs: 1000 });
    expect(en.hp).toBe(0);
    expect(killTick.tick).toHaveBeenCalled();
    expect(bullets.length).toBe(0);
    expect(actions.removeMesh).toHaveBeenCalled();
  });

  it("sniper first hit sets _pierced and spawns PIERCE number", () => {
    // Speed=0 so bullet re-hits on substep 2 and is consumed — the key behavior
    // being tested is the PIERCE path fires first (before hitEnemy), not that the
    // bullet survives all 5 substeps in a frozen position.
    const en = enemy({ hp: 50 });
    const b = bullet({ posU: 0, posV: 0, speed: 0, weaponId: "sniper" });
    const pos = new Map([["e1", { u: 0.3, v: 0 }]]);
    const actions = makeActions();
    const { sys } = makeSys({
      bullets: [b], enemies: [en], playerPositions: pos, actions,
      dmgResult: { dmg: 10, headshot: false, backstab: false, frontalBlock: false, isCrit: false },
    });
    sys.tick(0.016, { nowMs: 1000 });
    expect(b._pierced).toBe(true);
    expect(actions.spawnDamageNumber).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), expect.any(Number), "PIERCE!", "#00eeff"
    );
    expect(actions.playSfx).toHaveBeenCalledWith("tone:2200:30:sine", 0.18);
  });

  it("sniper second hit consumes bullet", () => {
    const en = enemy({ hp: 50 });
    const b = bullet({ posU: 0, posV: 0, speed: 0, weaponId: "sniper", _pierced: true });
    const pos = new Map([["e1", { u: 0.3, v: 0 }]]);
    const actions = makeActions();
    const { sys, bullets } = makeSys({
      bullets: [b], enemies: [en], playerPositions: pos, actions,
      dmgResult: { dmg: 10, headshot: false, backstab: false, frontalBlock: false, isCrit: false },
    });
    sys.tick(0.016, { nowMs: 1000 });
    expect(bullets.length).toBe(0);
  });
});
