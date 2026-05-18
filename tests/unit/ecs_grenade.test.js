import { describe, it, expect, beforeEach } from "vitest";
import {
  createGrenadeSystem, spawnGrenade, explodeGrenade,
  GRENADE_FUSE, GRENADE_RADIUS, GRENADE_MAX_DMG,
  GRENADE_KB_STRENGTH, GRENADE_KB_DUR, GRENADE_STAGGER_R,
} from "../../src/systems/ecs_grenade.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "Faction",   { id: "enemy" });
  return id;
}

function makeHero(u = 0, v = 0, hp = 100) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "Faction",   { id: "player" });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("grenade constants — monolith line 2388 parity", () => {
  it("GRENADE_FUSE = 2.5 (monolith line 2301)",        () => expect(GRENADE_FUSE).toBe(2.5));
  it("GRENADE_RADIUS = 14 (monolith line 2388)",       () => expect(GRENADE_RADIUS).toBe(14));
  it("GRENADE_MAX_DMG = 80 (monolith line 2388)",      () => expect(GRENADE_MAX_DMG).toBe(80));
  it("GRENADE_KB_STRENGTH = 14 (monolith line 2398)",  () => expect(GRENADE_KB_STRENGTH).toBe(14));
  it("GRENADE_KB_DUR = 0.28 (monolith line 2401)",     () => expect(GRENADE_KB_DUR).toBe(0.28));
  it("GRENADE_STAGGER_R = 5 (monolith line 2403)",     () => expect(GRENADE_STAGGER_R).toBe(5));
});

// ── spawnGrenade ──────────────────────────────────────────────────────────────
describe("spawnGrenade", () => {
  beforeEach(() => Core._reset());

  it("creates a Grenade entity with default fuse and position", () => {
    const gid = spawnGrenade(Core, { u: 3, v: 7 });
    const g = Core.getComponent(gid, "Grenade");
    expect(g.fuseLeft).toBe(GRENADE_FUSE);
    expect(g.u).toBe(3);
    expect(g.v).toBe(7);
    expect(g.kind).toBe("frag");
    expect(g.blastRadius).toBe(GRENADE_RADIUS);
    expect(g.maxDmg).toBe(GRENADE_MAX_DMG);
  });

  it("respects fuseOverride", () => {
    const gid = spawnGrenade(Core, { fuseOverride: 1.0 });
    expect(Core.getComponent(gid, "Grenade").fuseLeft).toBe(1.0);
  });

  it("respects custom kind and maxDmg", () => {
    const gid = spawnGrenade(Core, { kind: "smoke", maxDmg: 0 });
    const g = Core.getComponent(gid, "Grenade");
    expect(g.kind).toBe("smoke");
    expect(g.maxDmg).toBe(0);
  });
});

// ── explodeGrenade — damage formula ─────────────────────────────────────────
describe("explodeGrenade — AoE damage (monolith line 2388-2394)", () => {
  beforeEach(() => Core._reset());

  it("enemy at center (d=0) takes full maxDmg = 80", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    const eid = makeEnemy(0, 0, 200);

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(Core.getComponent(eid, "Health").hp).toBe(120); // 200 - 80
  });

  it("enemy at half radius takes round(80 × 0.5) = 40 damage", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0, blastRadius: 14, maxDmg: 80 });
    const eid = makeEnemy(7, 0, 100); // 7m away = half of 14

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(Core.getComponent(eid, "Health").hp).toBe(60); // 100 - 40
  });

  it("enemy at blast edge (d=14) takes 0 damage", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    const eid = makeEnemy(14, 0, 100);

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(Core.getComponent(eid, "Health").hp).toBe(100); // no damage at edge
  });

  it("enemy outside blast radius is not hit", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    const eid = makeEnemy(20, 0, 100); // 20m > 14m radius

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(Core.getComponent(eid, "Health").hp).toBe(100);
  });

  it("dead enemies are not damaged again", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    const eid = makeEnemy(0, 0, 80);
    Core.getComponent(eid, "Health").hp = 0; // already dead

    const hits = explodeGrenade(Core, gid);
    Core._flushDespawn();

    const hitIds = hits.map(h => h.entityId);
    expect(hitIds).not.toContain(eid);
  });

  it("emits grenade:exploded with hit data", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    makeEnemy(3, 0, 100);

    const events = [];
    Core.on("grenade:exploded", e => events.push(e));

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(events.length).toBe(1);
    expect(events[0].u).toBe(0);
    expect(events[0].v).toBe(0);
    expect(events[0].hits.length).toBeGreaterThan(0);
  });

  it("smoke grenade does not damage (kind=smoke, maxDmg=0)", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0, kind: "smoke", maxDmg: 0 });
    const eid = makeEnemy(0, 0, 100);

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(Core.getComponent(eid, "Health").hp).toBe(100);
  });
});

