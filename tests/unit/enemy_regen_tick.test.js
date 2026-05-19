import { it, expect, describe } from "vitest";
import { mountEnemyRegenTick } from "../../src/systems/enemy_regen_tick.js";

function makeActions() {
  const dmgLog = [];
  return {
    actions: {
      getPos: id => ({ u: 5, v: 5 }),
      spawnDamageNumber: (u, y, v, text, color) => dmgLog.push({ u, y, v, text, color }),
    },
    dmgLog,
  };
}

function makeEnemy({ hp = 50, maxHp = 100, dead = false, wasChasing = false, hpBarShowT = null, regenT = 0 } = {}) {
  return { id: "en1", hp, maxHp, dead, _wasChasing: wasChasing, _hpBarShowT: hpBarShowT, _regenT: regenT };
}

const BASE = { nowSec: 100, enemies: [] };

describe("enemy_regen_tick — no-op guards", () => {
  it("dead enemy → hp unchanged", () => {
    const en = makeEnemy({ hp: 50, dead: true });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBe(50);
  });

  it("hp at max → hp unchanged", () => {
    const en = makeEnemy({ hp: 100, maxHp: 100 });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBe(100);
  });

  it("recent damage (< 8s) → hp unchanged", () => {
    const en = makeEnemy({ hp: 50, hpBarShowT: 99 }); // nowSec=100, dmg 1s ago < 8s
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBe(50);
  });

  it("recent damage → _regenT reset to 0", () => {
    const en = makeEnemy({ hp: 50, hpBarShowT: 99, regenT: 1.0 });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en._regenT).toBe(0);
  });

  it("chasing → hp unchanged", () => {
    const en = makeEnemy({ hp: 50, wasChasing: true });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBe(50);
  });
});

describe("enemy_regen_tick — regen applies", () => {
  it("out of combat + not chasing → hp increases by 4*dt", () => {
    const en = makeEnemy({ hp: 50, hpBarShowT: 80 }); // nowSec=100, dmg 20s ago > 8s
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBeCloseTo(50 + 4 * 0.016);
  });

  it("regen does not exceed maxHp", () => {
    const en = makeEnemy({ hp: 99.99, maxHp: 100 });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(1.0, { ...BASE, enemies: [en] });
    expect(en.hp).toBeCloseTo(100);
  });

  it("no hpBarShowT (null) → treated as out of combat", () => {
    const en = makeEnemy({ hp: 50, hpBarShowT: null });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en.hp).toBeCloseTo(50 + 4 * 0.016);
  });
});

describe("enemy_regen_tick — regenT timer and +HP visual", () => {
  it("regenT decrements each frame", () => {
    const en = makeEnemy({ hp: 50, regenT: 1.0 });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en._regenT).toBeCloseTo(1.0 - 0.016);
  });

  it("regenT <= 0 → spawns +HP damage number", () => {
    const en = makeEnemy({ hp: 50, regenT: -0.01 });
    const { actions, dmgLog } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(dmgLog.length).toBeGreaterThanOrEqual(1);
    expect(dmgLog[0].text).toBe("+HP");
    expect(dmgLog[0].color).toBe("#00ff66");
  });

  it("regenT resets to 1.8 after trigger", () => {
    const en = makeEnemy({ hp: 50, regenT: -0.01 });
    const { actions } = makeActions();
    mountEnemyRegenTick({ actions }).tick(0.016, { ...BASE, enemies: [en] });
    expect(en._regenT).toBeCloseTo(1.8); // reset to 1.8 (no further decrement this frame)
  });
});

describe("enemy_regen_tick — fuzz", () => {
  it("never throws for 25 random states", () => {
    for (let i = 0; i < 25; i++) {
      const { actions } = makeActions();
      const enemies = Array.from({ length: 3 }, (_, j) => makeEnemy({
        hp: Math.random() * 100, maxHp: 100, dead: Math.random() > 0.8,
        wasChasing: Math.random() > 0.6, hpBarShowT: Math.random() > 0.5 ? Math.random() * 100 : null,
        regenT: (Math.random() - 0.5) * 2,
      }));
      expect(() => mountEnemyRegenTick({ actions }).tick(0.016, { nowSec: Math.random() * 200, enemies })).not.toThrow();
    }
  });
});
