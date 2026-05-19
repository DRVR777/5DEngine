import { it, expect, describe } from "vitest";
import { mountEnemySepTick } from "../../src/systems/enemy_sep_tick.js";

function makeWorld(positions) {
  const store = { ...positions };
  const setPosLog = [];
  return {
    actions: {
      getPos: id => store[id] ? { ...store[id] } : null,
      setPos: (id, x, y, z, u, v) => { setPosLog.push({ id, u, v }); store[id] = { ...store[id], u, v }; },
    },
    store,
    setPosLog,
  };
}

function makeEnemy(id, { u = 0, v = 0, dead = false } = {}) {
  return { id, dead };
}

describe("enemy_sep_tick — no-op guards", () => {
  it("dead enemy skipped — no setPos", () => {
    const ea = makeEnemy("a", { u: 0, v: 0 });
    const eb = makeEnemy("b", { u: 0.5, v: 0 });
    ea.dead = true;
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(0);
  });

  it("both dead — no setPos", () => {
    const ea = makeEnemy("a"); ea.dead = true;
    const eb = makeEnemy("b"); eb.dead = true;
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(0);
  });

  it("missing pos for enemy — no throw, skips pair", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    const { actions, setPosLog } = makeWorld({ b: { x: 0, u: 0.5, v: 0 } }); // a has no pos
    expect(() => mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] })).not.toThrow();
    expect(setPosLog.length).toBe(0);
  });

  it("enemies far apart (> SEP_DIST both axes) — no setPos", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    // dU=5, dV=5 both > 1.2 → AABB early-out
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 5, v: 5 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(0);
  });

  it("enemies at exact SEP_DIST — no push (d not < SEP_DIST)", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    // d=1.2 exactly — not < 1.2 so no push
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 1.2, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(0);
  });

  it("enemies at zero distance — no push (d not > 0.001)", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(0);
  });
});

describe("enemy_sep_tick — push behavior", () => {
  it("overlapping enemies → both pushed apart", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    // d=0.5 < 1.2 → push applied
    const { actions, setPosLog } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(setPosLog.length).toBe(2);
    expect(setPosLog[0].id).toBe("a");
    expect(setPosLog[1].id).toBe("b");
  });

  it("ea pushed away from eb (u increases when ea.u < eb.u → dU<0)", () => {
    const ea = makeEnemy("a");
    const eb = makeEnemy("b");
    // ea at u=0, eb at u=0.5 → dU = 0-0.5 = -0.5, so ea should move toward negative u
    const { actions, store } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb] });
    expect(store.a.u).toBeLessThan(0); // pushed left
    expect(store.b.u).toBeGreaterThan(0.5); // pushed right
  });

  it("push magnitude scales with dt", () => {
    const ea1 = makeEnemy("a"); const eb1 = makeEnemy("b");
    const { actions: a1, store: s1 } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions: a1 }).tick(0.016, { enemies: [ea1, eb1] });

    const ea2 = makeEnemy("a"); const eb2 = makeEnemy("b");
    const { actions: a2, store: s2 } = makeWorld({ a: { x: 0, u: 0, v: 0 }, b: { x: 0, u: 0.5, v: 0 } });
    mountEnemySepTick({ actions: a2 }).tick(0.032, { enemies: [ea2, eb2] });

    // Larger dt → larger push
    expect(Math.abs(s2.a.u)).toBeGreaterThan(Math.abs(s1.a.u));
  });

  it("three enemies — each overlapping pair is separated", () => {
    const ea = makeEnemy("a"); const eb = makeEnemy("b"); const ec = makeEnemy("c");
    const { actions, setPosLog } = makeWorld({
      a: { x: 0, u: 0, v: 0 },
      b: { x: 0, u: 0.3, v: 0 },
      c: { x: 0, u: 0.6, v: 0 },
    });
    mountEnemySepTick({ actions }).tick(0.016, { enemies: [ea, eb, ec] });
    // pairs: (a,b), (a,c), (b,c) — all within SEP_DIST
    expect(setPosLog.length).toBeGreaterThanOrEqual(2);
  });

  it("empty enemies array — no throw", () => {
    const { actions } = makeWorld({});
    expect(() => mountEnemySepTick({ actions }).tick(0.016, { enemies: [] })).not.toThrow();
  });
});

describe("enemy_sep_tick — fuzz", () => {
  it("never throws for 30 random states", () => {
    for (let i = 0; i < 30; i++) {
      const count = Math.floor(Math.random() * 6);
      const positions = {};
      const enemies = Array.from({ length: count }, (_, j) => {
        const id = `e${j}`;
        positions[id] = { x: 0, u: (Math.random() - 0.5) * 4, v: (Math.random() - 0.5) * 4 };
        return { id, dead: Math.random() > 0.7 };
      });
      const { actions } = makeWorld(positions);
      expect(() => mountEnemySepTick({ actions }).tick(0.016, { enemies })).not.toThrow();
    }
  });
});
