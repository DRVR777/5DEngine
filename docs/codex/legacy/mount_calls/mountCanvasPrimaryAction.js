// Legacy clone of mountCanvasPrimaryAction call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1605..1605
// (context lines 1601..1609)

  });
}

// Pseudocode: LMB on canvas routes to build picking, screen mouse-mode, or gameplay shoot.
mountCanvasPrimaryAction({ renderer, get: { buildMode: () => buildMode, worldBuilder: () => worldBuilder, pointerLocked: () => pointerLocked, builderMultiList: () => window._builderMultiList, mouseMode: () => mouseMode, activeMouseScreen: () => activeMouseScreen, mouseModeCursor: () => mouseModeCursor, inventoryOpen: () => invDiv.classList.contains("open"), computerOpen: () => computerOpen, computerEntering: () => computerEntering, inCar: () => inCar, activeVehicleId: () => activeVehicleId, activeVehicleDef: () => _activeVehicleDef }, actions: { playSfx, getScreenMesh: () => window.ScreenMesh || null, getBuildConsoleHover: () => window._bcHoverRegion, getBuildConsoleScreen: () => window._buildConsoleScreen, tryDroneShoot: (...args) => _tryDroneShoot(...args), tryShoot: (...args) => _tryShoot(...args) } });

// Central shoot function — called from click and from auto-fire tick
let _mouseHeld = false;
document.addEventListener("mousedown", (e) => { if (e.button === 0) _mouseHeld = true; });
