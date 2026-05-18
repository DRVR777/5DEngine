import { describe, it, expect, beforeEach } from "vitest";
import {
  createGunshotAlertSystem,
  GUNSHOT_ALERT_RADIUS, GUNSHOT_ALERT_DUR,
  GUNSHOT_ALERT_SPEED_MUL, GUNSHOT_ALERT_ARRIVE_DIST,
} from "../../src/systems/ecs_gunshot_alert.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80, sightRange = 12) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4, sightRange });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function fireShot(heroId) {
  Core.emit("weapon:fired", { entityId: heroId, weaponId: "pistol", damage: 20 });
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("gunshot alert constants — monolith lines 5937 / 7083-7166 parity", () => {
  it("GUNSHOT_ALERT_RADIUS = 9 (line 7085)",      () => expect(GUNSHOT_ALERT_RADIUS).toBe(9));
  it("GUNSHOT_ALERT_DUR = 3.0 (line 5937)",       () => expect(GUNSHOT_ALERT_DUR).toBe(3.0));
  it("GUNSHOT_ALERT_SPEED_MUL = 0.7 (line 7162)", () => expect(GUNSHOT_ALERT_SPEED_MUL).toBe(0.7));
  it("GUNSHOT_ALERT_ARRIVE_DIST = 1.2 (line 7158)", () => expect(GUNSHOT_ALERT_ARRIVE_DIST).toBe(1.2));
});

// ── Alert trigger ─────────────────────────────────────────────────────────────
describe("createGunshotAlertSystem — alert trigger", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:heard_shot for enemy within 9m of shot position", () => {
    const sys = createGunshotAlertSystem();
    const heroId = makeHero(0, 0);
    // sightRange=1 so enemy at 7m cannot see hero
    const eid = makeEnemy(0, 7, 80, 1);
    sys(0.1, Core); // wire listener

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    fireShot(heroId);

    expect(heard.length).toBe(1);
    expect(heard[0].entityId).toBe(eid);
  });

  it("enemy:heard_shot includes alertU, alertV = shot position", () => {
    const sys = createGunshotAlertSystem();
    const heroId = makeHero(3, 4);
    const eid = makeEnemy(3, 10, 80, 1); // sightRange=1 so can't see hero 6m away
    sys(0.1, Core);

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    fireShot(heroId);

    expect(heard[0].alertU).toBe(3);
    expect(heard[0].alertV).toBe(4);
  });

  it("does NOT alert enemy outside 9m of shot", () => {
    const sys = createGunshotAlertSystem();
    const heroId = makeHero(0, 0);
    makeEnemy(0, 10); // exactly 10m — outside radius
    sys(0.1, Core);

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    fireShot(heroId);

    expect(heard.length).toBe(0);
  });

  it("does NOT alert enemy that can see hero (has LOS)", () => {
    const sys = createGunshotAlertSystem();
    const heroId = makeHero(0, 0);
    makeEnemy(0, 5, 80, 12); // 5m from hero, sightRange=12 → canSee=true
    sys(0.1, Core);

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    fireShot(heroId);

    // Enemy can see hero (dist=5 <= sightRange=12) → no alert
    expect(heard.length).toBe(0);
  });

  it("does NOT alert dead enemy", () => {
    const sys = createGunshotAlertSystem();
    const heroId = makeHero(0, 0);
    makeEnemy(0, 5, 0); // dead
    sys(0.1, Core);

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    fireShot(heroId);

    expect(heard.length).toBe(0);
  });

  it("does NOT alert from non-hero weapon:fired (enemy shooter)", () => {
    const sys = createGunshotAlertSystem();
    makeHero(0, 100); // hero far away
    const enemyId = Core.createEntity(); // shooter without PlayerControl
    Core.addComponent(enemyId, "Transform", { u: 0, v: 0, y: 0 });
    makeEnemy(0, 5, 80, 0); // low sight — won't see hero

    sys(0.1, Core);

    const heard = [];
    Core.on("enemy:heard_shot", e => heard.push(e));
    // Emit as if an enemy fired (no PlayerControl)
    Core.emit("weapon:fired", { entityId: enemyId, weaponId: "pistol", damage: 20 });

    expect(heard.length).toBe(0);
  });
});

