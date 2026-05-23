// Legacy clone of mountWorldScreens call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1216..1239
// (context lines 1212..1243)

const enterScreenMouseMode = (screen, uv) => _screenInteraction.enterScreenMouseMode(screen, uv);
const exitScreenMouseMode  = () => _screenInteraction.exitScreenMouseMode();

// Pseudocode: create jumbotron, sky screen, and build console hit regions.
const _worldScreens = mountWorldScreens({
  THREE,
  scene,
  screenMesh: window.ScreenMesh || null,
  worldScreens,
  worldData: WD,
  get: {
    deviceBus: () => deviceBus,
    heroPos: () => world.players.get("hero"),
    score: () => score,
    pickups: () => pickups,
    heroHp: () => heroHp,
    heroMaxHp: () => HERO_MAX_HP,
    freeCamYaw: () => freeCamYaw,
    worldBuilder: () => worldBuilder,
  },
  set: {
    score: v => { score = v; },
  },
  actions: {
    playSfx,
    showToast,
  },
});
jumbotronScreen = _worldScreens.jumbotronScreen;
skyScreen = _worldScreens.skyScreen;

// ---- gadget system (turrets, mines, grenades) ----
