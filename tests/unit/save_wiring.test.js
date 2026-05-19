import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { mountSaveWiring } from "../../src/systems/save_wiring.js";

function makeQuest(overrides = {}) {
  return { id: "combat", steps: [{ done: false }, { done: false }], ...overrides };
}

function makeState(overrides = {}) {
  return {
    score: 10, enemyKills: 5, heroHp: 80, heroMaxHp: 100,
    currentWeaponId: "pistol", computerOpen: false,
    heroPos: { u: 1, v: 2, y: 0 },
    inventory: ["pistol_9mm"],
    spawnPoints: [{ label: "origin", u: 0, v: 0 }, { label: "west", u: -5, v: 0 }],
    quests: [makeQuest()],
    ...overrides,
  };
}

function makeAccess(state) {
  return {
    score: () => state.score,
    enemyKills: () => state.enemyKills,
    heroHp: () => state.heroHp,
    heroMaxHp: () => state.heroMaxHp,
    currentWeaponId: () => state.currentWeaponId,
    computerOpen: () => state.computerOpen,
    heroPos: () => state.heroPos,
    inventory: () => state.inventory,
    spawnPoints: () => state.spawnPoints,
    quests: () => state.quests,
  };
}

function makeActions(overrides = {}) {
  return { addSpawnPoint: vi.fn(), renderQuests: vi.fn(), showToast: vi.fn(), ...overrides };
}

function makeGP() {
  let _collectFn, _applyFn;
  return {
    init: vi.fn((collect, apply) => { _collectFn = collect; _applyFn = apply; }),
    save: vi.fn(),
    load: vi.fn(),
    _collect: () => _collectFn(),
    _apply: (data, src) => _applyFn(data, src),
  };
}

function makeSys({ state = makeState(), actions = makeActions(), gp = makeGP(), registerKeydown = null } = {}) {
  const get = makeAccess(state);
  const set = {
    score: v => { state.score = v; },
    enemyKills: v => { state.enemyKills = v; },
    heroHp: v => { state.heroHp = v; },
  };
  const sys = mountSaveWiring({ GameProgress: gp, get, set, actions, registerKeydown });
  return { sys, state, actions, gp };
}

describe("mountSaveWiring", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("calls GameProgress.init on mount", () => {
    const { gp } = makeSys();
    expect(gp.init).toHaveBeenCalledOnce();
  });

  it("collect snapshot includes score, enemyKills, heroHp", () => {
    const { gp } = makeSys({ state: makeState({ score: 42, enemyKills: 7, heroHp: 60 }) });
    const snap = gp._collect();
    expect(snap.score).toBe(42);
    expect(snap.enemyKills).toBe(7);
    expect(snap.heroHp).toBe(60);
  });

  it("collect filters out origin spawn point", () => {
    const { gp } = makeSys();
    const snap = gp._collect();
    expect(snap.spawnPoints.every(sp => sp.label !== "origin")).toBe(true);
    expect(snap.spawnPoints.length).toBe(1);
  });

  it("collect includes inventory and weaponId", () => {
    const { gp } = makeSys({ state: makeState({ currentWeaponId: "shotgun", inventory: ["shells"] }) });
    const snap = gp._collect();
    expect(snap.weaponId).toBe("shotgun");
    expect(snap.inventory).toEqual(["shells"]);
  });

  it("apply restores score, enemyKills, and heroHp capped at maxHp", () => {
    const { gp, state } = makeSys();
    gp._apply({ score: 99, enemyKills: 20, heroHp: 200 }, "local");
    expect(state.score).toBe(99);
    expect(state.enemyKills).toBe(20);
    expect(state.heroHp).toBe(100); // capped at heroMaxHp
  });

  it("apply handles snake_case enemy_kills and hero_hp aliases", () => {
    const { gp, state } = makeSys();
    gp._apply({ enemy_kills: 15, hero_hp: 50 }, "cloud");
    expect(state.enemyKills).toBe(15);
    expect(state.heroHp).toBe(50);
  });

  it("apply adds non-origin spawnPoints via actions.addSpawnPoint", () => {
    const { gp, actions } = makeSys();
    gp._apply({ spawnPoints: [{ u: 3, v: 4 }, { u: 5, v: 6 }] }, "local");
    expect(actions.addSpawnPoint).toHaveBeenCalledTimes(2);
    expect(actions.addSpawnPoint).toHaveBeenCalledWith(3, 4);
  });

  it("apply restores quest step done flags and calls renderQuests", () => {
    const quests = [makeQuest({ id: "combat" })];
    const { gp, actions } = makeSys({ state: makeState({ quests }) });
    gp._apply({ questProgress: [{ id: "combat", steps: [true, false] }] }, "local");
    expect(quests[0].steps[0].done).toBe(true);
    expect(quests[0].steps[1].done).toBe(false);
    expect(actions.renderQuests).toHaveBeenCalled();
  });

  it("apply shows toast with source and age info", () => {
    const { gp, actions } = makeSys();
    gp._apply({ score: 5, enemyKills: 2, saved_at: new Date(Date.now() - 120000).toISOString() }, "cloud");
    expect(actions.showToast).toHaveBeenCalledWith(
      expect.stringContaining("2m ago"),
      "info", 4000
    );
  });

  it("auto-save interval is exactly 30000ms", () => {
    const { gp } = makeSys();
    expect(gp.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30000);
    expect(gp.save).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(30000);
    expect(gp.save).toHaveBeenCalledTimes(2);
  });

  it("Ctrl+S fires save and shows toast when registerKeydown is provided", () => {
    let handler;
    const { gp, actions } = makeSys({ registerKeydown: fn => { handler = fn; } });
    handler({ code: "KeyS", ctrlKey: true, preventDefault: vi.fn() });
    expect(gp.save).toHaveBeenCalled();
    expect(actions.showToast).toHaveBeenCalledWith("Game saved", "success", 1500);
  });

  it("Ctrl+S is ignored when computerOpen is true", () => {
    let handler;
    const { gp } = makeSys({
      state: makeState({ computerOpen: true }),
      registerKeydown: fn => { handler = fn; },
    });
    handler({ code: "KeyS", ctrlKey: true, preventDefault: vi.fn() });
    expect(gp.save).not.toHaveBeenCalled();
  });
});
