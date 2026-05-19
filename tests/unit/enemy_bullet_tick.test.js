import { it, expect, describe, beforeEach } from "vitest";
import { mountEnemyBulletTick } from "../../src/systems/enemy_bullet_tick.js";

function makeBullet({ u = 0, v = 0, y = 1.0, dirU = 1, dirV = 0, dirY = 0, speed = 20, range = 50, damage = 10, poisonOnHit = false } = {}) {
  return {
    posU: u, posV: v, posY: y,
    dirU, dirV, dirY,
    speed, range, damage, poisonOnHit,
    traveled: 0,
    mesh: { position: { x: 0, y: 0, z: 0, set(x, _y, z) { this.x = x; this.y = _y; this.z = z; } } },
  };
}

function makeState({ heroPos = { u: 0, v: 0, y: 0 }, heroHp = 100, heroArmor = 0, dodgeT = 0, godMode = false, armorAbsorb = 0.5 } = {}) {
  const log = [];
  const state = {
    heroHp,
    heroArmor,
    nowSec: 100,
    nowMs: 100000,
    dmgDirAngle: 0,
    dmgDirUntil: 0,
    lastDamageT: 0,
  };
  const get = {
    heroPos: () => heroPos,
    heroHp: () => state.heroHp,
    heroArmor: () => state.heroArmor,
    dodgeT: () => dodgeT,
    godMode: () => godMode,
    armorAbsorb: () => armorAbsorb,
    nowSec: () => state.nowSec,
    nowMs: () => state.nowMs,
  };
  const set = {
    heroHp: v => { state.heroHp = v; },
    heroArmor: v => { state.heroArmor = v; },
    lastDamageT: v => { state.lastDamageT = v; },
    dmgDirAngle: v => { state.dmgDirAngle = v; },
    dmgDirUntil: v => { state.dmgDirUntil = v; },
  };
  const actions = {
    removeMesh: mesh => log.push({ type: "removeMesh", mesh }),
    flashDamage: () => log.push({ type: "flashDamage" }),
    applyScreenShake: amt => log.push({ type: "screenShake", amt }),
    spawnParticles: (u, y, v, n, col, spd, sz) => log.push({ type: "particles", u, y, v, n, col }),
    applyPoison: () => log.push({ type: "applyPoison" }),
    showDeathScreen: () => log.push({ type: "deathScreen" }),
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
  };
  return { get, set, actions, state, log };
}

describe("enemy_bullet_tick — bullet movement", () => {
  it("advances position by dir * speed * dt", () => {
    const { get, set, actions } = makeState({ heroPos: { u: 999, v: 999, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, dirU: 1, dirV: 0, dirY: 0, speed: 10 });
    const bullets = [b];
    mountEnemyBulletTick({ get, set, actions }).tick(0.1, { bullets, heroDead: false });
    expect(b.posU).toBeCloseTo(1.0);
    expect(b.posV).toBeCloseTo(0);
  });

  it("increments traveled distance", () => {
    const { get, set, actions } = makeState({ heroPos: { u: 999, v: 999, y: 0 } });
    const b = makeBullet({ speed: 20 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.1, { bullets: [b], heroDead: false });
    expect(b.traveled).toBeCloseTo(2.0);
  });

  it("sets mesh position after move", () => {
    const { get, set, actions } = makeState({ heroPos: { u: 999, v: 999, y: 0 } });
    const b = makeBullet({ u: 1, v: 2, y: 3, dirU: 0, dirV: 0, dirY: 0, speed: 0 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.1, { bullets: [b], heroDead: false });
    expect(b.mesh.position.x).toBeCloseTo(1);
    expect(b.mesh.position.y).toBeCloseTo(3);
    expect(b.mesh.position.z).toBeCloseTo(2);
  });
});

describe("enemy_bullet_tick — range expiry", () => {
  it("removes bullet when traveled >= range", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 999, v: 999, y: 0 } });
    const b = makeBullet({ speed: 100, range: 5 });
    const bullets = [b];
    mountEnemyBulletTick({ get, set, actions }).tick(0.1, { bullets, heroDead: false });
    expect(bullets.length).toBe(0);
    expect(log.some(e => e.type === "removeMesh")).toBe(true);
  });

  it("keeps bullet when traveled < range", () => {
    const { get, set, actions } = makeState({ heroPos: { u: 999, v: 999, y: 0 } });
    const b = makeBullet({ speed: 1, range: 50 });
    const bullets = [b];
    mountEnemyBulletTick({ get, set, actions }).tick(0.1, { bullets, heroDead: false });
    expect(bullets.length).toBe(1);
  });
});

describe("enemy_bullet_tick — hero collision", () => {
  it("direct hit removes bullet from array", () => {
    const { get, set, actions } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0 });
    const bullets = [b];
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets, heroDead: false });
    expect(bullets.length).toBe(0);
  });

  it("direct hit calls removeMesh", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "removeMesh")).toBe(true);
  });

  it("direct hit reduces heroHp by bullet damage", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 25 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(state.heroHp).toBe(75);
  });

  it("hit triggers flashDamage and screenShake", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 10 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "flashDamage")).toBe(true);
    expect(log.some(e => e.type === "screenShake")).toBe(true);
  });

  it("miss (far away) → heroHp unchanged", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 100, v: 100, y: 0 }, heroHp: 100 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 25, range: 5 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(state.heroHp).toBe(100);
  });

  it("heroDead flag → bullet hits but no hp loss", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 25 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: true });
    expect(state.heroHp).toBe(100);
  });

  it("godMode → no hp loss", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100, godMode: true });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 25 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(state.heroHp).toBe(100);
  });

  it("dodge active → no hp loss", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100, dodgeT: 0.3 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 25 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(state.heroHp).toBe(100);
  });
});

