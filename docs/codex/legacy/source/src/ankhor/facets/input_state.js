/** input-state facet — singleton input device.
 *  On first tick (idempotent), installs document-level event listeners
 *  into a module-scoped store. Every tick, copies the store into the
 *  Thinga's facet data so other facets read input as pure data.
 *
 *  Mouse yaw accumulates (locked-pointer style). Hero camera reads
 *  data.yaw to orient.
 *
 *  Sensitivity is pulled from the input-default-tuning Thinga (no
 *  hardcoded sensitivity number in handler code).
 *
 *  Data shape: { _installed, keys: {KeyW: true, ...}, mouseHeld, yaw } */
const store = {
  installed: false,
  keys: Object.create(null),
  mouseHeld: false,
  yaw: 0,
  mouseDxAccum: 0,
};

function installListeners(sensitivity, mouseButton) {
  if (store.installed) return;
  if (typeof document === "undefined") return;
  document.addEventListener("keydown", (e) => { store.keys[e.code] = true; });
  document.addEventListener("keyup",   (e) => { store.keys[e.code] = false; });
  document.addEventListener("mousedown", (e) => { if (e.button === mouseButton) store.mouseHeld = true; });
  document.addEventListener("mouseup",   (e) => { if (e.button === mouseButton) store.mouseHeld = false; });
  document.addEventListener("mousemove", (e) => {
    const dx = (typeof e.movementX === "number" && e.movementX !== 0) ? e.movementX : 0;
    if (dx) store.mouseDxAccum += dx;
  });
  if (typeof window !== "undefined") {
    window.addEventListener("click", () => {
      if (document.pointerLockElement) return;
      const canvas = document.querySelector("canvas");
      if (canvas?.requestPointerLock) canvas.requestPointerLock();
    });
  }
  store.installed = true;
}

export default {
  priority: 2,
  tick(thing, data, _dt, registry) {
    const { sensitivity, mouseButton } = resolveTuning(registry);
    if (!store.installed) installListeners(sensitivity, mouseButton);

    if (store.mouseDxAccum !== 0) {
      store.yaw -= store.mouseDxAccum * sensitivity;
      store.mouseDxAccum = 0;
    }

    data.keys      = store.keys;
    data.mouseHeld = store.mouseHeld;
    data.yaw       = store.yaw;
    data._installed = store.installed;
  }
};

function resolveTuning(registry) {
  let sensitivity = null, mouseButton = null;
  for (const t of registry.byKind("tuning")) {
    if (t.name !== "input-default-tuning") continue;
    const tuning = registry.facetData(t.id, "tuning") || {};
    sensitivity = tuning.mouse_sensitivity_yaw;
    mouseButton = tuning.mouse_button_primary;
    break;
  }
  return { sensitivity: sensitivity ?? 0, mouseButton: mouseButton ?? 0 };
}
