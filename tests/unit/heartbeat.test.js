import { it, expect, describe } from "vitest";
import { mountHeartbeat } from "../../src/systems/heartbeat.js";

function makeHeart({ heroHp = 100, maxHp = 100, heroDead = false, heartbeatT = 0 } = {}) {
  const s = { heroHp, heartbeatT };
  const sfxLog = [];
  const get = {
    heroHp:      () => s.heroHp,
    HERO_MAX_HP: () => maxHp,
    heroDead:    () => heroDead,
    heartbeatT:  () => s.heartbeatT,
  };
  const set = { heartbeatT: v => { s.heartbeatT = v; } };
  const actions = { playSfx: (t) => sfxLog.push(t) };
  const { tick } = mountHeartbeat({ get, set, actions });
  return { s, sfxLog, tick };
}

describe("above threshold → no heartbeat", () => {
  it("resets heartbeatT to 0 when hp >= 30% of maxHp", () => {
    const { s, tick } = makeHeart({ heroHp: 30, maxHp: 100, heartbeatT: 0.5 });
    tick(0.1);
    expect(s.heartbeatT).toBe(0);
  });

  it("resets heartbeatT even when hero is at exactly the threshold", () => {
    const { s, tick } = makeHeart({ heroHp: 30, maxHp: 100 });
    tick(0.1);
    expect(s.heartbeatT).toBe(0);
  });

  it("does not play sfx when hp is above threshold", () => {
    const { sfxLog, tick } = makeHeart({ heroHp: 50, maxHp: 100 });
    tick(0.1);
    expect(sfxLog).toHaveLength(0);
  });
});

describe("below threshold, not dead", () => {
  it("decrements heartbeatT by dt", () => {
    const { s, tick } = makeHeart({ heroHp: 20, maxHp: 100, heartbeatT: 1.0 });
    tick(0.1);
    expect(s.heartbeatT).toBeCloseTo(0.9);
  });

  it("fires sfx when heartbeatT crosses zero", () => {
    const { sfxLog, tick } = makeHeart({ heroHp: 20, maxHp: 100, heartbeatT: 0.05 });
    tick(0.1); // 0.05 - 0.1 = -0.05 → fires
    expect(sfxLog).toContain("tone:42:95:sine");
  });

  it("sets new heartbeatT after firing (period in [0.38, 1.2])", () => {
    const { s, tick } = makeHeart({ heroHp: 20, maxHp: 100, heartbeatT: 0.01 });
    tick(0.1);
    expect(s.heartbeatT).toBeGreaterThanOrEqual(0.38);
    expect(s.heartbeatT).toBeLessThanOrEqual(1.21);
  });

  it("period is shorter (faster heartbeat) at lower HP", () => {
    const { s: sLow,  tick: tickLow  } = makeHeart({ heroHp: 1,  maxHp: 100, heartbeatT: 0 });
    const { s: sHigh, tick: tickHigh } = makeHeart({ heroHp: 29, maxHp: 100, heartbeatT: 0 });
    tickLow(0.1);
    tickHigh(0.1);
    expect(sLow.heartbeatT).toBeLessThan(sHigh.heartbeatT);
  });

  it("does not fire sfx when heartbeatT is still positive", () => {
    const { sfxLog, tick } = makeHeart({ heroHp: 20, maxHp: 100, heartbeatT: 1.0 });
    tick(0.1);
    expect(sfxLog).toHaveLength(0);
  });
});

describe("below threshold but dead", () => {
  it("resets heartbeatT to 0 and does not fire sfx when heroDead", () => {
    const { s, sfxLog, tick } = makeHeart({ heroHp: 5, maxHp: 100, heroDead: true, heartbeatT: 0.5 });
    tick(0.1);
    expect(s.heartbeatT).toBe(0);
    expect(sfxLog).toHaveLength(0);
  });
});
