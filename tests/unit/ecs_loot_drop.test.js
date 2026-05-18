import { describe, it, expect, beforeEach } from "vitest";
import {
  createLootDropSystem, DROP_TABLE,
} from "../../src/systems/ecs_loot_drop.js";
import Core from "../../src/core/core.js";

function makeEnemy(type = "grunt", u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type, heading: 0 });
  Core.addComponent(id, "Faction",   { id: "enemy" });
  return id;
}

function makeHero() {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function makeBulletComponent(core, ownerId = null) {
  const bid = core.createEntity();
  core.addComponent(bid, "Bullet", { posU: 0, posV: 0, posY: 0.85, dirU: 0, dirV: 1,
    speed: 80, damage: 20, range: 30, traveled: 5, falloff: 0,
    weaponId: "pistol", ownerId, dmgMultipliers: {} });
  return bid;
}

// ── DROP_TABLE parity ─────────────────────────────────────────────────────────
describe("DROP_TABLE — monolith line 1175-1182 parity", () => {
  const T = DROP_TABLE;

  it("has all 8 enemy types", () => {
    expect(Object.keys(T)).toHaveLength(8);
    ["grunt","heavy","fast","poisoner","incendiary","robot","boss","sniper"]
      .forEach(k => expect(T[k]).toBeDefined());
  });

  it("grunt: pistol_9mm ×12, dropHealth=0", () => {
    expect(T.grunt.dropAmmo).toBe("pistol_9mm");
    expect(T.grunt.dropQty).toBe(12);
    expect(T.grunt.dropHealth).toBe(0);
  });

  it("heavy: pistol_9mm ×24, dropHealth=30", () => {
    expect(T.heavy.dropAmmo).toBe("pistol_9mm");
    expect(T.heavy.dropQty).toBe(24);
    expect(T.heavy.dropHealth).toBe(30);
  });

  it("fast: pistol_9mm ×6, dropHealth=0", () => {
    expect(T.fast.dropAmmo).toBe("pistol_9mm");
    expect(T.fast.dropQty).toBe(6);
    expect(T.fast.dropHealth).toBe(0);
  });

  it("robot: rifle_556 ×20, dropHealth=40", () => {
    expect(T.robot.dropAmmo).toBe("rifle_556");
    expect(T.robot.dropQty).toBe(20);
    expect(T.robot.dropHealth).toBe(40);
  });

  it("boss: rifle_556 ×60, dropHealth=80", () => {
    expect(T.boss.dropAmmo).toBe("rifle_556");
    expect(T.boss.dropQty).toBe(60);
    expect(T.boss.dropHealth).toBe(80);
  });

  it("sniper: rifle_556 ×15, dropHealth=0", () => {
    expect(T.sniper.dropAmmo).toBe("rifle_556");
    expect(T.sniper.dropQty).toBe(15);
    expect(T.sniper.dropHealth).toBe(0);
  });
});

// ── bullet:hit → kill detection ───────────────────────────────────────────────
describe("createLootDropSystem — bullet:hit kill detection", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:killed when bullet:hit drops hp to 0", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt", 3, 4);
    Core.getComponent(eid, "Health").hp = 0; // simulate bullet already reduced hp
    const bid = makeBulletComponent(Core);

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 20 });

    expect(kills.length).toBe(1);
    expect(kills[0].entityId).toBe(eid);
    expect(kills[0].type).toBe("grunt");
  });

  it("does NOT emit enemy:killed when target hp > 0", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt");
    // hp=80, not dead
    const bid = makeBulletComponent(Core);

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 10 });

    expect(kills.length).toBe(0);
  });

  it("passes ownerId as heroId in enemy:killed", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const hid = makeHero();
    const eid = makeEnemy("grunt");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core, hid);

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 20 });

    expect(kills[0].heroId).toBe(hid);
  });

  it("spawns ammo pickup at enemy position on grunt kill", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt", 5, 7);
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 80 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    expect(pickups.length).toBeGreaterThan(0);

    const ammoPickup = pickups.map(id => Core.getComponent(id, "Pickup"))
      .find(p => p.kind === "ammo");
    expect(ammoPickup).toBeDefined();
    expect(ammoPickup.ammoItem).toBe("pistol_9mm");
    expect(ammoPickup.qty).toBe(12);
  });

  it("spawns ammo pickup at correct world position", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt", 5, 7);
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 80 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup", "Transform");
    const t = Core.getComponent(pickups[0], "Transform");
    expect(t.u).toBe(5);
    expect(t.v).toBe(7);
  });

  it("spawns both ammo + health pickup on heavy kill", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("heavy");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 200 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    const pComps = pickups.map(id => Core.getComponent(id, "Pickup"));

    const ammo   = pComps.find(p => p.kind === "ammo");
    const health = pComps.find(p => p.kind === "health");

    expect(ammo).toBeDefined();
    expect(ammo.qty).toBe(24);
    expect(health).toBeDefined();
    expect(health.amount).toBe(30);
  });

  it("spawns both ammo + health pickup on boss kill", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("boss");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 1200 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    const pComps = pickups.map(id => Core.getComponent(id, "Pickup"));

    const ammo   = pComps.find(p => p.kind === "ammo");
    const health = pComps.find(p => p.kind === "health");

    expect(ammo.qty).toBe(60);
    expect(ammo.ammoItem).toBe("rifle_556");
    expect(health.amount).toBe(80);
  });

  it("spawns only ammo (no health) on grunt kill", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 80 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    const pComps = pickups.map(id => Core.getComponent(id, "Pickup"));
    const health = pComps.find(p => p.kind === "health");
    expect(health).toBeUndefined();
  });

  it("emits loot:dropped event for ammo drop", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("sniper");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    const drops = [];
    Core.on("loot:dropped", e => drops.push(e));

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 55 });

    const ammoDrop = drops.find(d => d.kind === "ammo");
    expect(ammoDrop).toBeDefined();
    expect(ammoDrop.ammoType).toBe("rifle_556");
    expect(ammoDrop.qty).toBe(15);
  });
});

