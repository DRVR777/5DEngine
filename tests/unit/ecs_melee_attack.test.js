import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMeleeAttackSystem,
  MELEE_ATTACK_CD, MELEE_STRAFE_SPD_MUL,
  MELEE_STRAFE_DUR_MIN, MELEE_STRAFE_DUR_RAND,
  MELEE_KB_HEAVY_SPD, MELEE_KB_BOSS_SPD, MELEE_KB_DUR,
  MELEE_POISON_CHANCE, MELEE_BURNING_CHANCE,
  MELEE_NO_STRAFE_TYPES,
} from "../../src/systems/ecs_melee_attack.js";
import Core from "../../src/core/core.js";

function makeEnemy(type = "grunt", u = 0, v = 0, hp = 80) {
  const defs = {
    grunt:      { moveSpeed: 2.4, damage: 6,  attackRange: 1.6, sightRange: 12 },
    heavy:      { moveSpeed: 1.2, damage: 18, attackRange: 2.0, sightRange: 10 },
    fast:       { moveSpeed: 5.0, damage: 4,  attackRange: 1.2, sightRange: 16 },
    poisoner:   { moveSpeed: 2.0, damage: 3,  attackRange: 1.8, sightRange: 12 },
    incendiary: { moveSpeed: 2.2, damage: 5,  attackRange: 1.8, sightRange: 12 },
    robot:      { moveSpeed: 1.0, damage: 25, attackRange: 2.2, sightRange: 14 },
    boss:       { moveSpeed: 1.8, damage: 40, attackRange: 3.0, sightRange: 20 },
    sniper:     { moveSpeed: 0.9, damage: 45, attackRange: 20,  sightRange: 22 },
  };
  const d = defs[type] ?? defs.grunt;
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type, heading: 0, ...d });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("melee attack constants — monolith lines 7062 / 7481-7534 parity", () => {
  it("MELEE_ATTACK_CD = 1.0 (BT line 7062: attackCD)",        () => expect(MELEE_ATTACK_CD).toBe(1.0));
  it("MELEE_STRAFE_SPD_MUL = 0.5 (line 7489)",               () => expect(MELEE_STRAFE_SPD_MUL).toBe(0.5));
  it("MELEE_STRAFE_DUR_MIN = 1.2 (line 7485)",               () => expect(MELEE_STRAFE_DUR_MIN).toBe(1.2));
  it("MELEE_STRAFE_DUR_RAND = 1.3 (line 7485)",              () => expect(MELEE_STRAFE_DUR_RAND).toBe(1.3));
  it("MELEE_KB_HEAVY_SPD = 9 (line 7528)",                   () => expect(MELEE_KB_HEAVY_SPD).toBe(9));
  it("MELEE_KB_BOSS_SPD = 14 (line 7528)",                   () => expect(MELEE_KB_BOSS_SPD).toBe(14));
  it("MELEE_KB_DUR = 0.22 (line 7531)",                      () => expect(MELEE_KB_DUR).toBe(0.22));
  it("MELEE_POISON_CHANCE = 0.55 (line 7517)",               () => expect(MELEE_POISON_CHANCE).toBe(0.55));
  it("MELEE_BURNING_CHANCE = 0.45 (line 7518)",              () => expect(MELEE_BURNING_CHANCE).toBe(0.45));
  it("MELEE_NO_STRAFE_TYPES includes sniper/boss/robot/heavy", () => {
    expect(MELEE_NO_STRAFE_TYPES).toContain("sniper");
    expect(MELEE_NO_STRAFE_TYPES).toContain("boss");
    expect(MELEE_NO_STRAFE_TYPES).toContain("robot");
    expect(MELEE_NO_STRAFE_TYPES).toContain("heavy");
  });
});

// ── Melee hit event ───────────────────────────────────────────────────────────
describe("createMeleeAttackSystem — melee hit", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:melee_hit when dist <= attackRange", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0); // 1.0m < attackRange 1.6

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(1);
  });

  it("melee_hit includes entityId, damage, type", () => {
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits[0].entityId).toBe(eid);
    expect(hits[0].damage).toBe(6);
    expect(hits[0].type).toBe("grunt");
  });

  it("does NOT emit when dist > attackRange", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 5); // 5m > attackRange 1.6

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
  });

  it("uses damage from EnemyAI component (heavy = 18)", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("heavy", 0, 0);
    makeHero(0, 1.5); // within 2.0m attackRange

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits[0].damage).toBe(18);
  });
});

