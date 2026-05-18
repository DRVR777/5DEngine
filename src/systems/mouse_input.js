// Mouse input — wheel (weapon switch / zoom), pointer lock, right-click aim, mousemove (camera look).
// mountMouseInput(deps) → void  (registers all mouse event listeners at call time)
export function mountMouseInput({
  getState,
  getRenderer,
  getWorldBuilder,
  getActiveMouseScreen,
  getMouseModeCursor,
  getShop,
  getSettings,
  getNpcDialog,
  setCamYaw,
  setCamPitch,
  setFreeCamYaw,
  setFreeCamPitch,
  setCamDist,
  setAiming,
  setPointerLocked,
  setCurrentWeaponId,
  setPistolAmmo,
  setWeaponAmmoEntry,
  getWeaponAmmoEntry,
  setReloading,
  setReloadMsg,
  setReloadMsgUntil,
  switchGunMesh,
  showWeaponSelector,
  playSfx,
}) {
  if (typeof document === "undefined") return;

  const renderer = getRenderer();
  let dragging = false;
  let lastMouseX = 0, lastMouseY = 0;

  // Scroll wheel: switch weapons in play mode, zoom camera in build mode.
  renderer.domElement.addEventListener("wheel", (e) => {
    e.preventDefault();
    const s = getState();
    if (s.buildMode) {
      const { CAM_DIST_MIN, CAM_DIST_MAX, camDist } = s;
      setCamDist(Math.max(CAM_DIST_MIN, Math.min(CAM_DIST_MAX, camDist + e.deltaY * 0.01)));
      return;
    }
    if (s.computerOpen || s.computerEntering || s._heroDead) return;
    const weps = s.CFG.weapons || [];
    if (weps.length < 2) return;
    const idx = weps.findIndex(w => w.id === s.currentWeaponId);
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = ((idx + dir) % weps.length + weps.length) % weps.length;
    setWeaponAmmoEntry(s.currentWeaponId, s.pistolAmmo);
    const nw = weps[next];
    setCurrentWeaponId(nw.id);
    const nextAmmo = getWeaponAmmoEntry(nw.id);
    setPistolAmmo(nextAmmo !== undefined ? nextAmmo : nw.magCap);
    if (s._reloading) { setReloading(false); setReloadMsg(""); setReloadMsgUntil(0); }
    switchGunMesh(nw.id);
    playSfx("click", 0.4);
    setReloadMsg(nw.name || nw.id);
    setReloadMsgUntil(performance.now() + 800);
    if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.WEAPON_SWITCH, { weaponId: nw.id, ammo: getState().pistolAmmo });
    showWeaponSelector();
  }, { passive: false });

  // Right-click hold to aim
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  renderer.domElement.addEventListener("mousedown", (e) => {
    if (e.button === 2 && !getState().buildMode) { setAiming(true); e.preventDefault(); }
    if (e.button === 0) {
      if (getState().pointerLocked) return;
      dragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY;
    }
  });
  addEventListener("mouseup", (e) => {
    if (e.button === 2) setAiming(false);
    if (e.button === 0) {
      dragging = false;
      const s = getState();
      if (s.buildMode && getWorldBuilder()) {
        getWorldBuilder().dragEnd();
        getWorldBuilder().endAxisDrag();
      }
    }
  });

  // Releasing pointer lock drops the aim
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement) setAiming(false);
  });

  // Click to capture pointer lock (document-level so HUD clicks also trigger)
  document.addEventListener("click", () => {
    const s = getState();
    const _diffOpen = (document.getElementById("difficultyScreen") || {}).style?.display === "flex";
    if (!s.pointerLocked && !s.buildMode && !s.computerOpen && !s.computerEntering &&
        !getShop().isOpen && !getSettings().isOpen && !getNpcDialog().isOpen && !_diffOpen) {
      renderer.domElement.requestPointerLock();
    }
  });
  document.addEventListener("pointerlockchange", () => {
    setPointerLocked(document.pointerLockElement === renderer.domElement);
  });

  // Mouse look (camera rotation) + build-mode drag
  addEventListener("mousemove", (e) => {
    const s = getState();
    if (s.buildMode && getWorldBuilder()) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = {
        x: ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      };
      if (getWorldBuilder().isAxisDragging()) { getWorldBuilder().updateAxisDrag(ndc); return; }
      if (getWorldBuilder().isDragging())     { getWorldBuilder().dragMove(ndc); return; }
    }
    const activeMouseScreen = getActiveMouseScreen();
    if (s.mouseMode && activeMouseScreen) {
      const mx = (typeof e.movementX === "number") ? e.movementX : 0;
      const my = (typeof e.movementY === "number") ? e.movementY : 0;
      const cursor = getMouseModeCursor();
      cursor.x = Math.max(0, Math.min(activeMouseScreen.resolutionW, cursor.x + mx * 1.5));
      cursor.y = Math.max(0, Math.min(activeMouseScreen.resolutionH, cursor.y + my * 1.5));
      return;
    }
    let dx, dy;
    if (s.pointerLocked) {
      dx = e.movementX; dy = e.movementY;
    } else {
      if (!dragging) return;
      dx = e.clientX - lastMouseX; dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX; lastMouseY = e.clientY;
    }
    if (s.buildMode) {
      setFreeCamYaw(s.freeCamYaw   - dx * 0.003);
      setFreeCamPitch(Math.max(-1.4, Math.min(1.4, s.freeCamPitch - dy * 0.003)));
    } else {
      const isScopedIn = s.aiming && s.currentWeaponId === "sniper";
      const sensMul = isScopedIn ? 1 / getSettings().getSniperSens() : 1;
      setCamYaw(s.camYaw   - dx * 0.003 * sensMul);
      setCamPitch(Math.max(-1.2, Math.min(0.4, s.camPitch - dy * 0.003 * sensMul)));
    }
  });
}
