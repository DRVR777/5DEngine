import { it, expect, describe, beforeEach } from "vitest";
import { mountGrenadeArcTick } from "../../src/systems/grenade_arc_tick.js";

function makeTHREE() {
  class Mesh {
    constructor() {
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
      this.visible = false;
      this.material = { color: { set(v) { this._val = v; } }, opacity: 0.7 };
    }
  }
  return {
    MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); this.color = { set(v) { this._val = v; } }; } clone() { const c = new this.constructor({}); c.color = { _val: 0, set(v) { this._val = v; } }; c.opacity = this.opacity; return c; } },
    SphereGeometry: class { constructor() {} },
    Mesh,
  };
}

function makeState({ heroHp = 100, grenadeCount = 3, grenadePressT = 0, heroDead = false } = {}) {
  let state = { heroHp, grenadeCount, grenadePressT };
  const log = [];
  const sceneItems = [];
  const timerEl = { style: { display: "none", color: "" }, textContent: "" };
  const get = { heroHp: () => state.heroHp };
  const set = {
    heroHp: v => { state.heroHp = v; },
    grenadeCount: v => { state.grenadeCount = v; },
    grenadePressT: v => { state.grenadePressT = v; },
  };
  const actions = {
    addToScene: m => sceneItems.push(m),
    flashDamage: () => log.push({ type: "flashDamage" }),
    applyScreenShake: amt => log.push({ type: "shake", amt }),
    spawnParticles: () => log.push({ type: "particles" }),
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
    showToast: (msg) => log.push({ type: "toast", msg }),
    showDeathScreen: () => log.push({ type: "death" }),
    getTimerEl: () => timerEl,
  };
  return { get, set, actions, state, log, sceneItems, timerEl };
}

const BASE_TICK = {
  buildMode: false, computerOpen: false, heroDead: false,
  grenadeCount: 3, keyG: false,
  heroU: 0, heroV: 0, heroY: 0, camYaw: 0,
  grenadePressT: 0, performanceNow: 1000,
};

describe("grenade_arc_tick — constructor", () => {
  it("creates DOT_COUNT dots and adds to scene", () => {
    const st = makeState();
    mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    expect(st.sceneItems.length).toBe(16);
  });

  it("dots start invisible", () => {
    const st = makeState();
    mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    expect(st.sceneItems.every(d => !d.visible)).toBe(true);
  });
});

describe("grenade_arc_tick — cook safety", () => {
  it("held > 4s and alive → triggers cook penalty", () => {
    const st = makeState({ heroHp: 100, grenadeCount: 3, grenadePressT: 0 });
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    // Simulate grenadePressT set to 5 seconds ago (performance.now would be 5000ms later)
    sys.tick(0.016, { ...BASE_TICK, heroDead: false, grenadeCount: 3, grenadePressT: 0, performanceNow: 5000 });
    // grenadePressT=0 means not holding — no cook. Use a real value:
    st.state.heroHp = 100;
    sys.tick(0.016, { ...BASE_TICK, grenadePressT: 1000, performanceNow: 6001 });
    expect(st.log.some(e => e.type === "flashDamage")).toBe(true);
    expect(st.state.heroHp).toBe(50);
  });

  it("held < 4s → no cook", () => {
    const st = makeState({ heroHp: 100 });
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, grenadePressT: 1000, performanceNow: 3000 }); // 2s, < 4s
    expect(st.log.some(e => e.type === "flashDamage")).toBe(false);
    expect(st.state.heroHp).toBe(100);
  });

  it("heroDead → no cook even if held > 4s", () => {
    const st = makeState({ heroHp: 100 });
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, heroDead: true, grenadePressT: 1000, performanceNow: 6000 });
    expect(st.log.some(e => e.type === "flashDamage")).toBe(false);
  });

  it("cook kills hero → showDeathScreen called", () => {
    const st = makeState({ heroHp: 10 });
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, grenadePressT: 1000, performanceNow: 6000 });
    expect(st.log.some(e => e.type === "death")).toBe(true);
  });
});

describe("grenade_arc_tick — arc preview", () => {
  it("keyG held + alive + not buildMode → dots become visible", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: true });
    expect(st.sceneItems.some(d => d.visible)).toBe(true);
  });

  it("keyG not held → dots hidden", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: false });
    expect(st.sceneItems.every(d => !d.visible)).toBe(true);
  });

  it("buildMode → dots hidden even with keyG", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, buildMode: true, keyG: true });
    expect(st.sceneItems.every(d => !d.visible)).toBe(true);
  });

  it("computerOpen → dots hidden", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, computerOpen: true, keyG: true });
    expect(st.sceneItems.every(d => !d.visible)).toBe(true);
  });

  it("no grenades → dots hidden", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, grenadeCount: 0, keyG: true });
    expect(st.sceneItems.every(d => !d.visible)).toBe(true);
  });

  it("arc active → timer element shown", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: true });
    expect(st.timerEl.style.display).toBe("block");
  });

  it("arc hidden → timer element hidden", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: false });
    expect(st.timerEl.style.display).toBe("none");
  });

  it("cook danger ≥3s → timer text says COOK:", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: true, grenadePressT: 1000, performanceNow: 4100 }); // 3.1s held
    expect(st.timerEl.textContent).toContain("COOK:");
  });

  it("cook < 3s → timer text says FUSE:", () => {
    const st = makeState();
    const sys = mountGrenadeArcTick({ THREE: makeTHREE(), get: st.get, set: st.set, actions: st.actions });
    sys.tick(0.016, { ...BASE_TICK, keyG: true, grenadePressT: 1000, performanceNow: 2000 }); // 1s held
    expect(st.timerEl.textContent).toContain("FUSE:");
  });
});