// ── explodeGrenade — knockback ────────────────────────────────────────────────
describe("explodeGrenade — knockback events", () => {
  beforeEach(() => Core._reset());

  it("emits grenade:knockback for enemies in blast radius", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    makeEnemy(3, 0, 100);

    const kbs = [];
    Core.on("grenade:knockback", e => kbs.push(e));

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(kbs.length).toBe(1);
    expect(kbs[0].kbT).toBe(GRENADE_KB_DUR);
    expect(kbs[0].kbU).toBeGreaterThan(0); // pushed in +u direction (away from 0,0)
  });

  it("emits grenade:stagger for enemies within 5m (GRENADE_STAGGER_R)", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    makeEnemy(3, 0, 200); // 3m < 5m stagger radius

    const staggers = [];
    Core.on("grenade:stagger", e => staggers.push(e));

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(staggers.length).toBe(1);
  });

  it("no stagger for enemies beyond GRENADE_STAGGER_R but within blast", () => {
    const gid = spawnGrenade(Core, { u: 0, v: 0 });
    makeEnemy(8, 0, 200); // 8m > 5m stagger radius, but < 14m blast

    const staggers = [];
    Core.on("grenade:stagger", e => staggers.push(e));

    explodeGrenade(Core, gid);
    Core._flushDespawn();

    expect(staggers.length).toBe(0);
  });
});

// ── createGrenadeSystem — fuse countdown ─────────────────────────────────────
describe("createGrenadeSystem — fuse countdown", () => {
  beforeEach(() => Core._reset());

  it("grenade explodes after fuse expires", () => {
    const sys = createGrenadeSystem();
    const gid = spawnGrenade(Core, { u: 0, v: 0, fuseOverride: 1.0 });
    makeEnemy(0, 0, 200);
    sys(0, Core); // wire listeners

    const exploded = [];
    Core.on("grenade:exploded", e => exploded.push(e));

    sys(1.5, Core); // past 1.0s fuse

    expect(exploded.length).toBe(1);
  });

  it("grenade does not explode before fuse expires", () => {
    const sys = createGrenadeSystem();
    spawnGrenade(Core, { u: 0, v: 0, fuseOverride: 2.0 });
    sys(0, Core);

    const exploded = [];
    Core.on("grenade:exploded", e => exploded.push(e));

    sys(0.5, Core);

    expect(exploded.length).toBe(0);
  });

  it("grenade:throw event spawns a grenade entity", () => {
    const sys = createGrenadeSystem();
    sys(0, Core);

    Core.emit("grenade:throw", { u: 5, v: 10, kind: "frag" });

    const ids = Core.query("Grenade");
    expect(ids.length).toBe(1);
    const g = Core.getComponent(ids[0], "Grenade");
    expect(g.u).toBe(5);
    expect(g.v).toBe(10);
    expect(g.fuseLeft).toBeCloseTo(GRENADE_FUSE);
  });

  it("owner entity is not self-damaged by own grenade", () => {
    const sys = createGrenadeSystem();
    const hid = makeHero(0, 0, 100);
    spawnGrenade(Core, { u: 0, v: 0, fuseOverride: 0.1, ownerId: hid });
    sys(0, Core);

    sys(0.5, Core);
    Core._flushDespawn();

    expect(Core.getComponent(hid, "Health").hp).toBe(100); // no self-damage
  });
});