// ── Alert movement ────────────────────────────────────────────────────────────
describe("createGunshotAlertSystem — approach movement", () => {
  beforeEach(() => Core._reset());

  it("alerted enemy moves toward alert position", () => {
    const sys = createGunshotAlertSystem();
    const hero = makeHero(0, 0);
    const en = makeEnemy(0, 8, 80, 1); // sightRange=1 → can't see hero 8m away
    sys(0.1, Core);
    fireShot(hero);

    const tBefore = Core.getComponent(en, "Transform").v;
    sys(0.5, Core); // approach toward shot at (0,0)

    // Enemy at (0,8), alert at (0,0) → v should decrease (move south)
    expect(Core.getComponent(en, "Transform").v).toBeLessThan(tBefore);
  });

  it("emits enemy:alerting each tick while approaching", () => {
    const sys = createGunshotAlertSystem();
    const hero = makeHero(0, 0);
    const en = makeEnemy(0, 8, 80, 1); // sightRange=1 so can't see hero
    sys(0.1, Core);
    fireShot(hero);

    const alerting = [];
    Core.on("enemy:alerting", e => alerting.push(e));
    sys(0.5, Core);

    expect(alerting.length).toBe(1);
    expect(alerting[0].entityId).toBe(en);
  });

  it("alert expires after GUNSHOT_ALERT_DUR seconds", () => {
    const sys = createGunshotAlertSystem();
    const hero = makeHero(0, 0);
    const en = makeEnemy(0, 8, 80, 1);
    sys(0.1, Core);
    fireShot(hero);

    const alerting = [];
    Core.on("enemy:alerting", e => alerting.push(e));
    sys(3.5, Core); // 3.5 > 3.0 → alert expired

    // After alert expires, no more alerting events
    const countBefore = alerting.length;
    sys(0.5, Core);
    expect(alerting.length).toBe(countBefore); // no new events
  });

  it("alert cancelled when enemy spots hero", () => {
    const sys = createGunshotAlertSystem();
    const hero = makeHero(0, 0);
    const en = makeEnemy(0, 8, 80, 1); // sightRange=1
    sys(0.1, Core);
    fireShot(hero);

    // Manually put hero very close (within sightRange=1)
    Core.getComponent(en, "EnemyAI")._heardShotT = GUNSHOT_ALERT_DUR;
    const enT = Core.getComponent(en, "Transform");
    enT.u = 0; enT.v = 0.5; // 0.5m from hero → within sightRange=1

    const alerting = [];
    Core.on("enemy:alerting", e => alerting.push(e));
    sys(0.1, Core);

    expect(alerting.length).toBe(0); // alert cancelled
    expect(Core.getComponent(en, "EnemyAI")._heardShotT).toBe(0);
  });

  it("stops moving when within GUNSHOT_ALERT_ARRIVE_DIST of alert position", () => {
    const sys = createGunshotAlertSystem();
    const hero = makeHero(0, 0);
    const en = makeEnemy(0, 1.0, 80, 1); // 1.0m from hero — within arrival dist 1.2m
    sys(0.1, Core);
    fireShot(hero);

    // Manually set alert since the enemy is too close to trigger naturally (< arrival dist)
    const ai = Core.getComponent(en, "EnemyAI");
    ai._heardShotT = GUNSHOT_ALERT_DUR;
    ai._alertU = 0;
    ai._alertV = 0;

    const tBefore = { ...Core.getComponent(en, "Transform") };
    sys(0.1, Core);
    const tAfter = Core.getComponent(en, "Transform");

    // Should have cleared alert and stopped movement
    expect(ai._heardShotT).toBe(0);
    expect(tAfter.u).toBe(tBefore.u);
    expect(tAfter.v).toBe(tBefore.v);
  });
});
