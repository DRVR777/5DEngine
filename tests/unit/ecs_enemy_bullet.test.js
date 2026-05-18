import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnemyBulletSystem,
  ENEMY_BULLET_HIT_RADIUS_SQ, ENEMY_BULLET_HIT_Y_HALF,
  ENEMY_BULLET_NEAR_MISS_SQ, ENEMY_BULLET_NEAR_MISS_Y,
  ENEMY_BULLET_NEAR_MISS_CD, ENEMY_BULLET_HERO_Y,
} from "../../src/systems/ecs_enemy_bullet.js";
import Core from "../../src/core/core.js";

function makeHero(u = 0, v = 0, y = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function spawnBullet(u, v, posY, dirU, dirV, dirY, speed, damage, range, poisonOnHit = false) {
  const id = Core.createEntity();
  Core.addComponent(id, "EnemyBullet", {
    posU: u, posV: v, posY,
    dirU, dirV, dirY: dirY ?? 0,
    speed, damage, range,
    traveled: 0,
    poisonOnHit,
  });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("enemy bullet constants — monolith lines 6888-6920 parity", () => {
  it("HIT_RADIUS_SQ = 0.36 (0.6m radius)", () => expect(ENEMY_BULLET_HIT_RADIUS_SQ).toBe(0.36));
  it("HIT_Y_HALF = 0.9 (±0.9m vertical)", () => expect(ENEMY_BULLET_HIT_Y_HALF).toBe(0.9));
  it("NEAR_MISS_SQ = 2.25 (1.5m radius)",  () => expect(ENEMY_BULLET_NEAR_MISS_SQ).toBe(2.25));
  it("NEAR_MISS_Y = 1.2",                  () => expect(ENEMY_BULLET_NEAR_MISS_Y).toBe(1.2));
  it("NEAR_MISS_CD = 0.5s",               () => expect(ENEMY_BULLET_NEAR_MISS_CD).toBe(0.5));
  it("HERO_Y = 1.0 (hero center offset)",  () => expect(ENEMY_BULLET_HERO_Y).toBe(1.0));
});

// ── Bullet movement ───────────────────────────────────────────────────────────
describe("createEnemyBulletSystem — movement", () => {
  beforeEach(() => Core._reset());

  it("advances posU by dirU * speed * dt", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100); // far away, no hit
    const bid = spawnBullet(0, 0, 1, 1, 0, 0, 10, 5, 20);

    sys(0.1, Core);

    const b = Core.getComponent(bid, "EnemyBullet");
    expect(b.posU).toBeCloseTo(1.0, 5);
  });

  it("advances posV by dirV * speed * dt", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100);
    const bid = spawnBullet(0, 0, 1, 0, 1, 0, 10, 5, 20);

    sys(0.1, Core);

    const b = Core.getComponent(bid, "EnemyBullet");
    expect(b.posV).toBeCloseTo(1.0, 5);
  });

  it("advances posY by dirY * speed * dt", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100);
    const bid = spawnBullet(0, 0, 0, 0, 1, 0.18, 10, 5, 20);

    sys(0.1, Core);

    const b = Core.getComponent(bid, "EnemyBullet");
    expect(b.posY).toBeCloseTo(0.18, 5);
  });

  it("increments traveled by speed * dt", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100);
    const bid = spawnBullet(0, 0, 1, 1, 0, 0, 10, 5, 20);

    sys(0.2, Core);

    const b = Core.getComponent(bid, "EnemyBullet");
    expect(b.traveled).toBeCloseTo(2.0, 5);
  });
});

// ── Hero hit detection ────────────────────────────────────────────────────────
describe("createEnemyBulletSystem — hero hit", () => {
  beforeEach(() => Core._reset());

  it("emits enemy_bullet:hit when bullet reaches hero position", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0); // hero at origin, center at y=1.0
    // Bullet aimed directly at hero, starts 0.5m away (within hit radius after minimal advance)
    spawnBullet(-0.4, 0, 1.0, 1, 0, 0, 10, 8, 20);

    const hits = [];
    Core.on("enemy_bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(1);
  });

  it("hit event includes damage and poisonOnHit", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    spawnBullet(-0.4, 0, 1.0, 1, 0, 0, 10, 8, 20, true);

    const hits = [];
    Core.on("enemy_bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits[0].damage).toBe(8);
    expect(hits[0].poisonOnHit).toBe(true);
  });

  it("hit event includes bullet position (posU, posV, posY)", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    spawnBullet(-0.4, 0, 1.0, 1, 0, 0, 10, 8, 20);

    const hits = [];
    Core.on("enemy_bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(typeof hits[0].posU).toBe("number");
    expect(typeof hits[0].posV).toBe("number");
    expect(typeof hits[0].posY).toBe("number");
  });

  it("destroys bullet entity on hit (component gone after flush)", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    const bid = spawnBullet(-0.4, 0, 1.0, 1, 0, 0, 10, 8, 20);

    Core.on("enemy_bullet:hit", () => {});
    sys(1 / 60, Core);
    Core._flushDespawn(); // flush pending despawn (normally called by runSystems)

    expect(Core.getComponent(bid, "EnemyBullet")).toBeFalsy();
  });

  it("does NOT hit when horizontal distance >= 0.6m", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    // Bullet passing 0.7m to the side of hero
    spawnBullet(0, 0.7, 1.0, 1, 0, 0, 10, 8, 20);

    const hits = [];
    Core.on("enemy_bullet:hit", e => hits.push(e));
    sys(0.1, Core);

    expect(hits.length).toBe(0);
  });

  it("does NOT hit when vertical offset >= 0.9m", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0); // hero center at y=1.0
    // Bullet at y=2.1 → dh = 1.0 - 2.1 = -1.1, |dh|=1.1 >= 0.9
    spawnBullet(-0.1, 0, 2.1, 1, 0, 0, 10, 8, 20);

    const hits = [];
    Core.on("enemy_bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
  });
});

