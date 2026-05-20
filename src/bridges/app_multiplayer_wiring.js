// Extracted from index.html app + multiplayer wiring.
// Behavior-preservation phase: keep app state shape, LAN tick interval, event names, and duel wiring.

export function mountAppMultiplayerWiring({
  THREE,
  scene,
  buildComputerApps,
  addDynamicIcons,
  mountComputerUI,
  createLanSession,
  mountDuelMode,
  mountMpBadge,
  eventBus,
  state,
  get,
  set,
  actions,
}) {
  let mp = null;
  let duelMode = null;

  const APPS = buildComputerApps(() => ({
    getWeapon: get.getWeapon(),
    pistolAmmo: get.pistolAmmo(),
    Inv: get.Inv(),
    heroInv: get.heroInv(),
    heroHealth: get.heroHealth(),
    score: get.score(),
    CFG: get.CFG(),
    world: get.world(),
    inCar: get.inCar(),
    carState: get.carState(),
    camDist: get.camDist(),
    camSide: get.camSide(),
    nearComputer: get.nearComputer(),
    buildings: get.buildings(),
    computerEntity: get.computerEntity(),
    VEHICLE_DEFS: get.VEHICLE_DEFS(),
    deviceBus: get.deviceBus(),
    heroMedia: get.heroMedia(),
    mpState: state.mpState,
    gameMode: get.gameMode(),
    mp,
    duelMode,
  }));
  addDynamicIcons();

  mountComputerUI({
    getAPPS:       () => APPS,
    getDeviceBus:  () => get.deviceBus(),
    getHeroMedia:  () => get.heroMedia(),
    setHeroMedia:  (arr) => set.heroMedia(arr),
    getMpState:    () => state.mpState,
    getDuelMode:   () => duelMode,
    playSfx:       actions.playSfx,
    showToast:     actions.showToast,
    closeComputer: actions.closeComputer,
    setGameMode:   (m) => set.gameMode(m),
    setFirstLaunch:(b) => set.firstLaunch(b),
  });

  mp = createLanSession({
    THREE, scene,
    state: state.mpState,
    getShowToast:  () => typeof actions.showToast === "function" ? actions.showToast : null,
    getEnemies:    () => get.enemies(),
    getCamera:     () => get.camera(),
    getGameState:  () => ({
      camYaw: get.camYaw(),
      currentWeaponId: get.currentWeaponId(),
      heroHp: get.heroHp(),
      inCar: get.inCar(),
      isSprinting: !!(get.keys() && (get.keys()["ShiftLeft"] || get.keys()["ShiftRight"])),
      crouching:   !!(get.keys() && (get.keys()["ControlLeft"] || get.keys()["ControlRight"])),
    }),
  });

  duelMode = mountDuelMode({
    mp,
    get: {
      heroHp:      () => get.heroHp(),
      HERO_MAX_HP: () => get.CFG().heroMaxHp || 100,
      myId:        () => null,
    },
    set: {
      heroHp: (v) => set.heroHp(Math.max(0, Math.min(get.CFG().heroMaxHp || 100, v))),
    },
    actions: {
      showToast: actions.showToast,
      playSfx: actions.playSfx,
      spawnParticles: actions.spawnParticles,
      addKillFeedEntry: actions.addKillFeedEntry,
      teleportHero: (u, y, v) => {
        const hp = get.world().players.get("hero");
        if (hp) { hp.u = u; hp.v = v; hp.y = y; }
      },
    },
  });

  const heroSendIntervalId = actions.setInterval(() => {
    const world = get.world();
    if (!world) return;
    const hp = world.players.get("hero");
    if (hp) mp.send(hp);
  }, 50);

  if (eventBus) {
    eventBus.on(eventBus.EVENTS.ENEMY_KILLED, (data) => {
      mp.sendEvent("enemy_kill", { enemy_id: data.id });
    });
  }

  mountMpBadge({ getPeersSize: () => mp.peers.size });

  return { APPS, mp, duelMode, heroSendIntervalId };
}
