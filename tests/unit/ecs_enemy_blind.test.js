import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnemyBlindSystem,
  FLASH_RADIUS, FLASH_NEAR_SCALE, FLASH_BASE,
} from "../../src/systems/ecs_enemy_blind.js";
import Core from "../../src/core/core.js";

function makeEnemy(u = 0, v = 0) {
  const id = Core.createEntity();
  Core.addComponent(id, "Transform", { u, v, y: 0 });
  Core.addComponent(id, "Health",    { hp: 80, maxHp: 80 });
  Core.addComponent(id, "EnemyAI",   { type: "grunt", heading: 0 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("enemy blind constants — monolith lines 2390/2395 parity", () => {
  it("FLASH_RADIUS = 6  (line 2390: FLASH_R = 6)",           () => expect(FLASH_RADIUS).toBe(6));
  it("FLASH_NEAR_SCALE = 2.5  (line 2395: coefficient)",    () => expect(FLASH_NEAR_SCALE).toBe(2.5));
  it("FLASH_BASE = 0.5  (line 2395: baseline blind seconds)", () => expect(FLASH_BASE).toBe(0.5));
});

// ── Blind application ─────────────────────────────────────────────────────────
describe("createEnemyBlindSystem — blind application on grenade:flash_explode", () => {
  beforeEach(() => Core._reset());

  it("enemy at centre (d=0) is blinded for NEAR_SCALE + BASE = 3.0s", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(0, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBeCloseTo(3.0, 5);
  });

  it("enemy at midpoint (d=3) is blinded for 1.75s", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(3, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBeCloseTo(1.75, 5);
  });

  it("enemy just inside radius (d=5.9) is blinded for > FLASH_BASE", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(5.9, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBeGreaterThan(FLASH_BASE);
  });

  it("enemy at exact radius (d=6) is NOT blinded", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(FLASH_RADIUS, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT ?? 0).toBe(0);
  });

  it("enemy outside radius (d=7) is NOT blinded", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(7, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT ?? 0).toBe(0);
  });

  it("emits enemy:blinded with entityId and duration for hit enemies", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(0, 0);

    const events = [];
    Core.on("enemy:blinded", e => events.push(e));
    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    expect(events.length).toBe(1);
    expect(events[0].entityId).toBe(eid);
    expect(events[0].duration).toBeCloseTo(3.0, 5);
  });

  it("does NOT emit enemy:blinded for enemy outside radius", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    makeEnemy(10, 0);

    const events = [];
    Core.on("enemy:blinded", e => events.push(e));
    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    expect(events.length).toBe(0);
  });

  it("closer enemy is blinded longer than farther enemy", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const near = makeEnemy(1, 0);
    const far  = makeEnemy(4, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 });

    const nearT = Core.getComponent(near, "EnemyAI")._blindT;
    const farT  = Core.getComponent(far,  "EnemyAI")._blindT;
    expect(nearT).toBeGreaterThan(farT);
  });

  it("second flash overwrites existing blindT", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(0, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 }); // blindT = 3.0
    sys(0.5, Core);                                       // blindT = 2.5
    Core.emit("grenade:flash_explode", { u: 5, v: 0 }); // d=5 → 2.5*(1-5/6)+0.5 ≈ 0.917

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBeCloseTo(2.5 * (1 - 5 / 6) + 0.5, 5);
  });

  it("does not crash with no enemies", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    expect(() => Core.emit("grenade:flash_explode", { u: 0, v: 0 })).not.toThrow();
  });
});

// ── Blind tick-down ───────────────────────────────────────────────────────────
describe("createEnemyBlindSystem — tick-down", () => {
  beforeEach(() => Core._reset());

  it("decrements ai._blindT by dt each tick", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(0, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 }); // blindT = 3.0

    sys(1, Core);

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBeCloseTo(2.0, 5);
  });

  it("ai._blindT does not go below 0", () => {
    const sys = createEnemyBlindSystem();
    sys.wireListeners(Core);
    const eid = makeEnemy(0, 0);

    Core.emit("grenade:flash_explode", { u: 0, v: 0 }); // blindT = 3.0

    sys(10, Core); // dt=10 >> 3.0

    const ai = Core.getComponent(eid, "EnemyAI");
    expect(ai._blindT).toBe(0);
  });
});
