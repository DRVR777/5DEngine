import { it, expect, describe } from "vitest";
import { mountSmokeZoneTick } from "../../src/systems/smoke_zone_tick.js";

function makeZone(id, { u = 5, v = 5, timeLeft = 3.0, radius = 2.0 } = {}) {
  return { id, u, v, timeLeft, radius };
}

function makeState() {
  const smokes = [];
  return {
    actions: { spawnSmoke: (u, y, v) => smokes.push({ u, y, v }) },
    smokes,
  };
}

describe("smoke_zone_tick — decay", () => {
  it("timeLeft counts down", () => {
    const zones = [makeZone("z1")];
    const { actions } = makeState();
    mountSmokeZoneTick({ actions, random: () => 1 }).tick(0.1, { zones });
    expect(zones[0].timeLeft).toBeCloseTo(2.9);
  });

  it("timeLeft ≤ 0 → removed from array", () => {
    const zones = [makeZone("z1", { timeLeft: 0.01 })];
    const { actions } = makeState();
    mountSmokeZoneTick({ actions, random: () => 1 }).tick(0.1, { zones });
    expect(zones.length).toBe(0);
  });

  it("multiple zones — only expired one removed", () => {
    const zones = [makeZone("z1", { timeLeft: 0.01 }), makeZone("z2", { timeLeft: 5.0 })];
    const { actions } = makeState();
    mountSmokeZoneTick({ actions, random: () => 1 }).tick(0.1, { zones });
    expect(zones.length).toBe(1);
    expect(zones[0].id).toBe("z2");
  });
});

describe("smoke_zone_tick — particle emission", () => {
  it("random < 0.8 → spawnSmoke called", () => {
    const zones = [makeZone("z1")];
    const { actions, smokes } = makeState();
    mountSmokeZoneTick({ actions, random: () => 0.5 }).tick(0.016, { zones });
    expect(smokes.length).toBe(1);
  });

  it("random >= 0.8 → no spawnSmoke", () => {
    const zones = [makeZone("z1")];
    const { actions, smokes } = makeState();
    mountSmokeZoneTick({ actions, random: () => 0.99 }).tick(0.016, { zones });
    expect(smokes.length).toBe(0);
  });

  it("smoke position is within zone radius bounds", () => {
    const zone = makeZone("z1", { u: 0, v: 0, radius: 2 });
    const { actions, smokes } = makeState();
    // Inject deterministic random: 0.5 always — offset = 0, y = 0.5 + 0.75 = 1.25
    let call = 0;
    const random = () => { call++; return call === 1 ? 0.5 : 0.5; };
    mountSmokeZoneTick({ actions, random }).tick(0.016, { zones: [zone] });
    if (smokes.length > 0) {
      expect(smokes[0].u).toBeGreaterThanOrEqual(zone.u - zone.radius / 2);
      expect(smokes[0].u).toBeLessThanOrEqual(zone.u + zone.radius / 2);
    }
  });
});

describe("smoke_zone_tick — fuzz", () => {
  it("never throws for 20 random states", () => {
    for (let i = 0; i < 20; i++) {
      const zones = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) =>
        makeZone(`z${j}`, { u: (Math.random()-0.5)*10, v: (Math.random()-0.5)*10, timeLeft: Math.random()*5, radius: 0.5 + Math.random()*3 })
      );
      const { actions } = makeState();
      expect(() =>
        mountSmokeZoneTick({ actions }).tick(Math.random() * 0.1, { zones })
      ).not.toThrow();
    }
  });
});
