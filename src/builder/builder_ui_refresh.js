// Extracted from index.html.
// Behavior-preservation phase: keep DOM ids, numeric conversions, and refresh order.

export function refreshBuilderUi({
  documentRef,
  buildMode,
  worldBuilder,
  renderSceneHierarchy,
  getScriptRunner,
}) {
  const document = documentRef;
  const panel = document.getElementById("builderUI");
  if (!panel) return;
  panel.style.display = buildMode ? "block" : "none";

  const hb = document.getElementById("hotbar");
  if (hb) hb.classList.toggle("visible", buildMode);
  const tp = document.getElementById("texturePanel");
  if (tp) tp.classList.toggle("visible", buildMode);

  const inspector = document.getElementById("bInspector");
  if (!worldBuilder || !buildMode) {
    if (inspector) inspector.style.display = "none";
    return;
  }

  const uc = document.getElementById("bUndoCount");
  const rc = document.getElementById("bRedoCount");
  if (uc) uc.textContent = worldBuilder.undoDepth();
  if (rc) rc.textContent = worldBuilder.redoDepth();

  const t = worldBuilder.getTransform();
  if (!t) {
    if (inspector) inspector.style.display = "none";
    return;
  }
  inspector.style.display = "block";
  document.getElementById("bSelMeta").textContent =
    (t.meta.primitive ? t.meta.primitive : (t.meta.assetUrl || "mesh"));

  const set = (id, v, fixed) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v.toFixed(fixed != null ? fixed : 2);
  };
  const DEG = 180 / Math.PI;
  set("bPosX", t.pos.x); set("bPosY", t.pos.y); set("bPosZ", t.pos.z);
  set("bRotX", t.rot.x * DEG, 0); set("bRotY", t.rot.y * DEG, 0); set("bRotZ", t.rot.z * DEG, 0);
  set("bSclX", t.scale.x); set("bSclY", t.scale.y); set("bSclZ", t.scale.z);

  const cinfo = worldBuilder.getColor();
  const colorRow = document.getElementById("bColorRow");
  if (cinfo) {
    colorRow.style.display = "block";
    const cel = document.getElementById("bColor");
    if (cel && document.activeElement !== cel) cel.value = cinfo.hex;
    document.getElementById("bColorKind").textContent = cinfo.kind;
  } else {
    colorRow.style.display = "none";
  }

  const ints = worldBuilder.getIntensity();
  const intRow = document.getElementById("bIntensityRow");
  if (ints != null) {
    intRow.style.display = "block";
    const iel = document.getElementById("bIntensity");
    if (iel && document.activeElement !== iel) iel.value = ints;
    document.getElementById("bIntensityVal").textContent = ints.toFixed(1);
  } else {
    intRow.style.display = "none";
  }

  const sel = worldBuilder.getSelected();
  const scriptEl = document.getElementById("bScript");
  const errEl = document.getElementById("bScriptError");
  if (scriptEl && sel && document.activeElement !== scriptEl) {
    scriptEl.value = (t.meta.script) || "";
  }

  const scriptRunner = getScriptRunner ? getScriptRunner() : null;
  if (errEl && sel && scriptRunner) {
    const err = scriptRunner.getError(sel.uuid);
    errEl.textContent = err ? "ERR: " + err : "";
  }

  const shp = document.getElementById("sceneHierarchy");
  if (shp) {
    if (!buildMode) {
      shp.classList.remove("visible");
    } else if (shp.classList.contains("visible")) {
      renderSceneHierarchy();
    }
  }
}

export function mountBuilderUiRefresh({ get, actions, documentRef = document }) {
  return function refresh() {
    return refreshBuilderUi({
      documentRef,
      buildMode: get.buildMode(),
      worldBuilder: get.worldBuilder(),
      renderSceneHierarchy: actions.renderSceneHierarchy,
      getScriptRunner: actions.getScriptRunner,
    });
  };
}
