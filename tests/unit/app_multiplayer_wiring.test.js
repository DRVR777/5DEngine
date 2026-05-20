import { describe, expect, it, vi } from "vitest";
import { mountAppMultiplayerWiring } from "../../src/bridges/app_multiplayer_wiring.js";

function mount() {
  const intervals = [];
  const mp = { send: vi.fn(), sendEvent: vi.fn(), peers: new Set([1, 2]) };
  const duelMode = { isDueling: () => false };
  const eventHandlers = {};
  const world = { players: new Map([["hero", { u: 1, v: 2, y: 3 }]]) };
  const state = { mpState: { pendingFriendRequests: [] } };
  let heroHp = 75;
  const deps = {
    THREE: {},
    scene: {},
    buildComputerApps: vi.fn(getState => ({ body: () => getState() })),
    addDynamicIcons: vi.fn(),
    mountComputerUI: vi.fn(),
    createLanSession: vi.fn(() => mp),
    mountDuelMode: vi.fn(() => duelMode),
    mountMpBadge: vi.fn(),
    eventBus: {
      EVENTS: { ENEMY_KILLED: "enemy_killed" },
      on: vi.fn((event, fn) => { eventHandlers[event] = fn; }),
    },
    state,
    get: {
      getWeapon: () => () => ({ id: "pistol" }),
      pistolAmmo: () => 12,
      Inv: () => ({ countItem: vi.fn() }),
      heroInv: () => [],
      heroHealth: () => ({}),
      score: () => 5,
      CFG: () => ({ heroMaxHp: 100 }),
      world: () => world,
      inCar: () => false,
      carState: () => ({}),
      camDist: () => 7,
      camSide: () => 1,
      nearComputer: () => false,
      buildings: () => [],
      computerEntity: () => ({ u: 0, v: 0 }),
      VEHICLE_DEFS: () => ({}),
      deviceBus: () => ({ id: "bus" }),
      heroMedia: () => [],
      gameMode: () => "peaceful",
      enemies: () => [],
      camera: () => ({ id: "camera" }),
      camYaw: () => 0.25,
      currentWeaponId: () => "pistol",
      heroHp: () => heroHp,
      keys: () => ({ ShiftLeft: true, ControlRight: true }),
    },
    set: {
      heroMedia: vi.fn(),
      gameMode: vi.fn(),
      firstLaunch: vi.fn(),
      heroHp: vi.fn(v => { heroHp = v; }),
    },
    actions: {
      playSfx: vi.fn(),
      showToast: vi.fn(),
      closeComputer: vi.fn(),
      spawnParticles: vi.fn(),
      addKillFeedEntry: vi.fn(),
      setInterval: vi.fn((fn, ms) => { intervals.push({ fn, ms }); return 17; }),
    },
  };
  const api = mountAppMultiplayerWiring(deps);
  return { api, deps, mp, duelMode, intervals, eventHandlers, world, state };
}

describe("mountAppMultiplayerWiring", () => {
  it("builds apps, dynamic icons, and computer UI before returning APPS", () => {
    const { api, deps, state } = mount();
    expect(deps.buildComputerApps).toHaveBeenCalledTimes(1);
    expect(deps.addDynamicIcons).toHaveBeenCalledTimes(1);
    expect(deps.mountComputerUI).toHaveBeenCalledWith(expect.objectContaining({
      getAPPS: expect.any(Function),
      getMpState: expect.any(Function),
      getDuelMode: expect.any(Function),
      playSfx: deps.actions.playSfx,
      showToast: deps.actions.showToast,
      closeComputer: deps.actions.closeComputer,
    }));
    const uiArgs = deps.mountComputerUI.mock.calls[0][0];
    expect(uiArgs.getAPPS()).toBe(api.APPS);
    expect(uiArgs.getMpState()).toBe(state.mpState);
    expect(uiArgs.getDuelMode()).toBe(api.duelMode);
  });

  it("creates LAN session with the same state and game-state shape", () => {
    const { deps, state } = mount();
    expect(deps.createLanSession).toHaveBeenCalledWith(expect.objectContaining({
      THREE: deps.THREE,
      scene: deps.scene,
      state: state.mpState,
      getShowToast: expect.any(Function),
      getEnemies: expect.any(Function),
      getCamera: expect.any(Function),
      getGameState: expect.any(Function),
    }));
    const cfg = deps.createLanSession.mock.calls[0][0];
    expect(cfg.getGameState()).toMatchObject({
      camYaw: 0.25,
      currentWeaponId: "pistol",
      heroHp: 75,
      inCar: false,
      isSprinting: true,
      crouching: true,
    });
  });

  it("mounts duel mode and clamps hero HP to CFG heroMaxHp", () => {
    const { deps, mp } = mount();
    expect(deps.mountDuelMode).toHaveBeenCalledWith(expect.objectContaining({
      mp,
      get: expect.objectContaining({ myId: expect.any(Function) }),
      set: expect.objectContaining({ heroHp: expect.any(Function) }),
      actions: expect.objectContaining({
        showToast: deps.actions.showToast,
        playSfx: deps.actions.playSfx,
      }),
    }));
    const duelArgs = deps.mountDuelMode.mock.calls[0][0];
    duelArgs.set.heroHp(150);
    expect(deps.set.heroHp).toHaveBeenCalledWith(100);
  });

  it("sends hero position every 50ms and forwards enemy kill events", () => {
    const { intervals, mp, eventHandlers } = mount();
    expect(intervals[0].ms).toBe(50);
    intervals[0].fn();
    expect(mp.send).toHaveBeenCalledWith({ u: 1, v: 2, y: 3 });
    eventHandlers.enemy_killed({ id: "enemy7" });
    expect(mp.sendEvent).toHaveBeenCalledWith("enemy_kill", { enemy_id: "enemy7" });
  });

  it("mounts multiplayer badge using peer count", () => {
    const { deps } = mount();
    const badgeArgs = deps.mountMpBadge.mock.calls[0][0];
    expect(badgeArgs.getPeersSize()).toBe(2);
  });
});
