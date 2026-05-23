// Extracted from index.html renderer canvas primary-button handler.
// Pseudocode: build-mode pick/click, then screen mouse-mode click, then gameplay shoot.
export function handleCanvasPrimaryAction(e, {
  renderer,
  get,
  actions,
}) {
  if (e.button !== 0) return false;

  if (get.buildMode() && get.worldBuilder()) {
    if (get.pointerLocked() && getBuildConsoleHover() && getBuildConsoleScreen()) {
      const sc = getBuildConsoleScreen();
      const region = (sc.hitRegions || []).find(r => r.id === getBuildConsoleHover());
      if (region && typeof region.onClick === "function") {
        region.onClick(sc);
        e.preventDefault();
        return true;
      }
    }
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = {
      x: ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
    };
    const worldBuilder = get.worldBuilder();
    const axis = worldBuilder.pickGizmoAxis(ndc);
    if (axis) {
      worldBuilder.startAxisDrag(axis, ndc);
      e.preventDefault();
      return true;
    }

    const picked = worldBuilder.pickAt(ndc, { allScene: true });
    const wasSelected = worldBuilder.getSelected();
    if (e.shiftKey && picked) {
      const list = get.builderMultiList();
      if (list && !list.includes(picked)) {
        list.push(picked);
        actions.playSfx("blip", 0.2);
      }
      worldBuilder.select(picked);
    } else if (picked && picked === wasSelected) {
      worldBuilder.dragStart();
    } else {
      worldBuilder.select(picked);
      if (!e.shiftKey && get.builderMultiList()) get.builderMultiList().length = 0;
      actions.playSfx("click", 0.3);
    }
    e.preventDefault();
    return true;
  }

  if (get.mouseMode() && get.activeMouseScreen() && getScreenMesh()) {
    const screen = get.activeMouseScreen();
    const uv = {
      x: get.mouseModeCursor().x / screen.resolutionW,
      y: 1 - get.mouseModeCursor().y / screen.resolutionH,
    };
    const region = getScreenMesh().hitTest(screen, uv);
    if (region && typeof region.onClick === "function") region.onClick(screen);
    e.preventDefault();
    return true;
  }

  if (!get.pointerLocked()) return false;
  if (get.inventoryOpen()) return false;
  if (get.computerOpen() || get.computerEntering()) return false;
  if (get.inCar() && get.activeVehicleId() && (get.activeVehicleDef() || {}).type === "drone") {
    actions.tryDroneShoot();
    return true;
  }
  actions.tryShoot();
  return true;

  function getScreenMesh() {
    return actions.getScreenMesh ? actions.getScreenMesh() : null;
  }
  function getBuildConsoleHover() {
    return actions.getBuildConsoleHover ? actions.getBuildConsoleHover() : null;
  }
  function getBuildConsoleScreen() {
    return actions.getBuildConsoleScreen ? actions.getBuildConsoleScreen() : null;
  }
}

export function mountCanvasPrimaryAction({ renderer, get, actions }) {
  renderer.domElement.addEventListener("mousedown", (e) => {
    handleCanvasPrimaryAction(e, { renderer, get, actions });
  });
}
