import { it, expect, describe } from "vitest";
import { mountEnemyFootstepTick } from "../../src/systems/enemy_footstep_tick.js";

function makeEnemy(id, { type = "normal", dead = false, u = 5, v = 0 } = {}) {
  return { id, type, dead, _u: u, _v: v };
}

function makeState({ enFsT = 0, heroPos = { u: 0, v: 0 } } = {}) {
  let fsT = enFsT;
  const log = [];
  const enemyPositions = new Map();
  const get = { enFsT: () => fsT };
  const set = { enFsT: v => { fsT = v; } };
  const actions = {
    getHeroPos: () => heroPos,
    getEnemyPos: id => enemyPositions.get(id) || null,
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
  };
  return { get, set, actions, log, enemyPositions, getEnFsT: () => fsT };
}

describe("enemy_footstep_tick — timer cooldown", () => {
  it("when timer > 0 after decrement, no sfx fires", () => {
    const { get, set, actions, log } = makeState({ enFsT: 1.0 });
    const en = makeEnemy("e1", { u: 2, v: 0 });
    makeState().enemyPositions; // unused
    const { enemyPositions } = makeState({ enFsT: 1.0 });
    const st = makeState({ enFsT: 1.0 });
    st.enemyPositions.set("e1", { u: 2, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.length).toBe(0);
  });

  it("timer decrements by dt each tick", () => {
    const st = makeState({ enFsT: 0.5 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.1, { enemies: [], heroDead: false });
    expect(st.getEnFsT()).toBeCloseTo(0.4);
  });
});

describe("enemy_footstep_tick — detection and sfx", () => {
  it("enemy within 12m → playSfx called when timer expires", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { u: 5, v: 0 });
    st.enemyPositions.set("e1", { u: 5, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("enemy beyond 12m → no sfx", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { u: 20, v: 0 });
    st.enemyPositions.set("e1", { u: 20, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.type === "playSfx")).toBe(false);
  });

  it("dead enemy → ignored", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { dead: true, u: 2, v: 0 });
    st.enemyPositions.set("e1", { u: 2, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.type === "playSfx")).toBe(false);
  });

  it("heroDead → no sfx, timer reset to idle", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { u: 2, v: 0 });
    st.enemyPositions.set("e1", { u: 2, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: true });
    expect(st.log.some(e => e.type === "playSfx")).toBe(false);
    expect(st.getEnFsT()).toBeGreaterThan(0);
  });
});

describe("enemy_footstep_tick — frequency by enemy type", () => {
  it("heavy enemy → low freq (32Hz)", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { type: "heavy", u: 3, v: 0 });
    st.enemyPositions.set("e1", { u: 3, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.id && e.id.startsWith("tone:32:"))).toBe(true);
  });

  it("fast enemy → higher freq (62Hz)", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { type: "fast", u: 3, v: 0 });
    st.enemyPositions.set("e1", { u: 3, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.id && e.id.startsWith("tone:62:"))).toBe(true);
  });

  it("normal enemy → mid freq (46Hz)", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { type: "normal", u: 3, v: 0 });
    st.enemyPositions.set("e1", { u: 3, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.log.some(e => e.id && e.id.startsWith("tone:46:"))).toBe(true);
  });
});

describe("enemy_footstep_tick — interval by enemy type", () => {
  it("fast enemy → 0.28s interval", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { type: "fast", u: 3, v: 0 });
    st.enemyPositions.set("e1", { u: 3, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.getEnFsT()).toBeCloseTo(0.28);
  });

  it("heavy enemy → 0.50s interval", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    const en = makeEnemy("e1", { type: "heavy", u: 3, v: 0 });
    st.enemyPositions.set("e1", { u: 3, v: 0 });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [en], heroDead: false });
    expect(st.getEnFsT()).toBeCloseTo(0.50);
  });

  it("no nearby enemy → idle interval 0.40s", () => {
    const st = makeState({ enFsT: 0, heroPos: { u: 0, v: 0 } });
    mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [], heroDead: false });
    expect(st.getEnFsT()).toBeCloseTo(0.40);
  });
});

describe("enemy_footstep_tick — no heroPos", () => {
  it("null heroPos → no throw, timer reset", () => {
    const st = makeState({ enFsT: 0, heroPos: null });
    st.actions.getHeroPos = () => null;
    expect(() =>
      mountEnemyFootstepTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { enemies: [], heroDead: false })
    ).not.toThrow();
    expect(st.getEnFsT()).toBeGreaterThan(0);
  });
});
