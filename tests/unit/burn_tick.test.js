import { it, expect, describe } from "vitest";
import { mountBurnTick } from "../../src/systems/burn_tick.js";

function makeBurn({ heroFireT = 0, heroFireDmgT = 0, heroHp = 100, heroDead = false } = {}) {
  const s = { heroFireT, heroFireDmgT, heroHp, heroDead, heroLastDamageT: 0 };
  const particleLog = [], deathLog = [];
  const POS = { u: 0, y: 1, v: 0 };
  const get = {
    heroFireT:      () => s.heroFireT,
    heroFireDmgT:   () => s.heroFireDmgT,
    heroHp:         () => s.heroHp,
    heroDead:       () => s.heroDead,
    heroPos:        () => POS,
  };
  const set = {
    heroFireT:      v => { s.heroFireT = v; },
    heroFireDmgT:   v => { s.heroFireDmgT = v; },
    heroHp:         v => { s.heroHp = v; },
    heroLastDamageT:v => { s.heroLastDamageT = v; },
  };
  const actions = {
    spawnParticles: (...a) => particleLog.push(a),
    heroShowDeathScreen: () => deathLog.push(1),
  };
  const { tick } = mountBurnTick({ get, set, actions });
  return { s, particleLog, deathLog, tick };
}

describe("no-op conditions", () => {
  it("does nothing when heroFireT is 0", () => {
    const { s, tick } = makeBurn({ heroFireT: 0 });
    tick(0.1, 1.0);
    expect(s.heroHp).toBe(100);
  });

  it("does nothing when heroDead is true", () => {
    const { s, tick } = makeBurn({ heroFireT: 2.0, heroDead: true });
    tick(0.1, 1.0);
    expect(s.heroFireT).toBe(2.0); // not modified
    expect(s.heroHp).toBe(100);
  });
});

describe("active burn", () => {
  it("decrements heroFireT and heroFireDmgT by dt", () => {
    const { s, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.4 });
    tick(0.1, 1.0);
    expect(s.heroFireT).toBeCloseTo(1.9);
    expect(s.heroFireDmgT).toBeCloseTo(0.3);
  });

  it("does not damage or spawn particles when dmgT still positive", () => {
    const { s, particleLog, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.4 });
    tick(0.1, 1.0);
    expect(s.heroHp).toBe(100);
    expect(particleLog).toHaveLength(0);
  });

  it("deals 3 damage and resets dmgT to 0.5 when dmgT crosses zero", () => {
    const { s, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.05 });
    tick(0.1, 5.0);
    expect(s.heroHp).toBe(97);
    expect(s.heroFireDmgT).toBeCloseTo(0.5);
  });

  it("records heroLastDamageT when damage fires", () => {
    const { s, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.05 });
    tick(0.1, 7.5);
    expect(s.heroLastDamageT).toBe(7.5);
  });

  it("spawns orange particles when damage fires", () => {
    const { particleLog, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.05 });
    tick(0.1, 1.0);
    expect(particleLog).toHaveLength(1);
    expect(particleLog[0]).toContain("orange");
  });

  it("clamps heroFireT to 0 when it would go negative", () => {
    const { s, tick } = makeBurn({ heroFireT: 0.05, heroFireDmgT: 10 });
    tick(0.1, 1.0);
    expect(s.heroFireT).toBe(0);
  });

  it("calls heroShowDeathScreen when heroHp hits 0 from burn", () => {
    const { deathLog, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.05, heroHp: 2 });
    tick(0.1, 1.0);
    expect(deathLog).toHaveLength(1);
  });

  it("does not call heroShowDeathScreen when HP survives burn tick", () => {
    const { deathLog, tick } = makeBurn({ heroFireT: 2.0, heroFireDmgT: 0.05, heroHp: 50 });
    tick(0.1, 1.0);
    expect(deathLog).toHaveLength(0);
  });

  it("successive ticks drain HP by 3 per 0.5s period", () => {
    const { s, tick } = makeBurn({ heroFireT: 3.0, heroFireDmgT: 0 });
    tick(0.1, 1.0); // fires: hp = 97, dmgT reset to 0.5
    tick(0.6, 1.6); // dmgT = 0.5 - 0.6 = -0.1 → fires: hp = 94
    expect(s.heroHp).toBe(94);
  });
});
