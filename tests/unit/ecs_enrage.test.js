import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnrageSystem,
  ENRAGE_HP_FRAC, ENRAGE_SPEED_MUL, WEAKENED_SPEED_MUL,
} from "../../src/systems/ecs_enrage.js";
import Core from "../../src/core/core.js";

function makeEnemy(type = "grunt", hp = 80, maxHp = 80, moveSpeed = 2.4) {
  const id = Core.createEntity();
  Core.addComponent(id, "EnemyAI",   { type, heading: 0, moveSpeed });
  Core.addComponent(id, "Health",    { hp, maxHp });
  Core.addComponent(id, "Transform", { u: 0, v: 0, y: 0 });
  return id;
}

// ── Constants parity ──────────────────────────────────────────────────────────
describe("enrage constants — monolith line 7101-7104 parity", () => {
  it("ENRAGE_HP_FRAC = 0.25 (line 7102)",    () => expect(ENRAGE_HP_FRAC).toBe(0.25));
  it("ENRAGE_SPEED_MUL = 1.35 (line 7104)",  () => expect(ENRAGE_SPEED_MUL).toBe(1.35));
  it("WEAKENED_SPEED_MUL = 0.55 (line 7104)",() => expect(WEAKENED_SPEED_MUL).toBe(0.55));
});

// ── Boss enrage ───────────────────────────────────────────────────────────────
describe("createEnrageSystem — boss enrage", () => {
  beforeEach(() => Core._reset());

  it("boss at full HP has base moveSpeed", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 1200, 1200, 1.8);
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBe(1.8);
  });

  it("boss at 24% HP gets moveSpeed × 1.35", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 288, 1200, 1.8); // 288/1200 = 0.24 < 0.25
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(1.8 * 1.35);
  });

  it("boss at exactly 25% HP is NOT enraged", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 300, 1200, 1.8); // 300/1200 = 0.25, not < 0.25
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBe(1.8);
  });

  it("emits enemy:enraged on first threshold crossing", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 288, 1200, 1.8);

    const enraged = [];
    Core.on("enemy:enraged", e => enraged.push(e));

    sys(1 / 60, Core);

    expect(enraged.length).toBe(1);
    expect(enraged[0].entityId).toBe(id);
    expect(enraged[0].type).toBe("boss");
  });

  it("does NOT emit enemy:enraged twice for same enemy", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 100, 1200, 1.8); // well below threshold

    const enraged = [];
    Core.on("enemy:enraged", e => enraged.push(e));

    sys(1 / 60, Core); // first tick — enrages
    sys(1 / 60, Core); // second tick — should not re-emit

    expect(enraged.length).toBe(1);
  });

  it("boss recovers speed when healed above 25% HP", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 100, 1200, 1.8); // enrage at start
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(1.8 * 1.35);

    // Heal back above threshold
    Core.getComponent(id, "Health").hp = 500;
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBe(1.8);
  });
});

// ── Heavy enrage ──────────────────────────────────────────────────────────────
describe("createEnrageSystem — heavy enrage", () => {
  beforeEach(() => Core._reset());

  it("heavy at < 25% HP gets moveSpeed × 1.35", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("heavy", 40, 200, 1.2); // 40/200 = 0.2 < 0.25
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(1.2 * 1.35);
  });

  it("emits enemy:enraged for heavy (not enemy:weakened)", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("heavy", 40, 200, 1.2);

    const enraged = [], weakened = [];
    Core.on("enemy:enraged", e => enraged.push(e));
    Core.on("enemy:weakened", e => weakened.push(e));

    sys(1 / 60, Core);

    expect(enraged.length).toBe(1);
    expect(enraged[0].type).toBe("heavy");
    expect(weakened.length).toBe(0);
  });
});

// ── Non-enrageable types (grunt, fast, etc.) ──────────────────────────────────
describe("createEnrageSystem — weakened types (grunt/fast/etc)", () => {
  beforeEach(() => Core._reset());

  it("grunt at < 25% HP gets moveSpeed × 0.55 (slowed)", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 10, 80, 2.4); // 10/80 = 0.125 < 0.25
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(2.4 * 0.55);
  });

  it("fast at < 25% HP gets moveSpeed × 0.55", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("fast", 5, 40, 5.0);
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(5.0 * 0.55);
  });

  it("emits enemy:weakened for grunt (not enemy:enraged)", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 10, 80, 2.4);

    const enraged = [], weakened = [];
    Core.on("enemy:enraged", e => enraged.push(e));
    Core.on("enemy:weakened", e => weakened.push(e));

    sys(1 / 60, Core);

    expect(weakened.length).toBe(1);
    expect(weakened[0].type).toBe("grunt");
    expect(enraged.length).toBe(0);
  });

  it("does NOT emit enemy:weakened twice for same enemy", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 5, 80, 2.4);

    const weakened = [];
    Core.on("enemy:weakened", e => weakened.push(e));

    sys(1 / 60, Core);
    sys(1 / 60, Core);

    expect(weakened.length).toBe(1);
  });

  it("grunt recovers base speed above 25% HP", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 10, 80, 2.4);
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(2.4 * 0.55);

    Core.getComponent(id, "Health").hp = 50; // back above threshold
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBe(2.4);
  });
});

// ── Dead enemies ──────────────────────────────────────────────────────────────
describe("createEnrageSystem — dead enemies skipped", () => {
  beforeEach(() => Core._reset());

  it("dead enemy (hp=0) does not enrage", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("boss", 0, 1200, 1.8); // dead

    const enraged = [];
    Core.on("enemy:enraged", e => enraged.push(e));

    sys(1 / 60, Core);

    expect(enraged.length).toBe(0);
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBe(1.8); // unchanged
  });
});

// ── Base speed caching ────────────────────────────────────────────────────────
describe("createEnrageSystem — base speed caching", () => {
  beforeEach(() => Core._reset());

  it("caches _baseMoveSpeed on first tick", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 80, 80, 2.4);
    sys(1 / 60, Core);
    expect(Core.getComponent(id, "EnemyAI")._baseMoveSpeed).toBe(2.4);
  });

  it("moveSpeed multiplier is based on original base, not modified speed", () => {
    const sys = createEnrageSystem();
    const id = makeEnemy("grunt", 10, 80, 2.4);
    sys(1 / 60, Core); // enters weakened
    const weakenedSpeed = Core.getComponent(id, "EnemyAI").moveSpeed;
    expect(weakenedSpeed).toBeCloseTo(2.4 * 0.55);

    sys(1 / 60, Core); // second tick — should NOT compound the multiplier
    expect(Core.getComponent(id, "EnemyAI").moveSpeed).toBeCloseTo(2.4 * 0.55); // same
  });
});
