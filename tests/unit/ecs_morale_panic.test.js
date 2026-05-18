import { describe, it, expect, beforeEach } from "vitest";
import {
  createMoralePanicSystem,
  MORALE_KILL_WINDOW, MORALE_KILL_THRESHOLD,
  MORALE_PANIC_RADIUS, MORALE_PANIC_DUR,
  MORALE_PANIC_SPEED_MUL, MORALE_BROADCAST_CD,
} from "../../src/systems/ecs_morale_panic.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0, hp = 80) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp, maxHp: hp });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0, moveSpeed: 2.4, sightRange: 12 });
  return id;
}

function makeHero(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "PlayerControl", { active: true });
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 100, maxHp: 100 });
  return id;
}

function emitKill(u, v) {
  Core.emit("enemy:killed", { entityId: null, type: "grunt", heroId: null, u, v });
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("morale panic constants — monolith lines 1231 / 1315-1327 / 7126-7152 parity", () => {
  it("MORALE_KILL_WINDOW = 4.0 (line 1316)",     () => expect(MORALE_KILL_WINDOW).toBe(4.0));
  it("MORALE_KILL_THRESHOLD = 3 (line 1317)",    () => expect(MORALE_KILL_THRESHOLD).toBe(3));
  it("MORALE_PANIC_RADIUS = 10 (line 1325)",     () => expect(MORALE_PANIC_RADIUS).toBe(10));
  it("MORALE_PANIC_DUR = 3.0 (line 1325)",       () => expect(MORALE_PANIC_DUR).toBe(3.0));
  it("MORALE_PANIC_SPEED_MUL = 1.3 (line 7133)", () => expect(MORALE_PANIC_SPEED_MUL).toBeCloseTo(1.3));
  it("MORALE_BROADCAST_CD = 4.0 (line 1317)",    () => expect(MORALE_BROADCAST_CD).toBe(4.0));
});

// ── Panic broadcast trigger ───────────────────────────────────────────────────
describe("createMoralePanicSystem — panic trigger", () => {
  beforeEach(() => Core._reset());

  it("emits morale:panic_broadcast after 3 kills within 4s", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5);
    makeHero();
    sys(0.1, Core); // wire listener

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 0);
    emitKill(0, 1);
    emitKill(0, 2);

    sys(0.1, Core); // process: 3 kills → panic

    expect(broadcasts.length).toBe(1);
  });

  it("panic_broadcast includes count of panicked enemies", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5);
    makeEnemy(0, 6);
    makeHero();
    sys(0.1, Core);

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 5); emitKill(0, 6); emitKill(0, 7);
    sys(0.1, Core);

    expect(broadcasts[0].count).toBe(2);
  });

  it("does NOT emit with fewer than 3 kills", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5);
    makeHero();
    sys(0.1, Core);

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 0); emitKill(0, 1); // only 2 kills
    sys(0.1, Core);

    expect(broadcasts.length).toBe(0);
  });

  it("kills older than 4s are pruned and don't count toward threshold", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5);
    makeHero();
    sys(0.1, Core); // wire; elapsed=0.1

    emitKill(0, 0); emitKill(0, 1); // 2 kills at ~0.1s
    sys(4.1, Core); // elapsed=4.2 → first 2 kills are 4.1s old → pruned

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 2); // 1 fresh kill
    sys(0.1, Core); // 1 kill < 3 → no panic

    expect(broadcasts.length).toBe(0);
  });

  it("only panics enemies within 10m of a kill position", () => {
    const sys = createMoralePanicSystem();
    const near = makeEnemy(0, 5);  // 5m from kill at (0,0)
    const far  = makeEnemy(0, 15); // 15m from kill at (0,0) — too far
    makeHero();
    sys(0.1, Core);

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 0); emitKill(0, 1); emitKill(0, 2);
    sys(0.1, Core);

    // _panicT is set to MORALE_PANIC_DUR then decremented by dt in same tick
    expect(Core.getComponent(near, "EnemyAI")._panicT).toBeGreaterThan(0);
    expect(Core.getComponent(far,  "EnemyAI")._panicT).toBeUndefined();
  });

  it("dead enemies are not panicked", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 5, 0); // hp=0
    makeHero();
    sys(0.1, Core);

    emitKill(0, 0); emitKill(0, 1); emitKill(0, 2);
    sys(0.1, Core);

    expect(Core.getComponent(eid, "EnemyAI")._panicT).toBeUndefined();
  });

  it("broadcast CD: does not re-trigger within 4s of last broadcast", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5);
    makeHero();
    sys(0.1, Core);

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 0); emitKill(0, 1); emitKill(0, 2);
    sys(0.1, Core); // first broadcast

    emitKill(0, 3); emitKill(0, 4); emitKill(0, 5);
    sys(3.5, Core); // only 3.6s since broadcast < 4.0s CD

    expect(broadcasts.length).toBe(1);
  });

  it("re-triggers after 4s broadcast CD elapses", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 5); // no hero — enemy stays stationary so it remains within kill radius
    sys(0.1, Core);

    const broadcasts = [];
    Core.on("morale:panic_broadcast", e => broadcasts.push(e));

    emitKill(0, 0); emitKill(0, 1); emitKill(0, 2);
    sys(0.1, Core); // first broadcast at elapsed=0.2; _panicBroadcastT=0.2

    // Advance time so old kills age out (4.3 - 0.1 = 4.2 > 4.0 window)
    sys(4.1, Core); // elapsed=4.3; old kills pruned

    // Emit 3 fresh kills (timestamped at _elapsed=4.3) then trigger
    emitKill(0, 3); emitKill(0, 4); emitKill(0, 5);
    sys(0.1, Core); // elapsed=4.4; CD check: 4.4-0.2=4.2 ≥ 4.0 → second broadcast

    expect(broadcasts.length).toBe(2);
  });
});

