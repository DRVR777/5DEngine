import { describe, it, expect, vi, beforeEach } from "vitest";
import { mountEnemyMeshTick } from "../../src/systems/enemy_mesh_tick.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeActions(overrides = {}) {
  return {
    getCamYaw: () => 0,
    getPos: (id) => ({ u: 1, v: 2, y: 0 }),
    spawnParticles: vi.fn(),
    spawnClearPos: vi.fn(() => ({ u: 10, v: 10 })),
    setPos: vi.fn(),
    markHudDirty: vi.fn(),
    ...overrides,
  };
}

function makeEnemy(overrides = {}) {
  return {
    id: "en_1",
    type: "grunt",
    hp: 10,
    maxHp: 10,
    dead: false,
    heading: 0,
    respawnT: performance.now() / 1000,
    _wasChasing: false,
    _heardShot: 0,
    _meshChildren: [],
    ...overrides,
  };
}

function makeMesh(overrides = {}) {
  const group = {
    position: { set: vi.fn() },
    rotation: { x: 0, y: 0 },
    scale: { setScalar: vi.fn() },
    visible: true,
  };
  const hpFg = {
    scale: { x: 1 },
    position: { x: 0 },
    material: { color: { setHex: vi.fn() } },
  };
  const hpPivot = { visible: true, rotation: { y: 0 } };
  return { group, hpFg, hpPivot, _alertBubble: null, _typeGem: null, ...overrides };
}

// ─── Bug 2: enemy death animation ─────────────────────────────────────────────

describe("tickDead — fall animation", () => {
  it("plays the collapse animation when elapsed < COLLAPSE_DUR (0.6s)", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ dead: true, respawnT: performance.now() / 1000 - 0.1 }); // 100ms into death
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 999);

    expect(em.group.rotation.x).toBeGreaterThan(0);  // pitched forward
    expect(em.group.visible).toBe(true);
  });

  it("hides the mesh after COLLAPSE_DUR (0.6s) has elapsed", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ dead: true, respawnT: performance.now() / 1000 - 1.0 }); // 1s into death
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 999);

    expect(em.group.visible).toBe(false);
    expect(em.group.rotation.x).toBe(0);   // reset for respawn
  });

  it("rotation.x approaches Math.PI/2 at end of fall (f→1)", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    // 0.59s in — f = 0.59/0.6 ≈ 0.983, rotation.x ≈ 1.54 rad
    const en = makeEnemy({ dead: true, respawnT: performance.now() / 1000 - 0.59 });
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 999);

    expect(em.group.rotation.x).toBeCloseTo(Math.PI * 0.5, 0);  // close to 90°
  });

  it("scale shrinks toward 0.5 by end of fall animation", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ dead: true, respawnT: performance.now() / 1000 - 0.59 });
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 999);

    // scale = 1 - f*0.5, f≈0.983 → scale ≈ 0.508
    const scaleCalls = em.group.scale.setScalar.mock.calls;
    expect(scaleCalls.length).toBeGreaterThan(0);
    expect(scaleCalls[scaleCalls.length - 1][0]).toBeGreaterThan(0.5);
    expect(scaleCalls[scaleCalls.length - 1][0]).toBeLessThan(1.0);
  });

  it("respawns non-spawned enemy after respawnDelay", () => {
    const setPos = vi.fn();
    const tick = mountEnemyMeshTick({ actions: makeActions({ setPos }) });
    const en = makeEnemy({ id: "en_wave_1", dead: true, respawnT: performance.now() / 1000 - 30 });
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 20); // delay=20s, elapsed=30s → respawn

    expect(en.dead).toBe(false);
    expect(en.hp).toBe(en.maxHp);
    expect(setPos).toHaveBeenCalled();
  });

  it("does NOT respawn en_spawned_ enemies", () => {
    const setPos = vi.fn();
    const tick = mountEnemyMeshTick({ actions: makeActions({ setPos }) });
    const en = makeEnemy({ id: "en_spawned_abc", dead: true, respawnT: performance.now() / 1000 - 30 });
    const em = makeMesh();

    tick.tickDead(en, em, performance.now(), 20);

    expect(setPos).not.toHaveBeenCalled();
    expect(en.dead).toBe(true); // still dead
  });
});

// ─── Bug 4: Three.js .value TypeError guard ──────────────────────────────────

describe("tickAlive — hpFg guard and NaN prevention", () => {
  it("does not throw when em.hpFg is undefined (missing on some enemy types)", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ hp: 5, maxHp: 10 });
    const em = makeMesh({ hpFg: undefined });  // missing hpFg

    expect(() => tick.tickAlive(en, em, 0.016, performance.now())).not.toThrow();
  });

  it("does not throw when en.maxHp is 0 (prevents NaN hpFrac → three.js .value error)", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ hp: 0, maxHp: 0 });
    const em = makeMesh();

    expect(() => tick.tickAlive(en, em, 0.016, performance.now())).not.toThrow();
  });

  it("clamps hpFrac to 0 when hp is negative (no NaN, no negative bar)", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ hp: -5, maxHp: 10 });
    const em = makeMesh();

    tick.tickAlive(en, em, 0.016, performance.now());

    // hpFg.scale.x must be max(0.001, 0) = 0.001 — never negative or NaN
    expect(em.hpFg.scale.x).toBeCloseTo(0.001);
  });

  it("sets hpFg.scale.x to 1 at full health", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ hp: 10, maxHp: 10 });
    const em = makeMesh();

    tick.tickAlive(en, em, 0.016, performance.now());

    expect(em.hpFg.scale.x).toBeCloseTo(1.0);
  });
});

// ─── tickEntry routing ────────────────────────────────────────────────────────

describe("tickEntry — routes dead enemy to tickDead", () => {
  it("calls tickDead (not tickAlive) for a dead enemy", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ dead: true, respawnT: performance.now() / 1000 - 0.1 });
    const em = makeMesh();

    // If tickDead was called, em.group.rotation.x will be > 0 (fall in progress)
    tick.tickEntry(en, em, 0.016, performance.now(), 999);

    expect(em.group.rotation.x).toBeGreaterThan(0);
  });

  it("does not tip enemy (rotation.x stays 0) for alive enemy", () => {
    const tick = mountEnemyMeshTick({ actions: makeActions() });
    const en = makeEnemy({ dead: false });
    const em = makeMesh();

    tick.tickEntry(en, em, 0.016, performance.now(), 999);

    // tickAlive sets rotation.x to flinchX which starts at 0
    expect(em.group.rotation.x).toBeCloseTo(0);
  });
});
