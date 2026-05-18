import { describe, it, expect, beforeEach } from "vitest";
import { createKnockbackSystem } from "../../src/systems/ecs_knockback.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  return id;
}

function makeEntity(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  return id; // no EnemyAI — for knockback-only (no stagger)
}

// ── bullet:knockback → Knockback component ────────────────────────────────────
describe("createKnockbackSystem — bullet:knockback", () => {
  beforeEach(() => Core._reset());

  it("applies Knockback component on bullet:knockback event", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("bullet:knockback", { entityId: eid, kbU: 3.5, kbV: 0, kbT: 0.1 });

    const kb = Core.getComponent(eid, "Knockback");
    expect(kb).toBeDefined();
    expect(kb.u).toBe(3.5);
    expect(kb.v).toBe(0);
    expect(kb.timeLeft).toBe(0.1);
  });

  it("moves entity transform while knockback active", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity(0, 0);
    Core.emit("bullet:knockback", { entityId: eid, kbU: 10, kbV: 0, kbT: 1.0 });

    sys(0.1, Core); // 10 u/s × 0.1s = 1.0 u movement

    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBeCloseTo(1.0);
    expect(t.v).toBeCloseTo(0);
  });

  it("removes Knockback component after timeLeft expires", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("bullet:knockback", { entityId: eid, kbU: 3.5, kbV: 0, kbT: 0.1 });

    sys(0.15, Core); // past 0.1s

    expect(Core.getComponent(eid, "Knockback")).toBeUndefined();
  });

  it("emits knockback:ended when Knockback expires", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("bullet:knockback", { entityId: eid, kbU: 3.5, kbV: 0, kbT: 0.1 });

    const ended = [];
    Core.on("knockback:ended", e => ended.push(e));

    sys(0.15, Core);

    expect(ended.length).toBe(1);
    expect(ended[0].entityId).toBe(eid);
  });

  it("accumulates impulses when multiple knockbacks hit same entity", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("bullet:knockback", { entityId: eid, kbU: 2, kbV: 0, kbT: 0.1 });
    Core.emit("bullet:knockback", { entityId: eid, kbU: 3, kbV: 0, kbT: 0.1 });

    const kb = Core.getComponent(eid, "Knockback");
    expect(kb.u).toBe(5); // 2 + 3 accumulated
  });

  it("uses max timeLeft when new KB has longer duration", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("bullet:knockback",  { entityId: eid, kbU: 2, kbV: 0, kbT: 0.1 });
    Core.emit("grenade:knockback", { entityId: eid, kbU: 0, kbV: 5, kbT: 0.28 });

    const kb = Core.getComponent(eid, "Knockback");
    expect(kb.timeLeft).toBe(0.28); // max(0.1, 0.28)
    expect(kb.u).toBe(2);
    expect(kb.v).toBe(5);
  });

  it("ignores knockback for entity without Transform", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = Core.createEntity(); // no Transform
    Core.addComponent(eid, "Health", { hp: 80, maxHp: 80 });

    Core.emit("bullet:knockback", { entityId: eid, kbU: 3.5, kbV: 0, kbT: 0.1 });

    expect(Core.getComponent(eid, "Knockback")).toBeUndefined();
  });
});

// ── grenade:knockback ─────────────────────────────────────────────────────────
describe("createKnockbackSystem — grenade:knockback", () => {
  beforeEach(() => Core._reset());

  it("applies Knockback from grenade:knockback event", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity();
    Core.emit("grenade:knockback", { entityId: eid, kbU: 0, kbV: 14, kbT: 0.28 });

    const kb = Core.getComponent(eid, "Knockback");
    expect(kb).toBeDefined();
    expect(kb.v).toBe(14);
    expect(kb.timeLeft).toBe(0.28);
  });

  it("moves entity in correct direction from grenade blast", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity(0, 0);
    Core.emit("grenade:knockback", { entityId: eid, kbU: 0, kbV: 14, kbT: 0.28 });

    sys(0.1, Core);

    const t = Core.getComponent(eid, "Transform");
    expect(t.v).toBeCloseTo(1.4); // 14 v/s × 0.1s
  });
});

