import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mountWaveEvents } from "../../src/systems/wave_events.js";

function makeState(overrides = {}) {
  return {
    score: 0, heroHp: 100, HERO_MAX_HP: 100, perkMaxHpBonus: 0,
    shotsFired: 0, shotsHit: 0,
    waveChallenge: null, waveChallengeStart: 0, waveChallengeHits: 0,
    waveChallengeNoDmg: true, eliteSpawnedThisWave: false,
    bulletTimeLeft: 0, enemyKills: 5,
    ...overrides,
  };
}

function makeThree() {
  return {
    Color: class { constructor() {} set() {} },
  };
}

function makeScene() {
  return {
    background: null,
    fog: { color: { set: vi.fn() }, near: 0, far: 100 },
  };
}

function makeLight() {
  return { color: { set: vi.fn() }, intensity: 1 };
}

function makeActions(overrides = {}) {
  return {
    showToast: vi.fn(),
    playSfx: vi.fn(),
    addKillFeedEntry: vi.fn(),
    applyScreenShake: vi.fn(),
    spawnSpeedOrb: vi.fn(),
    showPerkPicker: vi.fn(),
    checkHighScore: vi.fn().mockReturnValue(false),
    exitPointerLock: vi.fn(),
    getWaveChallengeHud: vi.fn().mockReturnValue(null),
    getWaveClearBanner: vi.fn().mockReturnValue(null),
    getWaveClearTitle: vi.fn().mockReturnValue(null),
    getWaveClearSub: vi.fn().mockReturnValue(null),
    getVictoryOverlay: vi.fn().mockReturnValue(null),
    getVictoryStats: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function makeSys(stateOverrides = {}, actionOverrides = {}) {
  const state = makeState(stateOverrides);
  const scene = makeScene();
  const ambLight = makeLight();
  const sun = makeLight();
  const crates = [
    { broken: true, hp: 0, maxHp: 30, mesh: { visible: false } },
    { broken: false, hp: 30, maxHp: 30, mesh: { visible: true } },
  ];
  const barrels = [
    { exploded: true, hp: 0, maxHp: 50, mesh: { visible: false } },
    { exploded: false, hp: 50, maxHp: 50, mesh: { visible: true } },
  ];
  const skyboxPresets = {
    day:    { bg: 0x87ceeb, fog: "#aabbcc", fogNear: 10, fogFar: 60, ambColor: "#fff", ambInt: 0.8, sunColor: "#fff", sunInt: 1.2 },
    sunset: { bg: 0xff6633, fog: "#664433", fogNear: 8, fogFar: 45, ambColor: "#ffaa77", ambInt: 0.6, sunColor: "#ffaa33", sunInt: 0.9 },
    night:  { bg: 0x000011, fog: "#000011", fogNear: 5, fogFar: 30, ambColor: "#334", ambInt: 0.2, sunColor: "#334", sunInt: 0.1 },
    holo:   { bg: 0x001122, fog: "#001122", fogNear: 6, fogFar: 35, ambColor: "#0af", ambInt: 0.4, sunColor: "#0af", sunInt: 0.5 },
  };
  const WaveManager = {
    init: vi.fn((cbs) => { state._waveCallbacks = cbs; }),
    start: vi.fn(), stop: vi.fn(), reset: vi.fn(),
    getState: vi.fn().mockReturnValue({ wave: 1, totalWaves: 10, phase: "combat", aliveCount: 3, pauseLeft: 5 }),
  };
  const Engine = { addCommand: vi.fn() };
  const THREE = makeThree();
  const actions = makeActions(actionOverrides);

  const get = {
    score: () => state.score,
    heroHp: () => state.heroHp,
    HERO_MAX_HP: () => state.HERO_MAX_HP,
    perkMaxHpBonus: () => state.perkMaxHpBonus,
    shotsFired: () => state.shotsFired,
    shotsHit: () => state.shotsHit,
    waveChallenge: () => state.waveChallenge,
    waveChallengeStart: () => state.waveChallengeStart,
    waveChallengeHits: () => state.waveChallengeHits,
    waveChallengeNoDmg: () => state.waveChallengeNoDmg,
    bulletTimeLeft: () => state.bulletTimeLeft,
    enemyKills: () => state.enemyKills,
    crates: () => crates,
    barrels: () => barrels,
    skyboxPresets: () => skyboxPresets,
  };
  const set = {
    score: v => { state.score = v; },
    heroHp: v => { state.heroHp = v; },
    waveChallenge: v => { state.waveChallenge = v; },
    waveChallengeStart: v => { state.waveChallengeStart = v; },
    waveChallengeHits: v => { state.waveChallengeHits = v; },
    waveChallengeNoDmg: v => { state.waveChallengeNoDmg = v; },
    eliteSpawnedThisWave: v => { state.eliteSpawnedThisWave = v; },
    shotsFired: v => { state.shotsFired = v; },
    shotsHit: v => { state.shotsHit = v; },
    bulletTimeLeft: v => { state.bulletTimeLeft = v; },
  };

  mountWaveEvents({ WaveManager, Engine, THREE, scene, ambLight, sun, skyboxPresets, get, set, actions });
  return { state, scene, ambLight, sun, crates, barrels, WaveManager, Engine, actions };
}

describe("mountWaveEvents", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("calls WaveManager.init on mount", () => {
    const { WaveManager } = makeSys();
    expect(WaveManager.init).toHaveBeenCalledOnce();
  });

  it("registers Engine 'wave' command", () => {
    const { Engine } = makeSys();
    expect(Engine.addCommand).toHaveBeenCalledWith("wave", expect.any(String), expect.any(Function));
  });

  // ─── onWaveStart ──────────────────────────────────────────────────────────

  it("onWaveStart shows danger toast with wave number", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onWaveStart(3);
    expect(actions.showToast).toHaveBeenCalledWith("Wave 3 incoming!", "danger", 3000);
  });

  it("wave 1-3 maps to 'day' skybox", () => {
    const { state, ambLight } = makeSys();
    state._waveCallbacks.onWaveStart(1);
    expect(ambLight.intensity).toBe(0.8); // day.ambInt
    state._waveCallbacks.onWaveStart(3);
    expect(ambLight.intensity).toBe(0.8);
  });

  it("wave 4-6 maps to 'sunset' skybox", () => {
    const { state, ambLight } = makeSys();
    state._waveCallbacks.onWaveStart(4);
    expect(ambLight.intensity).toBe(0.6); // sunset.ambInt
    state._waveCallbacks.onWaveStart(6);
    expect(ambLight.intensity).toBe(0.6);
  });

  it("wave 7-9 maps to 'night' skybox", () => {
    const { state, ambLight } = makeSys();
    state._waveCallbacks.onWaveStart(9);
    expect(ambLight.intensity).toBe(0.2); // night.ambInt
  });

  it("wave 10 maps to 'holo' skybox", () => {
    const { state, ambLight } = makeSys();
    state._waveCallbacks.onWaveStart(10);
    expect(ambLight.intensity).toBe(0.4); // holo.ambInt
  });

  it("wave numbering wraps: wave 11 → day, wave 14 → sunset", () => {
    const { state, ambLight } = makeSys();
    state._waveCallbacks.onWaveStart(11);
    expect(ambLight.intensity).toBe(0.8); // day.ambInt
    state._waveCallbacks.onWaveStart(14);
    expect(ambLight.intensity).toBe(0.6); // sunset.ambInt
  });

  it("does NOT respawn broken crates on wave 1", () => {
    const { state, crates } = makeSys();
    crates[0].broken = true;
    state._waveCallbacks.onWaveStart(1);
    expect(crates[0].broken).toBe(true); // unchanged
  });

  it("respawns broken crates on wave 2+", () => {
    const { state, crates } = makeSys();
    state._waveCallbacks.onWaveStart(2);
    expect(crates[0].broken).toBe(false);
    expect(crates[0].hp).toBe(30);
    expect(crates[0].mesh.visible).toBe(true);
    expect(crates[1].broken).toBe(false); // unbroken crate unchanged
  });

  it("does NOT spawn speed orb on wave 1", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onWaveStart(1);
    expect(actions.spawnSpeedOrb).not.toHaveBeenCalled();
  });

  it("spawns speed orb on wave 2+", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onWaveStart(2);
    expect(actions.spawnSpeedOrb).toHaveBeenCalledOnce();
  });

  it("sets wave challenge (not null) after start", () => {
    const { state } = makeSys();
    state._waveCallbacks.onWaveStart(1);
    expect(state.waveChallenge).not.toBeNull();
    expect(["speed", "nodmg", "hs"]).toContain(state.waveChallenge.type);
  });

  it("resets challenge flags: hits=0, noDmg=true, elite=false", () => {
    const s = makeState({ waveChallengeHits: 5, waveChallengeNoDmg: false, eliteSpawnedThisWave: true });
    const { state } = makeSys(s);
    state._waveCallbacks.onWaveStart(1);
    expect(state.waveChallengeHits).toBe(0);
    expect(state.waveChallengeNoDmg).toBe(true);
    expect(state.eliteSpawnedThisWave).toBe(false);
  });

  it("speed challenge limit: Math.max(30, 75 - w*5); w=1 → 70, w=9 → 30, w=10 → 30", () => {
    const { state } = makeSys();
    // Force speed challenge by mocking Math.random → 0
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    state._waveCallbacks.onWaveStart(1);
    expect(state.waveChallenge.limit).toBe(70);
    state._waveCallbacks.onWaveStart(9);
    expect(state.waveChallenge.limit).toBe(30);
    state._waveCallbacks.onWaveStart(10);
    expect(state.waveChallenge.limit).toBe(30);
    spy.mockRestore();
  });

  // ─── onWaveEnd ────────────────────────────────────────────────────────────

  it("onWaveEnd adds w*3 coins to score", () => {
    const { state } = makeSys({ score: 10 });
    state._waveCallbacks.onWaveEnd(4);
    expect(state.score).toBeGreaterThanOrEqual(10 + 12); // at least w*3
  });

  it("hero heals 15 HP on wave end, capped at maxHp", () => {
    const { state } = makeSys({ heroHp: 95, HERO_MAX_HP: 100, perkMaxHpBonus: 0 });
    state._waveCallbacks.onWaveEnd(1);
    expect(state.heroHp).toBe(100); // capped
  });

  it("hero heals 15 HP from 60 normally", () => {
    const { state } = makeSys({ heroHp: 60, HERO_MAX_HP: 100, perkMaxHpBonus: 0 });
    state._waveCallbacks.onWaveEnd(1);
    expect(state.heroHp).toBe(75);
  });

  it("accuracy bonus given when >=60% hit rate AND >=5 shots", () => {
    const { state } = makeSys({ score: 0, shotsFired: 10, shotsHit: 8 }); // 80%
    state._waveCallbacks.onWaveEnd(2); // accBonus = round(0.8 * 2 * 5) = 8
    expect(state.score).toBeGreaterThan(6); // w*3=6 + accBonus=8
  });

  it("accuracy bonus NOT given when <5 shots even at 100%", () => {
    const { state, actions } = makeSys({ score: 0, shotsFired: 4, shotsHit: 4 });
    state._waveCallbacks.onWaveEnd(3);
    expect(state.score).toBe(9); // only w*3
    expect(actions.playSfx).not.toHaveBeenCalledWith("tone:1600:60:sine", 0.3);
  });

  it("accuracy bonus NOT given when <60% hit rate", () => {
    const { state, actions } = makeSys({ score: 0, shotsFired: 10, shotsHit: 5 }); // 50%
    state._waveCallbacks.onWaveEnd(3);
    expect(state.score).toBe(9); // only w*3
    expect(actions.playSfx).not.toHaveBeenCalledWith("tone:1600:60:sine", 0.3);
  });

  it("shotsFired and shotsHit reset to 0 on wave end", () => {
    const { state } = makeSys({ shotsFired: 20, shotsHit: 15 });
    state._waveCallbacks.onWaveEnd(1);
    expect(state.shotsFired).toBe(0);
    expect(state.shotsHit).toBe(0);
  });

  it("respawns exploded barrels on wave end", () => {
    const { state, barrels } = makeSys();
    state._waveCallbacks.onWaveEnd(1);
    expect(barrels[0].exploded).toBe(false);
    expect(barrels[0].hp).toBe(50);
    expect(barrels[0].mesh.visible).toBe(true);
    expect(barrels[1].exploded).toBe(false); // untouched
  });

  it("perk picker fires after 3200ms", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onWaveEnd(2);
    expect(actions.showPerkPicker).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3200);
    expect(actions.showPerkPicker).toHaveBeenCalledWith(2);
  });

  it("wave end plays tone tones including delayed 180ms tone", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onWaveEnd(1);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:800:100:sine", 0.5);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1000:80:sine", 0.45);
    expect(actions.playSfx).not.toHaveBeenCalledWith("tone:1300:160:sine", 0.4);
    vi.advanceTimersByTime(180);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1300:160:sine", 0.4);
  });

  // Wave challenge evaluation

  it("challenge 'nodmg' met when waveChallengeNoDmg is true", () => {
    const { state } = makeSys({ score: 0, waveChallengeNoDmg: true });
    state.waveChallenge = { type: "nodmg", label: "No damage taken", bonus: 12 };
    state._waveCallbacks.onWaveEnd(2); // chBonus = 12 * 2 = 24
    expect(state.score).toBeGreaterThan(6 + 24 - 1); // w*3 + chBonus
  });

  it("challenge 'hs' met when waveChallengeHits >= 3", () => {
    const { state } = makeSys({ score: 0, waveChallengeHits: 3 });
    state.waveChallenge = { type: "hs", label: "3+ headshots", bonus: 6 };
    state._waveCallbacks.onWaveEnd(1); // chBonus = 6 * 1 = 6
    expect(state.score).toBeGreaterThanOrEqual(3 + 6); // w*3 + chBonus
  });

  it("challenge 'hs' NOT met when waveChallengeHits < 3", () => {
    const { state } = makeSys({ score: 0, waveChallengeHits: 2 });
    state.waveChallenge = { type: "hs", label: "3+ headshots", bonus: 6 };
    state._waveCallbacks.onWaveEnd(1);
    expect(state.score).toBe(3); // only w*3
  });

  it("challenge cleared (set to null) after wave end", () => {
    const { state } = makeSys();
    state.waveChallenge = { type: "nodmg", label: "No damage taken", bonus: 12 };
    state._waveCallbacks.onWaveEnd(1);
    expect(state.waveChallenge).toBeNull();
  });

  // ─── onAllWaves ──────────────────────────────────────────────────────────

  it("onAllWaves sets bulletTimeLeft to 0.55", () => {
    const { state } = makeSys();
    state._waveCallbacks.onAllWaves();
    expect(state.bulletTimeLeft).toBe(0.55);
  });

  it("onAllWaves adds 30 to score", () => {
    const { state } = makeSys({ score: 50 });
    state._waveCallbacks.onAllWaves();
    expect(state.score).toBe(80);
  });

  it("onAllWaves calls applyScreenShake(0.8)", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onAllWaves();
    expect(actions.applyScreenShake).toHaveBeenCalledWith(0.8);
  });

  it("onAllWaves calls exitPointerLock", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onAllWaves();
    expect(actions.exitPointerLock).toHaveBeenCalled();
  });

  it("onAllWaves plays tones including delayed ones", () => {
    const { state, actions } = makeSys();
    state._waveCallbacks.onAllWaves();
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1200:200:sine", 0.7);
    vi.advanceTimersByTime(200);
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1500:180:sine", 0.6);
    vi.advanceTimersByTime(220); // 200+220=420
    expect(actions.playSfx).toHaveBeenCalledWith("tone:1800:300:sine", 0.55);
  });

  // ─── Engine wave command ───────────────────────────────────────────────────

  it("wave command 'status' returns wave state string", () => {
    const { Engine, WaveManager } = makeSys();
    const [, , handler] = Engine.addCommand.mock.calls[0];
    const result = handler(["status"]);
    expect(result).toContain("wave=1/10");
    expect(result).toContain("phase=combat");
  });

  it("wave command 'start' calls WaveManager.start", () => {
    const { Engine, WaveManager } = makeSys();
    const [, , handler] = Engine.addCommand.mock.calls[0];
    handler(["start"]);
    expect(WaveManager.start).toHaveBeenCalled();
  });

  it("wave command 'stop' calls WaveManager.stop", () => {
    const { Engine, WaveManager } = makeSys();
    const [, , handler] = Engine.addCommand.mock.calls[0];
    handler(["stop"]);
    expect(WaveManager.stop).toHaveBeenCalled();
  });

  it("wave command 'reset' calls WaveManager.reset", () => {
    const { Engine, WaveManager } = makeSys();
    const [, , handler] = Engine.addCommand.mock.calls[0];
    handler(["reset"]);
    expect(WaveManager.reset).toHaveBeenCalled();
  });
});
