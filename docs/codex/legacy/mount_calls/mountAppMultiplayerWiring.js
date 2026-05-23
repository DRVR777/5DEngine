// Legacy clone of mountAppMultiplayerWiring call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2272..2323
// (context lines 2268..2327)

  },
});

// Pseudocode: build desktop apps, mount computer UI, create LAN session, duel mode, badge, and peer sync.
const _appMp = mountAppMultiplayerWiring({
  THREE, scene,
  buildComputerApps,
  addDynamicIcons,
  mountComputerUI,
  createLanSession,
  mountDuelMode,
  mountMpBadge,
  eventBus: typeof EventBus !== "undefined" ? EventBus : null,
  state: { mpState: _mpState },
  get: {
    getWeapon: () => getWeapon,
    pistolAmmo: () => pistolAmmo,
    Inv: () => Inv,
    heroInv: () => heroInv,
    heroHealth: () => heroHealth,
    score: () => score,
    CFG: () => CFG,
    world: () => world,
    inCar: () => inCar,
    carState: () => carState,
    camDist: () => camDist,
    camSide: () => camSide,
    nearComputer: () => nearComputer,
    buildings: () => buildings,
    computerEntity: () => computerEntity,
    VEHICLE_DEFS: () => VEHICLE_DEFS,
    deviceBus: () => deviceBus,
    heroMedia: () => heroMedia,
    gameMode: () => gameMode,
    enemies: () => enemies,
    camera: () => camera,
    camYaw: () => camYaw,
    currentWeaponId: () => currentWeaponId,
    heroHp: () => heroHp,
    keys: () => keys,
  },
  set: {
    heroMedia: arr => { heroMedia = arr; },
    gameMode: m => { gameMode = m; },
    firstLaunch: b => { _firstLaunch = b; },
    heroHp: v => { heroHp = v; },
  },
  actions: {
    playSfx,
    showToast,
    closeComputer,
    spawnParticles: _spawnParticles,
    addKillFeedEntry: _addKillFeedEntry,
    setInterval: (fn, ms) => setInterval(fn, ms),
  },
});
const APPS = _appMp.APPS;
const _mp = (_mpRef = _appMp.mp);
const _duelMode = _appMp.duelMode;