describe("enemy_bullet_tick — armor absorption", () => {
  it("armor absorbs portion of damage", () => {
    const { get, set, actions, state } = makeState({
      heroPos: { u: 0, v: 0, y: 0 },
      heroHp: 100, heroArmor: 50, armorAbsorb: 0.5,
    });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 20 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    // absorbed = min(50, 20*0.5) = 10; dmg = 20-10=10; hp = 90; armor = 40
    expect(state.heroHp).toBe(90);
    expect(state.heroArmor).toBe(40);
  });

  it("armor cannot absorb more than it has", () => {
    const { get, set, actions, state } = makeState({
      heroPos: { u: 0, v: 0, y: 0 },
      heroHp: 100, heroArmor: 3, armorAbsorb: 1.0,
    });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 10 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    // absorbed = min(3, 10*1.0) = 3; dmg = 7; hp = 93; armor = 0
    expect(state.heroHp).toBe(93);
    expect(state.heroArmor).toBe(0);
  });

  it("no armor → full damage applied", () => {
    const { get, set, actions, state } = makeState({
      heroPos: { u: 0, v: 0, y: 0 },
      heroHp: 100, heroArmor: 0,
    });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 15 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(state.heroHp).toBe(85);
  });
});

describe("enemy_bullet_tick — poison on hit", () => {
  it("poisonOnHit=true → applyPoison called", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, poisonOnHit: true });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "applyPoison")).toBe(true);
  });

  it("poisonOnHit=false → applyPoison not called", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, poisonOnHit: false });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "applyPoison")).toBe(false);
  });
});

describe("enemy_bullet_tick — death screen", () => {
  it("hit that drops hp to 0 → showDeathScreen called", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 5 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 100 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "deathScreen")).toBe(true);
  });

  it("hit that does not kill → deathScreen not called", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100 });
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 10 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "deathScreen")).toBe(false);
  });
});

describe("enemy_bullet_tick — near-miss sfx", () => {
  it("bullet passing close but not hitting → playSfx called", () => {
    // Place hero at (0,0), bullet just outside hit radius (>0.6m) but inside miss radius (<1.5m)
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 1.0, v: 0, y: 1.0, speed: 0, range: 100 }); // 1.0m away, outside hit(0.6) inside miss(1.5)
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false });
    expect(log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("near-miss cooldown prevents duplicate sfx within same tick series", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const sys = mountEnemyBulletTick({ get, set, actions });
    const b1 = makeBullet({ u: 1.0, v: 0, y: 1.0, speed: 0, range: 100 });
    const b2 = makeBullet({ u: 1.0, v: 0.1, y: 1.0, speed: 0, range: 100 });
    // Both bullets are in near-miss range; only one sfx should fire per cooldown window
    sys.tick(0.016, { bullets: [b1, b2], heroDead: false });
    const sfxCount = log.filter(e => e.type === "playSfx").length;
    expect(sfxCount).toBe(1);
  });

  it("heroDead → near-miss sfx not played", () => {
    const { get, set, actions, log } = makeState({ heroPos: { u: 0, v: 0, y: 0 } });
    const b = makeBullet({ u: 1.0, v: 0, y: 1.0, speed: 0, range: 100 });
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: true });
    expect(log.some(e => e.type === "playSfx")).toBe(false);
  });
});

describe("enemy_bullet_tick — heroPos null guard", () => {
  it("no heroPos → does not throw", () => {
    const { get, set, actions } = makeState();
    get.heroPos = () => null;
    const b = makeBullet();
    expect(() =>
      mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets: [b], heroDead: false })
    ).not.toThrow();
  });

  it("no heroPos → bullets not processed", () => {
    const { get, set, actions } = makeState();
    get.heroPos = () => null;
    const b = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0 });
    const bullets = [b];
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets, heroDead: false });
    // Bullet not moved (speed=0 so traveled=0) and not removed (range not exceeded)
    expect(bullets.length).toBe(1);
    expect(b.traveled).toBe(0);
  });
});

describe("enemy_bullet_tick — multiple bullets", () => {
  it("processes all bullets in one tick", () => {
    const { get, set, actions, state } = makeState({ heroPos: { u: 0, v: 0, y: 0 }, heroHp: 100 });
    const b1 = makeBullet({ u: 50, v: 0, y: 1.0, speed: 0, range: 5, damage: 10 }); // far, expires next tick if moved
    const b2 = makeBullet({ u: 0, v: 0, y: 1.0, speed: 0, damage: 20 }); // hit
    const bullets = [b1, b2];
    mountEnemyBulletTick({ get, set, actions }).tick(0.016, { bullets, heroDead: false });
    // b2 hits hero, b1 stays (traveled=0 < range=5)
    expect(state.heroHp).toBe(80);
    expect(bullets.length).toBe(1);
  });
});
