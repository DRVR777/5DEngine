// Legacy clone of mountAssetBootstrap call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 2252..2269
// (context lines 2248..2273)

// Wire quest progress: build mode enter → quest "world" step 0
const _origBuildToggle = () => {};

// Pseudocode: after lazy loader imports settle, replace placeholder meshes from asset manifest.
mountAssetBootstrap({
  THREE,
  Loaders,
  scene,
  get: {
    gunMeshes: () => _gunMeshes,
    gunMount: () => _gunMount,
    carGroup: () => carGroup,
    carBody: () => carBody,
    pickupMeshes: () => (typeof pickupMeshes !== "undefined") ? pickupMeshes : null,
    pickups: () => pickups,
  },
  actions: {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
  },
});

// Pseudocode: build desktop apps, mount computer UI, create LAN session, duel mode, badge, and peer sync.
const _appMp = mountAppMultiplayerWiring({
  THREE, scene,