// ── Melee cooldown ────────────────────────────────────────────────────────────
describe("createMeleeAttackSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not fire a second hit within 1s CD", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(0.1, Core); // first hit
    sys(0.8, Core); // 0.9s total < 1.0s CD
    expect(hits.length).toBe(1);
  });

  it("fires again after 1s CD elapses", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(0.1, Core);  // first hit at elapsed=0.1
    sys(1.1, Core);  // elapsed=1.2, gap=1.1 > 1.0 → second hit
    expect(hits.length).toBe(2);
  });
});

// ── Strafe (light enemies) ────────────────────────────────────────────────────
describe("createMeleeAttackSystem — strafe", () => {
  beforeEach(() => {
    Core._reset();
    vi.restoreAllMocks();
  });

  it("grunt u-position changes after tick in attack range (strafe moves entity)", () => {
    // hero at (0, 1.0) → heroAng = atan2(0, 1) = 0 → perpAng = ±PI/2 → du ≠ 0
    vi.spyOn(Math, "random").mockReturnValue(0.7); // strafeDir = 1
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const before = Core.getComponent(eid, "Transform").u;
    sys(0.1, Core);
    const after = Core.getComponent(eid, "Transform").u;

    expect(Math.abs(after - before)).toBeGreaterThan(0);
  });

  it("fast enemy strafeDir -1: u moves in negative direction", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7); // 0.7 >= 0.5 → strafeDir = -1
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("fast", 0, 0);
    makeHero(0, 1.0); // within attackRange 1.2

    sys(0.1, Core);
    const t = Core.getComponent(eid, "Transform");
    // du = sin(-PI/2) * sSpd * dt = -1 * ... < 0
    expect(t.u).toBeLessThan(0);
  });

  it("sniper does NOT strafe (u unchanged)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("sniper", 0, 0);
    makeHero(0, 15); // within sniper attackRange 20

    sys(0.1, Core);
    expect(Core.getComponent(eid, "Transform").u).toBe(0);
  });

  it("heavy does NOT strafe (u unchanged)", () => {
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("heavy", 0, 0);
    makeHero(0, 1.5); // within 2.0m attackRange

    sys(0.1, Core);
    expect(Core.getComponent(eid, "Transform").u).toBe(0);
  });

  it("boss does NOT strafe (u unchanged)", () => {
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("boss", 0, 0);
    makeHero(0, 2.0); // within 3.0m attackRange

    sys(0.1, Core);
    expect(Core.getComponent(eid, "Transform").u).toBe(0);
  });

  it("robot does NOT strafe (u unchanged)", () => {
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("robot", 0, 0);
    makeHero(0, 1.5); // within 2.2m attackRange

    sys(0.1, Core);
    expect(Core.getComponent(eid, "Transform").u).toBe(0);
  });
});

// ── Knockback ─────────────────────────────────────────────────────────────────
describe("createMeleeAttackSystem — knockback", () => {
  beforeEach(() => Core._reset());

  it("heavy emits enemy:melee_knockback with speed 9 and duration 0.22", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("heavy", 0, 0);
    makeHero(0, 1.5);

    const kbs = [];
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    expect(kbs.length).toBe(1);
    expect(kbs[0].speed).toBe(MELEE_KB_HEAVY_SPD);
    expect(kbs[0].duration).toBe(MELEE_KB_DUR);
  });

  it("boss emits enemy:melee_knockback with speed 14", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("boss", 0, 0);
    makeHero(0, 2.0);

    const kbs = [];
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    expect(kbs.length).toBe(1);
    expect(kbs[0].speed).toBe(MELEE_KB_BOSS_SPD);
  });

  it("knockback direction points away from attacker toward hero", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("heavy", 0, 0);
    makeHero(0, 1.5); // hero north of enemy

    const kbs = [];
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    // dir should point toward hero: dirV > 0, dirU ≈ 0
    expect(kbs[0].dirV).toBeCloseTo(1, 3);
    expect(Math.abs(kbs[0].dirU)).toBeLessThan(0.01);
  });

  it("grunt does NOT emit enemy:melee_knockback", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const kbs = [];
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    expect(kbs.length).toBe(0);
  });

  it("fast does NOT emit enemy:melee_knockback", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("fast", 0, 0);
    makeHero(0, 1.0);

    const kbs = [];
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    expect(kbs.length).toBe(0);
  });
});

