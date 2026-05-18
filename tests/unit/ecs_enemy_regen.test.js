import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnemyRegenSystem,
  ENEMY_REGEN_RATE, ENEMY_REGEN_OOC_DELAY, ENEMY_REGEN_DISPLAY_INTERVAL,
} from "../../src/systems/ecs_enemy_regen.js";
import Core from "../../src/core/core.js";

function makeEnemy(hp = 50, maxHp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("enemy regen constants — monolith lines 7707-7721 parity", () => {
  it("ENEMY_REGEN_RATE = 4 HP/s (line 7712)",           () => expect(ENEMY_REGEN_RATE).toBe(4));
  it("ENEMY_REGEN_OOC_DELAY = 8s (line 7710)",          () => expect(ENEMY_REGEN_OOC_DELAY).toBe(8));
  it("ENEMY_REGEN_DISPLAY_INTERVAL = 1.8s (line 7715)", () => expect(ENEMY_REGEN_DISPLAY_INTERVAL).toBe(1.8));
});

// ── Regen trigger ─────────────────────────────────────────────────────────────
describe("createEnemyRegenSystem — regen trigger", () => {
  beforeEach(() => Core._reset());

  it("heals enemy at 4 HP/s when out of combat", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);

    sys(1.0, Core);

    const h = Core.getComponent(eid, "Health");
    expect(h.hp).toBeCloseTo(54, 5);
  });

  it("does NOT heal dead enemy (hp <= 0)", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(0, 100);

    sys(1.0, Core);

    expect(Core.getComponent(eid, "Health").hp).toBe(0);
  });

  it("does NOT heal at-full-hp enemy", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(100, 100);

    sys(1.0, Core);

    expect(Core.getComponent(eid, "Health").hp).toBe(100);
  });

  it("does NOT heal when _wasChasing=true", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    sys(1.0, Core);

    expect(Core.getComponent(eid, "Health").hp).toBe(50);
  });

  it("does NOT heal within OOC delay after recent damage", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);
    // Simulate damage taken at elapsed=0 (set _hpBarShowT = elapsed before first sys call)
    // After sys(0.1), elapsed=0.1 — then mark damage at 0.1
    sys(0.1, Core);
    Core.getComponent(eid, "EnemyAI")._hpBarShowT = 0.1; // damage at elapsed=0.1
    const hpAfterDmgMark = Core.getComponent(eid, "Health").hp;

    sys(5.0, Core); // elapsed=5.1; 5.0s < 8s OOC delay → no regen

    expect(Core.getComponent(eid, "Health").hp).toBeCloseTo(hpAfterDmgMark, 2);
  });

  it("resumes regen after OOC delay expires", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);
    sys(0.1, Core);
    Core.getComponent(eid, "EnemyAI")._hpBarShowT = 0.1;

    sys(8.1, Core); // elapsed=8.2; 8.1s > 8s → regen resumes for 8.1s worth
    // Slight healing in the same tick
    expect(Core.getComponent(eid, "Health").hp).toBeGreaterThan(50);
  });

  it("does not overheal beyond maxHp", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(99, 100);

    sys(10.0, Core); // would regen 40 HP, but capped at 100

    expect(Core.getComponent(eid, "Health").hp).toBe(100);
  });
});

// ── Regen tick event ──────────────────────────────────────────────────────────
describe("createEnemyRegenSystem — regen_tick event", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:regen_tick after REGEN_DISPLAY_INTERVAL", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);

    const ticks = [];
    Core.on("enemy:regen_tick", e => ticks.push(e));
    sys(ENEMY_REGEN_DISPLAY_INTERVAL + 0.1, Core); // just over 1.8s

    expect(ticks.length).toBe(1);
    expect(ticks[0].entityId).toBe(eid);
    expect(ticks[0].amount).toBe(ENEMY_REGEN_RATE);
  });

  it("does NOT emit regen_tick when chasing (combat)", () => {
    const sys = createEnemyRegenSystem();
    const eid = makeEnemy(50, 100);
    Core.getComponent(eid, "EnemyAI")._wasChasing = true;

    const ticks = [];
    Core.on("enemy:regen_tick", e => ticks.push(e));
    sys(2.0, Core);

    expect(ticks.length).toBe(0);
  });

  it("emits regen_tick multiple times as interval repeats", () => {
    const sys = createEnemyRegenSystem();
    makeEnemy(10, 100);

    const ticks = [];
    Core.on("enemy:regen_tick", e => ticks.push(e));
    // Simulate 4s in 40 × 0.1s steps — expect at least 2 display ticks
    for (let i = 0; i < 40; i++) sys(0.1, Core);

    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});