// ── grenade:exploded → kill detection ────────────────────────────────────────
describe("createLootDropSystem — grenade:exploded kill detection", () => {
  beforeEach(() => Core._reset());

  it("emits enemy:killed for dead target in hits array", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("robot");
    Core.getComponent(eid, "Health").hp = 0;

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("grenade:exploded", {
      grenadeId: 999, u: 0, v: 0, kind: "frag",
      hits: [{ entityId: eid, dmg: 80, kbU: 0, kbV: 0 }],
      ownerId: null,
    });

    expect(kills.length).toBe(1);
    expect(kills[0].type).toBe("robot");
  });

  it("does NOT emit enemy:killed for surviving targets", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("grunt");
    Core.getComponent(eid, "Health").hp = 40; // survived blast

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("grenade:exploded", {
      grenadeId: 999, u: 0, v: 0, kind: "frag",
      hits: [{ entityId: eid, dmg: 40, kbU: 0, kbV: 0 }],
      ownerId: null,
    });

    expect(kills.length).toBe(0);
  });

  it("processes multiple kills from one grenade", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const e1 = makeEnemy("grunt");
    const e2 = makeEnemy("fast");
    Core.getComponent(e1, "Health").hp = 0;
    Core.getComponent(e2, "Health").hp = 0;

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("grenade:exploded", {
      grenadeId: 999, u: 0, v: 0, kind: "frag",
      hits: [
        { entityId: e1, dmg: 80, kbU: 0, kbV: 0 },
        { entityId: e2, dmg: 40, kbU: 0, kbV: 0 },
      ],
      ownerId: null,
    });

    expect(kills.length).toBe(2);
  });

  it("spawns robot drops on grenade kill", () => {
    const sys = createLootDropSystem();
    sys(0, Core);

    const eid = makeEnemy("robot", 2, 3);
    Core.getComponent(eid, "Health").hp = 0;

    Core.emit("grenade:exploded", {
      grenadeId: 999, u: 0, v: 0, kind: "frag",
      hits: [{ entityId: eid, dmg: 80, kbU: 0, kbV: 0 }],
      ownerId: null,
    });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    const pComps  = pickups.map(id => Core.getComponent(id, "Pickup"));

    const ammo   = pComps.find(p => p.kind === "ammo");
    const health = pComps.find(p => p.kind === "health");

    expect(ammo.ammoItem).toBe("rifle_556");
    expect(ammo.qty).toBe(20);
    expect(health.amount).toBe(40);
  });
});

// ── custom drop table override ────────────────────────────────────────────────
describe("createLootDropSystem — custom drop table", () => {
  beforeEach(() => Core._reset());

  it("uses custom table when provided", () => {
    const customTable = { grunt: { dropAmmo: "shotgun_shell", dropQty: 5, dropHealth: 10 } };
    const sys = createLootDropSystem(customTable);
    sys(0, Core);

    const eid = makeEnemy("grunt");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 80 });
    Core._flushDespawn();

    const pickups = Core.query("Pickup");
    const pComps  = pickups.map(id => Core.getComponent(id, "Pickup"));

    const ammo   = pComps.find(p => p.kind === "ammo");
    const health = pComps.find(p => p.kind === "health");

    expect(ammo.ammoItem).toBe("shotgun_shell");
    expect(ammo.qty).toBe(5);
    expect(health.amount).toBe(10);
  });

  it("skips drop gracefully when enemy type not in custom table", () => {
    const customTable = {}; // empty table
    const sys = createLootDropSystem(customTable);
    sys(0, Core);

    const eid = makeEnemy("boss");
    Core.getComponent(eid, "Health").hp = 0;
    const bid = makeBulletComponent(Core);

    const kills = [];
    Core.on("enemy:killed", e => kills.push(e));

    Core.emit("bullet:hit", { bulletId: bid, targetId: eid, dmg: 1200 });
    Core._flushDespawn();

    // enemy:killed still fires but no pickups spawned
    expect(kills.length).toBe(1);
    const pickups = Core.query("Pickup");
    expect(pickups.length).toBe(0);
  });
});
