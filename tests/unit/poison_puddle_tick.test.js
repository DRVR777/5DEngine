import { it, expect, describe } from "vitest";
import { mountPoisonPuddleTick } from "../../src/systems/poison_puddle_tick.js";

function makeMesh() {
  return { material: { opacity: 0.5 } };
}

function makePuddle(id, { u = 5, v = 5, timeLeft = 3.0, radius = 1.5, applyT = 0.8 } = {}) {
  return { id, u, v, timeLeft, radius, applyT, mesh: makeMesh() };
}

function makeState() {
  const removed = [], poisonCalls = [];
  return {
    actions: {
      removeMesh: mesh => removed.push(mesh),
      applyPoison: () => poisonCalls.push(1),
    },
    removed, poisonCalls,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("poison_puddle_tick — decay", () => {
  it("timeLeft counts down", () => {
    const puddles = [makePuddle("p1", { u: 5, v: 5 })];
    const { actions } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: puddles });
    expect(puddles[0].timeLeft).toBeCloseTo(2.9);
  });

  it("timeLeft ≤ 0 → removed from array", () => {
    const puddles = [makePuddle("p1", { u: 5, v: 5, timeLeft: 0.01 })];
    const { actions } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: puddles });
    expect(puddles.length).toBe(0);
  });

  it("expired → removeMesh called", () => {
    const puddle = makePuddle("p1", { u: 5, v: 5, timeLeft: 0.01 });
    const { actions, removed } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: [puddle] });
    expect(removed).toContain(puddle.mesh);
  });

  it("opacity flickers with time", () => {
    const puddle = makePuddle("p1", { u: 5, v: 5, timeLeft: 3.0 });
    const { actions } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.016, { ...BASE, nowMs: 0, pickups: [puddle] });
    const expected = 0.5 * Math.min(1, 3.0 / 1.0) * (1 - 0.3 + 0.3 * Math.sin(0 / 200));
    expect(puddle.mesh.material.opacity).toBeCloseTo(expected);
  });

  it("opacity fades as timeLeft drops below FADE_WINDOW", () => {
    const puddle = makePuddle("p1", { u: 5, v: 5, timeLeft: 0.5 });
    const { actions } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.016, { ...BASE, nowMs: 0, pickups: [puddle] });
    expect(puddle.mesh.material.opacity).toBeLessThan(0.5);
  });
});

describe("poison_puddle_tick — hero damage", () => {
  it("hero inside radius → applyPoison called when applyT hits 0", () => {
    const puddle = makePuddle("p1", { u: 0.5, v: 0, radius: 1.5, applyT: 0.01 });
    const { actions, poisonCalls } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: [puddle] });
    expect(poisonCalls.length).toBeGreaterThan(0);
  });

  it("hero inside radius but applyT still counting → no poison yet", () => {
    const puddle = makePuddle("p1", { u: 0.5, v: 0, radius: 1.5, applyT: 0.8 });
    const { actions, poisonCalls } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.016, { ...BASE, pickups: [puddle] });
    expect(poisonCalls.length).toBe(0);
  });

  it("hero outside radius → applyPoison not called", () => {
    const puddle = makePuddle("p1", { u: 5, v: 5, radius: 1.5, applyT: 0.0 });
    const { actions, poisonCalls } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: [puddle] });
    expect(poisonCalls.length).toBe(0);
  });

  it("applyT resets to 0.8 after trigger", () => {
    const puddle = makePuddle("p1", { u: 0.5, v: 0, radius: 1.5, applyT: 0.01 });
    const { actions } = makeState();
    mountPoisonPuddleTick({ actions }).tick(0.1, { ...BASE, pickups: [puddle] });
    expect(puddle.applyT).toBeCloseTo(0.8);
  });
});

describe("poison_puddle_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) =>
        makePuddle(`p${j}`, {
          u: (Math.random() - 0.5) * 10, v: (Math.random() - 0.5) * 10,
          timeLeft: Math.random() * 5, radius: 0.5 + Math.random() * 2,
          applyT: Math.random() * 1.0,
        })
      );
      const { actions } = makeState();
      expect(() =>
        mountPoisonPuddleTick({ actions }).tick(0.016, {
          heroU: Math.random() * 5, heroV: Math.random() * 5,
          nowMs: Math.random() * 60000, pickups,
        })
      ).not.toThrow();
    }
  });
});
