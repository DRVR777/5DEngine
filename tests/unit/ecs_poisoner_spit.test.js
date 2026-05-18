import { describe, it, expect, beforeEach } from "vitest";
import {
  createPoisonerSpitSystem,
  POISONER_SPIT_MIN_DIST, POISONER_SPIT_MAX_DIST,
  POISONER_SPIT_CD, POISONER_SPIT_TOF, POISONER_SPIT_FUSE,
} from "../../src/systems/ecs_poisoner_spit.js";
import Core from "../../src/core/core.js";

function makePoisoner(u = 0, v = 0, hp = 90) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "poisoner", heading: 0, moveSpeed: 2.0,
    sightRange: 12 });
  return id;
}

function makeHero(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  return id;
}

function makeGrunt(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("poisoner spit constants — monolith line 7299-7321 parity", () => {
  it("POISONER_SPIT_MIN_DIST = 3 (line 7300)",   () => expect(POISONER_SPIT_MIN_DIST).toBe(3));
  it("POISONER_SPIT_MAX_DIST = 10 (line 7300)",  () => expect(POISONER_SPIT_MAX_DIST).toBe(10));
  it("POISONER_SPIT_CD = 4.0 (line 7301)",       () => expect(POISONER_SPIT_CD).toBe(4.0));
  it("POISONER_SPIT_TOF = 1.1 (line 7303)",      () => expect(POISONER_SPIT_TOF).toBe(1.1));
  it("POISONER_SPIT_FUSE = 1.35 (line 7314: tof+0.25)", () => expect(POISONER_SPIT_FUSE).toBeCloseTo(1.35));
});

// ── Spit trigger ──────────────────────────────────────────────────────────────
describe("createPoisonerSpitSystem — spit trigger", () => {
  beforeEach(() => Core._reset());

  it("emits poisoner:acid_spit when hero in 3–10m range", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 6); // 6m — within 3-10m

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(1);
  });

  it("acid_spit includes entityId, u, v, targetU, targetV, tof", () => {
    const sys = createPoisonerSpitSystem();
    const pid = makePoisoner(1, 2);
    makeHero(4, 6);

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits[0].entityId).toBe(pid);
    expect(spits[0].u).toBe(1);
    expect(spits[0].v).toBe(2);
    expect(spits[0].targetU).toBe(4);
    expect(spits[0].targetV).toBe(6);
    expect(spits[0].tof).toBe(POISONER_SPIT_TOF);
  });

  it("emits grenade:throw at hero position with correct fuse", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 6);

    const gThrows = [];
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(gThrows.length).toBe(1);
    expect(gThrows[0].fuseOverride).toBe(POISONER_SPIT_FUSE);
    expect(gThrows[0].u).toBe(0);
    expect(gThrows[0].v).toBe(6);
  });

  it("does NOT spit when hero <= 3m (exclusive min)", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 3); // exactly 3m — not > 3

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });

  it("does NOT spit when hero >= 10m (exclusive max)", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 10); // exactly 10m — not < 10

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });

  it("does NOT spit when hero < 3m (too close)", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 1); // 1m

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });

  it("does NOT spit when hero > 10m (too far)", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 11); // 11m

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });

  it("non-poisoner (grunt) does NOT spit", () => {
    const sys = createPoisonerSpitSystem();
    makeGrunt(0, 0);
    makeHero(0, 6);

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });

  it("dead poisoner does NOT spit", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0, 0); // hp=0
    makeHero(0, 6);

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
  });
});

// ── Cooldown ──────────────────────────────────────────────────────────────────
describe("createPoisonerSpitSystem — cooldown", () => {
  beforeEach(() => Core._reset());

  it("does not spit again before 4s cooldown", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 6);

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));

    sys(0.1, Core); // first spit
    sys(3.5, Core); // 3.6s < 4s → blocked

    expect(spits.length).toBe(1);
  });

  it("spits again after 4s cooldown elapses", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    makeHero(0, 6);

    const spits = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));

    sys(0.1, Core); // first spit: elapsed=0.1
    sys(4.1, Core); // 4.2s > 4s → second spit

    expect(spits.length).toBe(2);
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createPoisonerSpitSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash when no hero exists", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not emit when no hero exists", () => {
    const sys = createPoisonerSpitSystem();
    makePoisoner(0, 0);

    const spits = [], gThrows = [];
    Core.on("poisoner:acid_spit", e => spits.push(e));
    Core.on("grenade:throw", e => gThrows.push(e));
    sys(1 / 60, Core);

    expect(spits.length).toBe(0);
    expect(gThrows.length).toBe(0);
  });
});
