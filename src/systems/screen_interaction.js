// Extracted from index.html (iter 682) — in-world screen interaction.
// Handles E-key raycast into worldScreens, mouse-mode entry for big screens,
// and cursor placement. Range limit: 50m. Big-screen threshold: 5m wide.
export function mountScreenInteraction({ THREE, getScreenMesh, get, set, exitPointerLock = () => {} }) {
  function tryClickWorldScreen() {
    const SM = getScreenMesh();
    if (!SM) return false;
    const worldScreens = get.worldScreens();
    if (!worldScreens || worldScreens.size === 0) return false;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), get.camera());

    const meshes = Array.from(worldScreens.values()).map(s => s.mesh);
    const screenMap = new Map();
    for (const [id, s] of worldScreens) screenMap.set(id, s.screen);

    const hit = SM.pickScreen(raycaster, meshes, screenMap);
    if (!hit || !hit.screen) return false;
    if (hit.distance > 50) return false;

    if (hit.screen.widthM >= 5 && !get.mouseMode()) {
      enterScreenMouseMode(hit.screen, hit.uv);
      return true;
    }

    const region = SM.hitTest(hit.screen, hit.uv);
    if (!region) return false;
    if (typeof region.onClick === "function") region.onClick(hit.screen);
    return true;
  }

  function enterScreenMouseMode(screen, uv) {
    set.activeMouseScreen(screen);
    set.mouseMode(true);
    set.mouseModeCursorX((uv ? uv.x : 0.5) * screen.resolutionW);
    set.mouseModeCursorY((uv ? (1 - uv.y) : 0.5) * screen.resolutionH);
    exitPointerLock();
  }

  function exitScreenMouseMode() {
    set.activeMouseScreen(null);
    set.mouseMode(false);
  }

  return { tryClickWorldScreen, enterScreenMouseMode, exitScreenMouseMode };
}
