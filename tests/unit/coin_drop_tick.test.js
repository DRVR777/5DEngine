import { it, expect, describe } from "vitest";
import { mountCoinDropTick } from "../../src/systems/coin_drop_tick.js";

function makeMesh(u = 0, v = 0) {
  return { rotation: { y: 0 }, position: { x: u, y: 0.5, z: v } };
}

function makeCoin(id, { u = 5, v = 5, value = 10 } = {}) {
  return { id, u, v, value, mesh: makeMesh(u, v) };
}

function makeState() {
  let score = 0;
  const sfx = [], dmgNums = [], removed = [], scoreAdds = [];
  return {
    actions: {
      removeMesh: mesh => removed.push(mesh),
      addScore: v => { score += v; scoreAdds.push(v); },
      playSfx: (str, vol) => sfx.push({ str, vol }),
      spawnDamageNumber: (u, y, v, text, color) => dmgNums.push({ u, y, v, text, color }),
    },
    getScore: () => score,
    sfx, dmgNums, removed, scoreAdds,
  };
}

const BASE = { heroU: 0, heroV: 0, nowMs: 1000 };

describe("coin_drop_tick — collection", () => {
  it("coin within 1.2m → removed from array", () => {
    const pickups = [makeCoin("c1", { u: 0.5, v: 0 })];
    const { actions } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(0);
  });

  it("collection → addScore called with coin value", () => {
    const pickups = [makeCoin("c1", { u: 0.5, v: 0, value: 15 })];
    const { actions, scoreAdds } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(scoreAdds).toContain(15);
  });

  it("collection → damage number shows +value in gold", () => {
    const pickups = [makeCoin("c1", { u: 0.5, v: 0, value: 7 })];
    const { actions, dmgNums } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(dmgNums[0].text).toBe("+7");
    expect(dmgNums[0].color).toBe("#ffd166");
  });

  it("collection → playSfx called (blip)", () => {
    const pickups = [makeCoin("c1", { u: 0.5, v: 0 })];
    const { actions, sfx } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(sfx[0].str).toBe("blip");
  });

  it("coin beyond range → not collected", () => {
    const pickups = [makeCoin("c1", { u: 5, v: 5 })];
    const { actions } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups });
    expect(pickups.length).toBe(1);
  });
});

describe("coin_drop_tick — animation", () => {
  it("distant coin → rotation.y increases", () => {
    const coin = makeCoin("c1", { u: 5, v: 5 });
    const { actions } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups: [coin] });
    expect(coin.mesh.rotation.y).toBeGreaterThan(0);
  });

  it("within magnet range → pulled toward hero", () => {
    const coin = makeCoin("c1", { u: 2, v: 0 });
    const origU = coin.u;
    const { actions } = makeState();
    mountCoinDropTick({ actions }).tick(0.1, { ...BASE, pickups: [coin] });
    expect(coin.u).toBeLessThan(origU);
    expect(coin.mesh.position.x).toBeCloseTo(coin.u);
  });

  it("beyond magnet range → no position change", () => {
    const coin = makeCoin("c1", { u: 5, v: 0 });
    const origU = coin.u;
    const { actions } = makeState();
    mountCoinDropTick({ actions }).tick(0.016, { ...BASE, pickups: [coin] });
    expect(coin.u).toBe(origU);
  });
});

describe("coin_drop_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const pickups = Array.from({ length: Math.floor(Math.random() * 6) }, (_, j) =>
        makeCoin(`c${j}`, { u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10, value: Math.ceil(Math.random()*20) })
      );
      const { actions } = makeState();
      expect(() =>
        mountCoinDropTick({ actions }).tick(0.016, {
          heroU: Math.random()*5, heroV: Math.random()*5, nowMs: Math.random()*60000, pickups,
        })
      ).not.toThrow();
    }
  });
});
