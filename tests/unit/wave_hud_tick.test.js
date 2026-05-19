import { it, expect, describe } from "vitest";
import { mountWaveHudTick } from "../../src/systems/wave_hud_tick.js";

function makeEl(text = "") {
  return { style: { display: "", color: "", transform: "" }, textContent: text, innerHTML: "" };
}

function makeState({ heroLevel = 1, enemyKills = 0, waveBeepLast = 0, lastWaveNum = 0, waveBannerUntil = 0, waveChallenge = null, waveChallengeStart = 0, waveChallengeHits = 0, levelThresholds = [5, 15, 30, 60, 100] } = {}) {
  let state = { heroLevel, enemyKills, waveBeepLast, lastWaveNum, waveBannerUntil, waveChallenge, waveChallengeStart, waveChallengeHits, levelThresholds };
  const log = [];
  const els = { waveHud: makeEl(), waveLabel: makeEl(), waveDetail: makeEl(), levelHud: makeEl(), challengeHud: makeEl(), bannerLabel: makeEl(), bannerSub: makeEl(), banner: makeEl() };
  const get = {
    waveBeepLast: () => state.waveBeepLast,
    lastWaveNum: () => state.lastWaveNum,
    waveBannerUntil: () => state.waveBannerUntil,
    waveChallenge: () => state.waveChallenge,
    waveChallengeStart: () => state.waveChallengeStart,
    waveChallengeHits: () => state.waveChallengeHits,
    heroLevel: () => state.heroLevel,
    levelThresholds: () => state.levelThresholds,
    enemyKills: () => state.enemyKills,
  };
  const set = {
    waveBeepLast: v => { state.waveBeepLast = v; },
    lastWaveNum: v => { state.lastWaveNum = v; },
    waveBannerUntil: v => { state.waveBannerUntil = v; },
  };
  const actions = {
    getWaveHud: () => els.waveHud,
    getWaveLabel: () => els.waveLabel,
    getWaveDetail: () => els.waveDetail,
    getLevelHud: () => els.levelHud,
    getChallengeHud: () => els.challengeHud,
    getBannerLabel: () => els.bannerLabel,
    getBannerSub: () => els.bannerSub,
    getBanner: () => els.banner,
    playSfx: (id, vol) => log.push({ type: "playSfx", id, vol }),
  };
  return { get, set, actions, state, log, els };
}

function makeWs({ started = true, wave = 1, totalWaves = 5, totalWave = 1, phase = "spawning", countdown = 3, aliveCount = 4, pauseLeft = 10, enemies = [] } = {}) {
  return { started, wave, totalWaves, totalWave, phase, countdown, aliveCount, pauseLeft, enemies };
}

describe("wave_hud_tick — display control", () => {
  it("not started → hud hidden", () => {
    const st = makeState();
    const ws = makeWs({ started: false });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveHud.style.display).toBe("none");
  });

  it("phase idle → hud hidden", () => {
    const st = makeState();
    const ws = makeWs({ phase: "idle" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveHud.style.display).toBe("none");
  });

  it("started + spawning → hud shown", () => {
    const st = makeState();
    const ws = makeWs({ phase: "spawning" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveHud.style.display).toBe("block");
  });
});

describe("wave_hud_tick — wave label", () => {
  it("sets wave label text with wave number", () => {
    const st = makeState();
    const ws = makeWs({ wave: 2, totalWaves: 5, totalWave: 2 });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveLabel.textContent).toContain("WAVE 2/5");
  });

  it("loop > 1 → includes LOOP prefix", () => {
    const st = makeState();
    const ws = makeWs({ wave: 1, totalWaves: 5, totalWave: 6 }); // totalWave=6 > totalWaves=5 → loop 2
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveLabel.textContent).toContain("LOOP 2");
  });
});

describe("wave_hud_tick — detail text", () => {
  it("spawning phase → shows alive count", () => {
    const st = makeState();
    const ws = makeWs({ phase: "spawning", aliveCount: 7 });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveDetail.textContent).toContain("7");
  });

  it("pausing phase → shows pause countdown", () => {
    const st = makeState();
    const ws = makeWs({ phase: "pausing", pauseLeft: 5 });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveDetail.textContent).toContain("5");
  });

  it("done phase → shows all waves done", () => {
    const st = makeState();
    const ws = makeWs({ phase: "done" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.waveDetail.textContent).toContain("all waves done");
  });

  it("countdown → plays beep when countdown changes", () => {
    const st = makeState({ waveBeepLast: 0 });
    const ws = makeWs({ phase: "countdown", countdown: 3 });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("countdown → no duplicate beep on same countdown value", () => {
    const st = makeState({ waveBeepLast: 3 }); // already beeped at 3
    const ws = makeWs({ phase: "countdown", countdown: 3 });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.log.some(e => e.type === "playSfx")).toBe(false);
  });
});

describe("wave_hud_tick — level hud", () => {
  it("level < max → shows level and kills progress", () => {
    const st = makeState({ heroLevel: 2, enemyKills: 12, levelThresholds: [5, 15, 30] });
    const ws = makeWs();
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.levelHud.textContent).toContain("LVL 2");
  });

  it("level at max → shows LVL MAX", () => {
    const st = makeState({ heroLevel: 5, levelThresholds: [5, 15, 30, 60, 100] });
    const ws = makeWs();
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.levelHud.textContent).toBe("LVL MAX");
  });
});

describe("wave_hud_tick — banner", () => {
  it("new wave number → shows banner and plays sfx", () => {
    const st = makeState({ lastWaveNum: 1 });
    const ws = makeWs({ wave: 2, phase: "spawning" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.banner.style.display).toBe("block");
    expect(st.log.some(e => e.type === "playSfx")).toBe(true);
  });

  it("same wave number → no banner update", () => {
    const st = makeState({ lastWaveNum: 2 });
    const ws = makeWs({ wave: 2, phase: "spawning" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.banner.style.display).toBe(""); // unchanged
  });

  it("final wave → banner sub says FINAL WAVE", () => {
    const st = makeState({ lastWaveNum: 4 });
    const ws = makeWs({ wave: 5, totalWaves: 5, phase: "spawning" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1000 });
    expect(st.els.bannerSub.textContent).toBe("FINAL WAVE");
  });

  it("banner expires after its duration → hides", () => {
    const st = makeState({ waveBannerUntil: 500 }); // expired at nowMs=500
    const ws = makeWs({ phase: "idle" });
    mountWaveHudTick({ get: st.get, set: st.set, actions: st.actions }).tick(0.016, { ws, nowMs: 1001 });
    expect(st.els.banner.style.transform).toBe("scaleY(0)");
    expect(st.state.waveBannerUntil).toBe(0);
  });
});
