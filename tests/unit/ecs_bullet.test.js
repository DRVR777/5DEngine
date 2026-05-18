import { describe, it, expect, beforeEach } from "vitest";
import {
  createBulletSystem, spawnBullet, computeHitModifiers,
  BULLET_HIT_RADIUS, BULLET_HEADSHOT_Y, BULLET_BACKSTAB_DOT,
  BULLET_FRONTAL_DOT, BULLET_CRIT_CHANCE, BULLET_KB_STRENGTH,
  BULLET_KB_DUR, BULLET_HEAVY_STAGGER, BULLET_FALLOFF_MIN, BULLET_SUBSTEPS,
} from "../../src/systems/ecs_bullet.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80, opts = {}) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: opts.maxHp ?? hp });
  Core.addComponent(id, "EnemyAI",   { heading: opts.heading ?? 0, type: opts.type ?? "grunt" });
  return id;
}

function makeBullet(opts = {}) {
  return spawnBullet(Core, {
    posU: opts.posU ?? 0, posV: opts.posV ?? -10,
    posY: opts.posY ?? 0.85,
    dirU: opts.dirU ?? 0, dirV: opts.dirV ?? 1, dirY: opts.dirY ?? 0,
    speed:   opts.speed   ?? 80,
    damage:  opts.damage  ?? 20,
    range:   opts.range   ?? 30,
    falloff: opts.falloff ?? 0,
    weaponId: opts.weaponId ?? "pistol",
    ownerId:  opts.ownerId  ?? null,
    dmgMultipliers: opts.dmgMultipliers ?? {},
  });
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("bullet constants — monolith line parity", () => {
  it("BULLET_HIT_RADIUS = 0.6 (line 6599)",      () => expect(BULLET_HIT_RADIUS).toBe(0.6));
  it("BULLET_HEADSHOT_Y = 1.35 (line 6600)",     () => expect(BULLET_HEADSHOT_Y).toBe(1.35));
  it("BULLET_BACKSTAB_DOT = 0.55 (line 6602)",   () => expect(BULLET_BACKSTAB_DOT).toBe(0.55));
  it("BULLET_FRONTAL_DOT = -0.55 (line 6603)",   () => expect(BULLET_FRONTAL_DOT).toBe(-0.55));
  it("BULLET_CRIT_CHANCE = 0.10 (line 6605)",    () => expect(BULLET_CRIT_CHANCE).toBe(0.10));
  it("BULLET_KB_STRENGTH = 3.5 (line 6635)",     () => expect(BULLET_KB_STRENGTH).toBe(3.5));
  it("BULLET_KB_DUR = 0.1 (line 6637)",          () => expect(BULLET_KB_DUR).toBe(0.1));
  it("BULLET_HEAVY_STAGGER = 0.6 (line 6641)",   () => expect(BULLET_HEAVY_STAGGER).toBe(0.6));
  it("BULLET_FALLOFF_MIN = 0.15 (line 6606)",    () => expect(BULLET_FALLOFF_MIN).toBe(0.15));
  it("BULLET_SUBSTEPS = 5 (line 6584)",          () => expect(BULLET_SUBSTEPS).toBe(5));
});

// ── spawnBullet ───────────────────────────────────────────────────────────────
describe("spawnBullet", () => {
  beforeEach(() => Core._reset());

  it("creates a Bullet entity with correct defaults", () => {
    const bid = spawnBullet(Core, {});
    const b = Core.getComponent(bid, "Bullet");
    expect(b).toBeDefined();
    expect(b.speed).toBe(80);
    expect(b.damage).toBe(20);
    expect(b.range).toBe(30);
    expect(b.traveled).toBe(0);
    expect(b.falloff).toBe(0);
    expect(b.weaponId).toBe("pistol");
    expect(b.ownerId).toBe(null);
  });

  it("respects custom position and direction", () => {
    const bid = spawnBullet(Core, { posU: 3, posV: 5, dirU: 1, dirV: 0 });
    const b = Core.getComponent(bid, "Bullet");
    expect(b.posU).toBe(3);
    expect(b.posV).toBe(5);
    expect(b.dirU).toBe(1);
    expect(b.dirV).toBe(0);
  });

  it("respects custom damage and range", () => {
    const bid = spawnBullet(Core, { damage: 45, range: 60 });
    const b = Core.getComponent(bid, "Bullet");
    expect(b.damage).toBe(45);
    expect(b.range).toBe(60);
  });

  it("bullet:spawn event creates entity", () => {
    const sys = createBulletSystem();
    sys(0, Core); // wire listeners
    Core.emit("bullet:spawn", { posU: 1, posV: 2, damage: 15 });
    const ids = Core.query("Bullet");
    expect(ids.length).toBe(1);
    expect(Core.getComponent(ids[0], "Bullet").damage).toBe(15);
  });
});

// ── computeHitModifiers ───────────────────────────────────────────────────────
describe("computeHitModifiers", () => {
  const baseB = { posY: 0.85, dirU: 0, dirV: 1 };

  it("headshot when posY > 1.35", () => {
    const b = { ...baseB, posY: 1.5 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai);
    expect(m.headshot).toBe(true);
    expect(m.backstab).toBe(false);
    expect(m.frontalBlock).toBe(false);
    expect(m.crit).toBe(false);
  });

  it("no headshot when posY <= 1.35", () => {
    const b = { ...baseB, posY: 1.35 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai, () => 0.99);
    expect(m.headshot).toBe(false);
  });

  it("backstab when dot > 0.55 and no headshot", () => {
    // dirU=0, dirV=1, heading=0 → dot = 0*sin(0) + 1*cos(0) = 1.0 > 0.55
    const b = { posY: 0.85, dirU: 0, dirV: 1 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai);
    expect(m.backstab).toBe(true);
    expect(m.frontalBlock).toBe(false);
    expect(m.crit).toBe(false);
  });

  it("frontal block on boss when dot < -0.55", () => {
    // dirU=0, dirV=-1, heading=0 → dot = 0*0 + (-1)*1 = -1.0 < -0.55
    const b = { posY: 0.85, dirU: 0, dirV: -1 };
    const ai = { heading: 0, type: "boss" };
    const m = computeHitModifiers(b, ai, () => 0.99);
    expect(m.frontalBlock).toBe(true);
    expect(m.backstab).toBe(false);
    expect(m.crit).toBe(false);
  });

  it("frontal block on heavy when dot < -0.55", () => {
    const b = { posY: 0.85, dirU: 0, dirV: -1 };
    const ai = { heading: 0, type: "heavy" };
    const m = computeHitModifiers(b, ai, () => 0.99);
    expect(m.frontalBlock).toBe(true);
  });

  it("no frontal block on grunt (not boss/heavy)", () => {
    const b = { posY: 0.85, dirU: 0, dirV: -1 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai, () => 0.99);
    expect(m.frontalBlock).toBe(false);
  });

  it("crit when randFn < 0.10 and no other modifier", () => {
    // dirV=0, dirU=1, heading=0 → dot = 1*0 + 0*1 = 0, no backstab/frontal
    const b = { posY: 0.85, dirU: 1, dirV: 0 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai, () => 0.01);
    expect(m.crit).toBe(true);
    expect(m.headshot).toBe(false);
    expect(m.backstab).toBe(false);
    expect(m.frontalBlock).toBe(false);
  });

  it("no crit when randFn >= 0.10", () => {
    const b = { posY: 0.85, dirU: 1, dirV: 0 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai, () => 0.99);
    expect(m.crit).toBe(false);
  });

  it("headshot takes priority over backstab", () => {
    const b = { posY: 1.5, dirU: 0, dirV: 1 };
    const ai = { heading: 0, type: "grunt" };
    const m = computeHitModifiers(b, ai);
    expect(m.headshot).toBe(true);
    expect(m.backstab).toBe(false);
  });
});

// ── createBulletSystem — hit detection ───────────────────────────────────────
describe("createBulletSystem — hit detection", () => {
  beforeEach(() => Core._reset());

  it("bullet hits enemy within HIT_RADIUS and deals damage", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    const eid = makeEnemy(0, 0);
    // Bullet starts just behind enemy, facing toward it
    const bid = spawnBullet(Core, { posU: 0, posV: -0.3, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));

    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(1);
    expect(hits[0].targetId).toBe(eid);
    expect(Core.getComponent(eid, "Health").hp).toBeLessThan(80);
  });

  it("bullet misses enemy outside HIT_RADIUS", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    makeEnemy(5, 0); // 5m away in U direction
    // Bullet travels along V axis, won't get close
    const bid = spawnBullet(Core, { posU: 0, posV: -1, dirU: 0, dirV: 1, speed: 1, damage: 20, range: 5 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));

    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(0);
  });

  it("dead enemy is not hit", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    const eid = makeEnemy(0, 0);
    Core.getComponent(eid, "Health").hp = 0; // already dead
    spawnBullet(Core, { posU: 0, posV: -0.3, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(0);
  });

  it("owner entity is not hit by own bullet (no friendly fire)", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    const eid = makeEnemy(0, 0); // eid acts as ownerId
    spawnBullet(Core, { posU: 0, posV: -0.3, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 30, ownerId: eid });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(0);
  });

  it("bullet:expired emitted when bullet reaches range", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    spawnBullet(Core, { posU: 0, posV: 0, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 1 });
    sys(0, Core);

    const expired = [];
    Core.on("bullet:expired", e => expired.push(e));

    sys(1 / 60, Core); // 80 * (1/60) ≈ 1.33m per tick > 1m range
    Core._flushDespawn();

    expect(expired.length).toBe(1);
  });

  it("emits bullet:knockback on hit", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    makeEnemy(0, 0);
    spawnBullet(Core, { posU: 0, posV: -0.3, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const kbs = [];
    Core.on("bullet:knockback", e => kbs.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(kbs.length).toBe(1);
    expect(kbs[0].kbT).toBe(BULLET_KB_DUR);
  });

  it("headshot detected when bullet posY > 1.35", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    makeEnemy(0, 0);
    // posY 1.5 starts above headshot threshold; Y doesn't change (dirY=0)
    spawnBullet(Core, { posU: 0, posV: -0.3, posY: 1.5, dirU: 0, dirV: 1, dirY: 0, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(1);
    expect(hits[0].headshot).toBe(true);
  });

  it("backstab detected by direction alignment", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    // heading=0, dirV=1 → dot = 1 > 0.55 → backstab
    makeEnemy(0, 0, 80, { heading: 0, type: "grunt" });
    spawnBullet(Core, { posU: 0, posV: -0.3, posY: 0.85, dirU: 0, dirV: 1, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(1);
    expect(hits[0].backstab).toBe(true);
  });
});

// ── heavy-hit stagger ─────────────────────────────────────────────────────────
describe("createBulletSystem — heavy-hit stagger", () => {
  beforeEach(() => Core._reset());

  it("emits bullet:stagger when dmg >= 25% maxHp and not boss", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    // maxHp=80; dmg needs to be >= 20. Raw damage=20, no modifiers (no crit, no headshot, backstab is true here but let's use neutral angle)
    // Use dirU=1, dirV=0, heading=0 → dot = 0 → no backstab/frontal
    makeEnemy(0, 0, 80, { heading: 0, type: "grunt", maxHp: 80 });
    // Place bullet at x=−0.3, traveling in +U direction
    spawnBullet(Core, { posU: -0.3, posV: 0, posY: 0.85, dirU: 1, dirV: 0, dirY: 0, speed: 80, damage: 20, range: 30, dmgMultipliers: {} });
    sys(0, Core);

    const staggers = [];
    Core.on("bullet:stagger", e => staggers.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(staggers.length).toBe(1);
    expect(staggers[0].duration).toBe(BULLET_HEAVY_STAGGER);
  });

  it("no stagger when enemy hp already 0 after hit", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    // hp=10 < 80*0.25=20, but enemy will die (hp→0), stagger condition: h.hp > 0 after damage
    makeEnemy(0, 0, 10, { heading: 0, type: "grunt" });
    spawnBullet(Core, { posU: -0.3, posV: 0, posY: 0.85, dirU: 1, dirV: 0, speed: 80, damage: 20, range: 30 });
    sys(0, Core);

    const staggers = [];
    Core.on("bullet:stagger", e => staggers.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    // hp was 10, dmg≥20 kills it → hp=0 → stagger condition (h.hp > 0) fails
    expect(staggers.length).toBe(0);
  });

  it("no stagger on boss regardless of damage", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    makeEnemy(0, 0, 1200, { heading: 0, type: "boss" });
    spawnBullet(Core, { posU: -0.3, posV: 0, posY: 0.85, dirU: 1, dirV: 0, speed: 80, damage: 400, range: 30 });
    sys(0, Core);

    const staggers = [];
    Core.on("bullet:stagger", e => staggers.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(staggers.length).toBe(0);
  });
});

// ── falloff ────────────────────────────────────────────────────────────────────
describe("createBulletSystem — damage falloff", () => {
  beforeEach(() => Core._reset());

  it("falloff=0 applies no reduction", () => {
    const sys = createBulletSystem({ randFn: () => 0.99 });
    makeEnemy(0, 0, 200);
    spawnBullet(Core, { posU: -0.3, posV: 0, posY: 0.85, dirU: 1, dirV: 0, speed: 80, damage: 20, range: 30, falloff: 0 });
    sys(0, Core);

    const hits = [];
    Core.on("bullet:hit", e => hits.push(e));
    sys(1 / 60, Core);
    Core._flushDespawn();

    expect(hits.length).toBe(1);
    // With falloff=0, falloffMul=1, and neutral angle: no backstab/headshot/crit
    // applyPlayerDamage with all multipliers=1 → dmg=20
    expect(hits[0].dmg).toBe(20);
  });
});
