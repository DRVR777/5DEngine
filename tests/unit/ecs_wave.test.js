import { describe, it, expect, beforeEach } from "vitest";
import { createWaveSystem } from "../../src/systems/ecs_wave.js";
import Core from "../../src/core/core.js";

// Tiny wave config for fast tests — 2 waves, minimal counts
const TEST_WAVES = [
  { enemies: [{ type: "grunt", count: 2 }], pauseAfter: 0.1 },
  { enemies: [{ type: "fast",  count: 1 }], pauseAfter: 0.1 },
];

function makeCtx() {
  return { getSpawnPos: () => ({ u: 5, v: 5, y: 0 }) };
}

describe("createWaveSystem", () => {
  beforeEach(() => { Core._reset(); });

  it("starts in idle phase", () => {
    const ws = createWaveSystem(TEST_WAVES);
    expect(ws.getState().phase).toBe("idle");
    expect(ws.getState().started).toBe(false);
  });

  it("transitions to countdown on start()", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx()); // first tick wires _core
    expect(ws.getState().phase).toBe("countdown");
  });

  it("emits wave:countdown on start", () => {
    const ws = createWaveSystem(TEST_WAVES);
    const events = [];
    Core.on("wave:countdown", e => events.push(e));
    ws.start(Core);
    ws(0, Core, makeCtx());
    expect(events.length).toBe(1);
    expect(events[0].wave).toBe(1);
  });

  it("transitions countdown → spawning after 5s", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());  // enter countdown
    ws(5.1, Core, makeCtx()); // fast-forward past countdown
    expect(ws.getState().phase).toBe("spawning");
  });

  it("emits wave:start when spawning begins", () => {
    const ws = createWaveSystem(TEST_WAVES);
    const events = [];
    Core.on("wave:start", e => events.push(e));
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws(5.1, Core, makeCtx());
    expect(events.length).toBe(1);
    expect(events[0].wave).toBe(1);
    expect(events[0].total).toBe(2); // 2 grunts in wave 1
  });

  it("emits wave:spawn_enemy when prefab not registered", () => {
    const ws = createWaveSystem(TEST_WAVES);
    const spawned = [];
    Core.on("wave:spawn_enemy", e => spawned.push(e));
    ws.start(Core);
    ws(0, Core, makeCtx());    // countdown
    ws(5.1, Core, makeCtx());  // → spawning, phase=spawning
    ws(0.4, Core, makeCtx());  // spawnTimer expires → spawn first enemy
    expect(spawned.length).toBe(1);
    expect(spawned[0].type).toBe("grunt");
  });

  it("spawns via Core.instantiate when prefab registered", () => {
    Core.registerPrefab("enemy_grunt", {
      components: {
        EnemyAI:   { type: "grunt", state: "wander", alertT: -99, lastAttackT: -99, damage: 6, attackRange: 1.6, sightRange: 12, moveSpeed: 2.4, wanderSpeed: 1.0 },
        Health:    { hp: 80, maxHp: 80, armor: 0 },
        Transform: { u: 0, v: 0, y: 0, heading: 0 },
        Faction:   { id: "enemy" },
      }
    });
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws(5.1, Core, makeCtx());  // → spawning
    ws(0.4, Core, makeCtx());  // first spawn
    const enemies = Core.query("EnemyAI", "Health");
    expect(enemies.length).toBe(1);
    // Spawn position was set from ctx.getSpawnPos()
    const t = Core.getComponent(enemies[0], "Transform");
    expect(t.u).toBe(5);
    expect(t.v).toBe(5);
  });

  it("transitions spawning → waiting after queue exhausted", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws(5.1, Core, makeCtx()); // → spawning (2 grunts queued)
    ws(0.4, Core, makeCtx()); // spawn #1
    ws(0.4, Core, makeCtx()); // spawn #2
    ws(0.4, Core, makeCtx()); // queue empty → waiting
    expect(ws.getState().phase).toBe("waiting");
  });

  it("waiting → pausing when alive count drops to 0", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws(5.1, Core, makeCtx()); // spawning
    ws(0.4, Core, makeCtx()); ws(0.4, Core, makeCtx()); ws(0.4, Core, makeCtx()); // queue → waiting
    ws(0.01, Core, makeCtx()); // waiting tick: aliveCount=0 → pausing
    expect(ws.getState().phase).toBe("pausing");
  });

  it("pausing → countdown after pauseAfter elapses", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws(5.1, Core, makeCtx()); // spawning
    ws(0.4, Core, makeCtx()); ws(0.4, Core, makeCtx()); ws(0.4, Core, makeCtx()); // queue → waiting
    ws(0.01, Core, makeCtx()); // waiting tick → pausing
    ws(0.2, Core, makeCtx());  // pauseAfter=0.1 elapsed → countdown for wave 2
    expect(ws.getState().phase).toBe("countdown");
    expect(ws.getState().wave).toBe(2);
  });

  it("loops back to wave 1 after all waves complete", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    // Simulate through all waves rapidly
    for (let i = 0; i < 200; i++) ws(0.5, Core, makeCtx());
    // Should have completed multiple cycles — totalWave > 2 means at least 1 full loop
    const state = ws.getState();
    expect(state.totalWave).toBeGreaterThanOrEqual(3);
  });

  it("stop() returns to idle", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    ws(0, Core, makeCtx());
    ws.stop();
    ws(5.1, Core, makeCtx()); // ticks do nothing in idle
    expect(ws.getState().phase).toBe("idle");
  });

  it("emits wave:all_complete after last wave clears", () => {
    const ws = createWaveSystem(TEST_WAVES);
    const allDone = [];
    Core.on("wave:all_complete", e => allDone.push(e));
    ws.start(Core);
    for (let i = 0; i < 200; i++) ws(0.5, Core, makeCtx());
    expect(allDone.length).toBeGreaterThanOrEqual(1);
  });

  it("totalWave increments each wave start and never resets on loop", () => {
    const ws = createWaveSystem(TEST_WAVES);
    ws.start(Core);
    for (let i = 0; i < 200; i++) ws(0.5, Core, makeCtx());
    expect(ws.getState().totalWave).toBeGreaterThanOrEqual(2); // 2 waves + at least one loop
  });
});