// ── Flee behavior ─────────────────────────────────────────────────────────────
describe("createMoralePanicSystem — flee movement", () => {
  beforeEach(() => Core._reset());

  it("panicking enemy moves away from hero each tick", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 0);
    makeHero(0, 5); // hero north of enemy
    sys(0.1, Core);

    Core.getComponent(eid, "EnemyAI")._panicT = MORALE_PANIC_DUR;
    const before = Core.getComponent(eid, "Transform").v;
    sys(0.1, Core);
    const after = Core.getComponent(eid, "Transform").v;

    // Enemy at (0,0), hero at (0,5): flee direction is dv = 0-5 = -5 → moves south (v < 0)
    expect(after).toBeLessThan(before);
  });

  it("panicking enemy emits enemy:panicking each tick", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 0);
    makeHero(0, 5);
    sys(0.1, Core);

    Core.getComponent(eid, "EnemyAI")._panicT = MORALE_PANIC_DUR;

    const panicking = [];
    Core.on("enemy:panicking", e => panicking.push(e));
    sys(0.1, Core);

    expect(panicking.length).toBe(1);
    expect(panicking[0].entityId).toBe(eid);
  });

  it("panic expires after MORALE_PANIC_DUR seconds", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 0);
    makeHero(0, 5);
    sys(0.1, Core);

    Core.getComponent(eid, "EnemyAI")._panicT = 0.15;
    sys(0.2, Core); // expire

    const panicking = [];
    Core.on("enemy:panicking", e => panicking.push(e));
    sys(0.1, Core); // after expiry — no more panicking events

    expect(panicking.length).toBe(0);
  });

  it("flee movement uses 1.3× moveSpeed", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 0);
    makeHero(5, 0); // hero east, enemy flees west (u < 0)
    sys(0.1, Core);

    const ai = Core.getComponent(eid, "EnemyAI");
    ai._panicT = MORALE_PANIC_DUR;

    const dt = 1.0;
    sys(dt, Core);

    const t = Core.getComponent(eid, "Transform");
    // Expected: du = -1 * moveSpeed(2.4) * 1.3 * dt(1.0) = -3.12
    expect(t.u).toBeCloseTo(-3.12, 2);
  });

  it("dead panicking enemy does not emit panicking event", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(0, 0, 0); // dead
    makeHero(0, 5);
    sys(0.1, Core);

    Core.getComponent(eid, "EnemyAI")._panicT = MORALE_PANIC_DUR;

    const panicking = [];
    Core.on("enemy:panicking", e => panicking.push(e));
    sys(0.1, Core);

    expect(panicking.length).toBe(0);
  });
});

// ── No hero ───────────────────────────────────────────────────────────────────
describe("createMoralePanicSystem — no hero", () => {
  beforeEach(() => Core._reset());

  it("does not crash with no hero", () => {
    const sys = createMoralePanicSystem();
    makeEnemy(0, 0);
    Core.getComponent(makeEnemy(0, 1), "EnemyAI")._panicT = 1.0;
    expect(() => sys(0.1, Core)).not.toThrow();
  });

  it("panicking enemy stays put (no movement) without a hero", () => {
    const sys = createMoralePanicSystem();
    const eid = makeEnemy(3, 4);
    sys(0.1, Core);
    Core.getComponent(eid, "EnemyAI")._panicT = MORALE_PANIC_DUR;

    const t = Core.getComponent(eid, "Transform");
    const bu = t.u, bv = t.v;
    sys(0.1, Core);

    // No hero → dx/dz = 0/0 → no movement
    expect(t.u).toBe(bu);
    expect(t.v).toBe(bv);
  });
});
