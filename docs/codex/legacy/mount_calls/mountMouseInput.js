// Legacy clone of mountMouseInput call site(s).
// Source: game.html @ sha256:c7b57cf73a695b8d
// Cloned by tools/clone_legacy_mounts.mjs — DO NOT EDIT BY HAND.
// Purpose: preserve the exact legacy invocation so substrate work
// can diff against it. Per CLAUDE.md the legacy authority is
// readable until the substrate equivalent proves identical behavior.

// occurrence 1 of 1
// game.html lines 1549..1580
// (context lines 1545..1584)

  }, 50);
}

let pointerLocked = false;
mountMouseInput({
  getState: () => ({
    buildMode, computerOpen, computerEntering, _heroDead,
    mouseMode, aiming, pointerLocked, freeCamYaw, freeCamPitch,
    camYaw, camPitch, camDist, CAM_DIST_MIN, CAM_DIST_MAX, CFG,
    currentWeaponId, pistolAmmo, _reloading,
  }),
  getRenderer:        () => renderer,
  getWorldBuilder:    () => worldBuilder,
  getActiveMouseScreen: () => activeMouseScreen,
  getMouseModeCursor:   () => mouseModeCursor,
  getShop:            () => _shop,
  getSettings:        () => _settings,
  getNpcDialog:       () => _npcDialog,
  setCamYaw:          (v) => { camYaw = v; },
  setCamPitch:        (v) => { camPitch = v; },
  setFreeCamYaw:      (v) => { freeCamYaw = v; },
  setFreeCamPitch:    (v) => { freeCamPitch = v; },
  setCamDist:         (v) => { camDist = v; },
  setAiming:          (v) => { aiming = v; },
  setPointerLocked:   (v) => { pointerLocked = v; },
  setCurrentWeaponId: (v) => { currentWeaponId = v; },
  setPistolAmmo:      (v) => { pistolAmmo = v; },
  setWeaponAmmoEntry: (id, ammo) => { weaponAmmo.set(id, ammo); },
  getWeaponAmmoEntry: (id) => weaponAmmo.get(id),
  setReloading:       (v) => { _reloading = v; },
  setReloadMsg:       (v) => { reloadMsg = v; },
  setReloadMsgUntil:  (v) => { reloadMsgUntil = v; },
  switchGunMesh:      _switchGunMesh,
  showWeaponSelector: _showWeaponSelector,
  playSfx,
});
// ---- physics-lite ----
let velocityY = 0;
let _canDoubleJump = false; // resets to true on ground jump, consumed by mid-air Space
let _spaceWasDown = false;  // rising-edge detection for double jump
