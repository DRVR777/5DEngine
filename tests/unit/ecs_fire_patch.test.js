import { describe, it, expect, beforeEach } from "vitest";
import {
  createFirePatchSystem,
  FIRE_RADIUS, FIRE_DURATION,
  FIRE_HERO_DAMAGE, FIRE_HERO_DMG_INTERVAL,
  FIRE_ENEMY_DAMAGE, FIRE_ENEMY_DMG_INTERVAL,
} from "../../src/systems/ecs_fire_patch.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform",  { u, v, y: 0 });
  Core.addComponent(id, "Health",     { hp: 200, maxHp: 200 });
  Core.addComponent(id, "EnemyAI",    { type: "grunt", heading: 0 });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform",     { u, v, y: 0 });
  Core.addComponent(id, "Health",        { hp: 100, maxHp: 100 });
  Core.addComponent(id, "PlayerControl", { speed: 5 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("fire patch constants — monolith lines 3813/8285-8301 parity", () => {
  it("FIRE_RADIUS = 1.5",             () => expect(FIRE_RADIUS).toBe(1.5));
  it("FIRE_DURATION = 6.0",           () => expect(FIRE_DURATION).toBe(6.0));
  it("FIRE_HERO_DAMAGE = 6",          () => expect(FIRE_HERO_DAMAGE).toBe(6));
  it("FIRE_HERO_DMG_INTERVAL = 0.5",  () => expect(FIRE_HERO_DMG_INTERVAL).toBe(0.5));
  it("FIRE_ENEMY_DAMAGE = 8",         () => expect(FIRE_ENEMY_DAMAGE).toBe(8));
  it("FIRE_ENEMY_DMG_INTERVAL = 0.5", () => expect(FIRE_ENEMY_DMG_INTERVAL).toBe(0.5));
});

// ── Patch creation ────────────────────────────────────────────────────────────
describe("createFirePatchSystem — patch creation via fire:patch_spawned", () => {
  beforeEach(() => Core._reset());

  it("creates a FirePatch entity on fire:patch_spawned", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 3, v: 2 });

    const patches = Core.query("FirePatch");
    expect(patches.length).toBe(1);
    const fp = Core.getComponent(patches[0], "FirePatch");
    expect(fp.u).toBe(3);
    expect(fp.v).toBe(2);
    expect(fp.radius).toBe(FIRE_RADIUS);
    expect(fp.timeLeft).toBe(FIRE_DURATION);
  });

  it("respects custom radius and duration in fire:patch_spawned", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0, radius: 3, duration: 10 });

    const fp = Core.getComponent(Core.query("FirePatch")[0], "FirePatch");
    expect(fp.radius).toBe(3);
    expect(fp.timeLeft).toBe(10);
  });
});

// ── Expiry ────────────────────────────────────────────────────────────────────
describe("createFirePatchSystem — expiry", () => {
  beforeEach(() => Core._reset());

  it("decrements timeLeft each tick", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    sys(1.0, Core);

    const fp = Core.getComponent(Core.query("FirePatch")[0], "FirePatch");
    expect(fp.timeLeft).toBeCloseTo(FIRE_DURATION - 1.0, 5);
  });

  it("removes patch after FIRE_DURATION", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    sys(FIRE_DURATION + 0.01, Core);
    Core._flushDespawn();

    expect(Core.query("FirePatch").length).toBe(0);
  });

  it("emits fire:patch_expired when removed", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    const events = [];
    Core.on("fire:patch_expired", e => events.push(e));
    Core.emit("fire:patch_spawned", { u: 4, v: -2 });
    sys(FIRE_DURATION + 0.01, Core);

    expect(events.length).toBe(1);
    expect(events[0].u).toBe(4);
    expect(events[0].v).toBe(-2);
  });
});

// ── Hero damage ───────────────────────────────────────────────────────────────
describe("createFirePatchSystem — hero damage", () => {
  beforeEach(() => Core._reset());

  it("emits fire:hero_damage when hero is in fire zone", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    makeHero(0.5, 0); // inside 1.5m radius

    const events = [];
    Core.on("fire:hero_damage", e => events.push(e));
    sys(1 / 60, Core); // first tick — heroDmgT=0 → immediate damage

    expect(events.length).toBe(1);
    expect(events[0].damage).toBe(FIRE_HERO_DAMAGE);
  });

  it("does NOT emit fire:hero_damage when hero is outside fire zone", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    makeHero(5, 0); // outside 1.5m radius

    const events = [];
    Core.on("fire:hero_damage", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
  });

  it("hero damage repeats every FIRE_HERO_DMG_INTERVAL seconds", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    makeHero(0, 0);

    const events = [];
    Core.on("fire:hero_damage", e => events.push(e));
    sys(1 / 60, Core); // first hit
    sys(FIRE_HERO_DMG_INTERVAL + 0.01, Core); // second hit

    expect(events.length).toBe(2);
  });
});

// ── Enemy damage ──────────────────────────────────────────────────────────────
describe("createFirePatchSystem — enemy damage", () => {
  beforeEach(() => Core._reset());

  it("emits fire:enemy_damage when enemy is in fire zone", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    const eid = makeEnemy(0.5, 0);

    const events = [];
    Core.on("fire:enemy_damage", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(1);
    expect(events[0].entityId).toBe(eid);
    expect(events[0].damage).toBe(FIRE_ENEMY_DAMAGE);
  });

  it("does NOT emit fire:enemy_damage when enemy is outside fire zone", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    makeEnemy(5, 0);

    const events = [];
    Core.on("fire:enemy_damage", e => events.push(e));
    sys(1 / 60, Core);

    expect(events.length).toBe(0);
  });

  it("enemy damage repeats every FIRE_ENEMY_DMG_INTERVAL seconds", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);

    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    makeEnemy(0, 0);

    const events = [];
    Core.on("fire:enemy_damage", e => events.push(e));
    sys(1 / 60, Core); // first hit (ai._fireDmgT = 0 → immediate)
    sys(FIRE_ENEMY_DMG_INTERVAL + 0.01, Core); // second hit

    expect(events.length).toBe(2);
  });

  it("does not crash with no enemies or hero", () => {
    const sys = createFirePatchSystem();
    sys.wireListeners(Core);
    Core.emit("fire:patch_spawned", { u: 0, v: 0 });
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });

  it("does not crash with no patches", () => {
    const sys = createFirePatchSystem();
    makeEnemy(0, 0);
    makeHero(0, 0);
    expect(() => sys(1 / 60, Core)).not.toThrow();
  });
});
