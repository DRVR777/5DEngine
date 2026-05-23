// Legacy clone of mountDeviceGraphWiring call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1120..1129
// (context lines 1116..1133)

let jumbotronScreen = null;
let skyScreen = null;

// Pseudocode: wire PC/monitor/speaker/USB/radios, visible proxies, wires, and mon1 mirror.
const { deviceBus } = mountDeviceGraphWiring({
  THREE,
  scene,
  devicesApi: window.Devices || null,
  wiresApi: window.Wires || null,
  screenMesh: window.ScreenMesh || null,
  worldData: WD,
  computerEntity,
  worldScreens,
});

// ═══ EXTRACTED → src/systems/media_pickups.js (iter 574)
const { heroMedia, worldMedia, spawnMedia: _spawnMedia, tick: _mediaPickupsTick } = mountMediaPickups({ THREE, scene, actions: { playSfx: (str, vol) => playSfx(str, vol) } });
_spawnMedia({ id: "cd_mix", kind: "cd", label: "MIX_2026",