// ── Status effects ────────────────────────────────────────────────────────────
describe("createMeleeAttackSystem — status effects", () => {
  beforeEach(() => {
    Core._reset();
    vi.restoreAllMocks();
  });

  it("poisoner emits status:apply 'poison' when random < 0.55", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.3); // < 0.55
    const sys = createMeleeAttackSystem();
    makeEnemy("poisoner", 0, 0);
    makeHero(0, 1.0);

    const statuses = [];
    Core.on("status:apply", e => statuses.push(e));
    sys(1 / 60, Core);

    expect(statuses.some(e => e.effect === "poison")).toBe(true);
  });

  it("poisoner does NOT emit status:apply when random >= 0.55", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.8); // >= 0.55
    const sys = createMeleeAttackSystem();
    makeEnemy("poisoner", 0, 0);
    makeHero(0, 1.0);

    const statuses = [];
    Core.on("status:apply", e => statuses.push(e));
    sys(1 / 60, Core);

    expect(statuses.some(e => e.effect === "poison")).toBe(false);
  });

  it("incendiary emits status:apply 'burning' when random < 0.45", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.2); // < 0.45
    const sys = createMeleeAttackSystem();
    makeEnemy("incendiary", 0, 0);
    makeHero(0, 1.0);

    const statuses = [];
    Core.on("status:apply", e => statuses.push(e));
    sys(1 / 60, Core);

    expect(statuses.some(e => e.effect === "burning")).toBe(true);
  });

  it("incendiary does NOT emit 'burning' when random >= 0.45", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.6); // >= 0.45
    const sys = createMeleeAttackSystem();
    makeEnemy("incendiary", 0, 0);
    makeHero(0, 1.0);

    const statuses = [];
    Core.on("status:apply", e => statuses.push(e));
    sys(1 / 60, Core);

    expect(statuses.some(e => e.effect === "burning")).toBe(false);
  });

  it("grunt does NOT emit any status:apply", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    makeHero(0, 1.0);

    const statuses = [];
    Core.on("status:apply", e => statuses.push(e));
    sys(1 / 60, Core);

    expect(statuses.length).toBe(0);
  });
});

// ── Guards ────────────────────────────────────────────────────────────────────
describe("createMeleeAttackSystem — guards", () => {
  beforeEach(() => Core._reset());

  it("dead enemy does NOT attack", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0, 0); // hp=0
    makeHero(0, 1.0);

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
  });

  it("dead hero does NOT trigger attack", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    const heroId = Core.createEntity();
    Core.addComponent(heroId, "PlayerControl", { active: true });
    Core.addComponent(heroId, "Transform", { u: 0, v: 1.0, y: 0 });
    Core.addComponent(heroId, "Health",    { hp: 0, maxHp: 100 }); // dead hero

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
  });

  it("does not crash with no hero", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit with no hero", () => {
    const sys = createMeleeAttackSystem();
    makeEnemy("grunt", 0, 0);

    const hits = [], kbs = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    Core.on("enemy:melee_knockback", e => kbs.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
    expect(kbs.length).toBe(0);
  });

  it("enemy out of sightRange does NOT attack (even if within attackRange)", () => {
    const sys = createMeleeAttackSystem();
    const eid = makeEnemy("grunt", 0, 0);
    Core.getComponent(eid, "EnemyAI").sightRange = 0.5; // tiny sight range
    makeHero(0, 1.0); // in attack range but beyond sight

    const hits = [];
    Core.on("enemy:melee_hit", e => hits.push(e));
    sys(1 / 60, Core);

    expect(hits.length).toBe(0);
  });
});