// ── Range expiration ──────────────────────────────────────────────────────────
describe("createEnemyBulletSystem — range expiration", () => {
  beforeEach(() => Core._reset());

  it("emits enemy_bullet:expired when traveled >= range", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100); // hero far away
    spawnBullet(0, 0, 1.0, 1, 0, 0, 10, 5, 5);

    const expired = [];
    Core.on("enemy_bullet:expired", e => expired.push(e));
    sys(0.6, Core); // traveled = 10 * 0.6 = 6 > range(5)

    expect(expired.length).toBe(1);
  });

  it("destroys bullet entity on expiration (component gone after flush)", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100);
    const bid = spawnBullet(0, 0, 1.0, 1, 0, 0, 10, 5, 5);

    Core.on("enemy_bullet:expired", () => {});
    sys(0.6, Core);
    Core._flushDespawn();

    expect(Core.getComponent(bid, "EnemyBullet")).toBeFalsy();
  });

  it("does NOT expire bullet within range", () => {
    const sys = createEnemyBulletSystem();
    makeHero(100, 100);
    const bid = spawnBullet(0, 0, 1.0, 1, 0, 0, 10, 5, 20);

    const expired = [];
    Core.on("enemy_bullet:expired", e => expired.push(e));
    sys(0.1, Core); // traveled = 1.0 < range(20)

    expect(expired.length).toBe(0);
    expect(Core.getComponent(bid, "EnemyBullet")).not.toBeNull();
  });
});

// ── Near-miss ────────────────────────────────────────────────────────────────
describe("createEnemyBulletSystem — near-miss", () => {
  beforeEach(() => Core._reset());

  it("emits enemy_bullet:near_miss when bullet passes within 1.5m without hitting", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    // Bullet at 1.0m to the side — within 1.5m near-miss radius but > 0.6m hit radius
    spawnBullet(1.0, 0, 1.0, 1, 0, 0, 10, 5, 30);

    const misses = [];
    Core.on("enemy_bullet:near_miss", e => misses.push(e));
    sys(1 / 60, Core);

    expect(misses.length).toBe(1);
  });

  it("near-miss CD prevents multiple events within 0.5s", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    spawnBullet(1.0, 0, 1.0, 1, 0, 0, 1, 5, 30);
    spawnBullet(1.0, 0.1, 1.0, 1, 0, 0, 1, 5, 30);

    const misses = [];
    Core.on("enemy_bullet:near_miss", e => misses.push(e));
    sys(1 / 60, Core);

    expect(misses.length).toBe(1); // second bullet suppressed by CD
  });

  it("near-miss fires again after 0.5s CD", () => {
    const sys = createEnemyBulletSystem();
    makeHero(0, 0, 0);
    spawnBullet(1.0, 0, 1.0, 1, 0, 0, 1, 5, 30);

    const misses = [];
    Core.on("enemy_bullet:near_miss", e => misses.push(e));
    sys(1 / 60, Core); // miss 1
    sys(0.55, Core);   // CD elapsed → new bullet that's also near

    // Need another bullet for second miss
    spawnBullet(1.0, 0.1, 1.0, 1, 0, 0, 1, 5, 30);
    sys(1 / 60, Core); // miss 2

    expect(misses.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Spawn from ranged attack events ──────────────────────────────────────────
describe("createEnemyBulletSystem — wireListeners", () => {
  beforeEach(() => Core._reset());

  it("spawns EnemyBullet entity on poisoner:venom_dart event", () => {
    const sys = createEnemyBulletSystem();
    sys.wireListeners(Core);
    makeHero(100, 100);

    Core.emit("poisoner:venom_dart", {
      u: 0, v: 0, dirU: 0, dirV: 1, dirY: 0.18,
      speed: 6, damage: 4, range: 11,
    });
    sys(1 / 60, Core);

    const bullets = Core.query("EnemyBullet");
    expect(bullets.length).toBe(1);
    expect(Core.getComponent(bullets[0], "EnemyBullet").poisonOnHit).toBe(true);
  });

  it("spawns EnemyBullet entity on robot:plasma_shot event", () => {
    const sys = createEnemyBulletSystem();
    sys.wireListeners(Core);
    makeHero(100, 100);

    Core.emit("robot:plasma_shot", {
      u: 0, v: 0, dirU: 0, dirV: 1,
      speed: 14, damage: 12, range: 12,
    });
    sys(1 / 60, Core);

    const bullets = Core.query("EnemyBullet");
    expect(bullets.length).toBe(1);
    expect(Core.getComponent(bullets[0], "EnemyBullet").poisonOnHit).toBe(false);
  });

  it("spawns EnemyBullet entity on sniper:shot event", () => {
    const sys = createEnemyBulletSystem();
    sys.wireListeners(Core);
    makeHero(100, 100);

    Core.emit("sniper:shot", {
      u: 0, v: 0, dirU: 0, dirV: 1,
      speed: 30, damage: 45, range: 25,
    });
    sys(1 / 60, Core);

    const bullets = Core.query("EnemyBullet");
    expect(bullets.length).toBe(1);
  });
});