// ── bullet:stagger ────────────────────────────────────────────────────────────
describe("createKnockbackSystem — bullet:stagger", () => {
  beforeEach(() => Core._reset());

  it("applies Stagger component on bullet:stagger event", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    const s = Core.getComponent(eid, "Stagger");
    expect(s).toBeDefined();
    expect(s.duration).toBe(0.6);
    expect(s.remaining).toBe(0.6);
  });

  it("emits stagger:started on first stagger", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    const started = [];
    Core.on("stagger:started", e => started.push(e));

    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    expect(started.length).toBe(1);
    expect(started[0].entityId).toBe(eid);
    expect(started[0].duration).toBe(0.6);
  });

  it("does NOT emit stagger:started if already staggered", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    const started = [];
    Core.on("stagger:started", e => started.push(e));

    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 }); // second hit

    expect(started.length).toBe(0);
  });

  it("refreshes remaining to max on repeated stagger", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });
    sys(0.3, Core); // burn half the duration

    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 }); // re-stagger

    const s = Core.getComponent(eid, "Stagger");
    expect(s.remaining).toBeCloseTo(0.6); // reset to max
  });

  it("removes Stagger component after duration expires", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    sys(0.7, Core); // past 0.6s

    expect(Core.getComponent(eid, "Stagger")).toBeUndefined();
  });

  it("emits stagger:ended when Stagger expires", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    const ended = [];
    Core.on("stagger:ended", e => ended.push(e));

    sys(0.7, Core);

    expect(ended.length).toBe(1);
    expect(ended[0].entityId).toBe(eid);
  });

  it("ignores stagger for entity without EnemyAI", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEntity(); // no EnemyAI
    Core.emit("bullet:stagger", { entityId: eid, duration: 0.6 });

    expect(Core.getComponent(eid, "Stagger")).toBeUndefined();
  });
});

// ── grenade:stagger ───────────────────────────────────────────────────────────
describe("createKnockbackSystem — grenade:stagger", () => {
  beforeEach(() => Core._reset());

  it("applies Stagger from grenade:stagger event with duration from payload", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("grenade:stagger", { entityId: eid, duration: 1.5 });

    const s = Core.getComponent(eid, "Stagger");
    expect(s).toBeDefined();
    expect(s.remaining).toBe(1.5);
  });

  it("Stagger from grenade expires correctly", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("grenade:stagger", { entityId: eid, duration: 1.5 });

    sys(0.5, Core);
    expect(Core.getComponent(eid, "Stagger")).toBeDefined(); // still staggered

    sys(1.1, Core); // total 1.6s > 1.5s
    expect(Core.getComponent(eid, "Stagger")).toBeUndefined();
  });
});

// ── combined knockback + stagger ──────────────────────────────────────────────
describe("createKnockbackSystem — combined KB + stagger", () => {
  beforeEach(() => Core._reset());

  it("entity can have both Knockback and Stagger simultaneously", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy();
    Core.emit("bullet:knockback", { entityId: eid, kbU: 3.5, kbV: 0, kbT: 0.1 });
    Core.emit("bullet:stagger",   { entityId: eid, duration: 0.6 });

    expect(Core.getComponent(eid, "Knockback")).toBeDefined();
    expect(Core.getComponent(eid, "Stagger")).toBeDefined();
  });

  it("knockback moves entity even while staggered", () => {
    const sys = createKnockbackSystem();
    sys(0, Core);

    const eid = makeEnemy(0, 0);
    Core.emit("bullet:knockback", { entityId: eid, kbU: 10, kbV: 0, kbT: 0.5 });
    Core.emit("bullet:stagger",   { entityId: eid, duration: 1.0 });

    sys(0.1, Core);

    const t = Core.getComponent(eid, "Transform");
    expect(t.u).toBeGreaterThan(0); // still pushed by KB
    expect(Core.getComponent(eid, "Stagger")).toBeDefined(); // still staggered
  });
});
