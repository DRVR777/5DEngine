// Extracted from index.html world-builder setup.
// Behavior-preservation phase: DOM ids, timers, numeric conversions, and labels stay unchanged.

export function mountWorldBuilderControls({
  documentRef = document,
  worldBuilder,
  get,
  actions,
}) {
  const document = documentRef;

  document.querySelectorAll(".b-spawn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.blur();
      const kind = btn.dataset.kind;
      const hp = get.heroPos();
      const camYaw = get.camYaw();
      const fwdX = Math.sin(camYaw) * 2;
      const fwdZ = Math.cos(camYaw) * 2;
      worldBuilder.spawnPrimitive(kind, { x: hp.u + fwdX, y: 1.0, z: hp.v + fwdZ });
      actions.playSfx("blip", 0.4);
    });
  });

  wireInspectorInputs({ document, worldBuilder });
  wireBasicButtons({ document, worldBuilder, actions });
  const refreshSceneList = wireNamedScenes({ document, worldBuilder, actions });
  wireExportImport({ document, worldBuilder, actions });
  rehydrateSavedScene({ worldBuilder, actions });

  return { refreshSceneList };
}

export function wireInspectorInputs({ document, worldBuilder }) {
  const DEG_PER_RAD = 180 / Math.PI;
  const ids = ["bPosX","bPosY","bPosZ","bRotX","bRotY","bRotZ","bSclX","bSclY","bSclZ"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => {
      const px = parseFloat(document.getElementById("bPosX").value);
      const py = parseFloat(document.getElementById("bPosY").value);
      const pz = parseFloat(document.getElementById("bPosZ").value);
      const rxDeg = parseFloat(document.getElementById("bRotX").value);
      const ryDeg = parseFloat(document.getElementById("bRotY").value);
      const rzDeg = parseFloat(document.getElementById("bRotZ").value);
      const sx = parseFloat(document.getElementById("bSclX").value);
      const sy = parseFloat(document.getElementById("bSclY").value);
      const sz = parseFloat(document.getElementById("bSclZ").value);
      worldBuilder.setPosition(px, py, pz);
      worldBuilder.setRotation(rxDeg / DEG_PER_RAD, ryDeg / DEG_PER_RAD, rzDeg / DEG_PER_RAD);
      worldBuilder.setScale(sx, sy, sz);
    });
  }
}

function wireBasicButtons({ document, worldBuilder, actions }) {
  const delBtn = document.getElementById("bDelete");
  if (delBtn) delBtn.addEventListener("click", () => worldBuilder.deleteSelected());
  const cloneBtn = document.getElementById("bClone");
  if (cloneBtn) cloneBtn.addEventListener("click", () => {
    if (worldBuilder.cloneSelected()) actions.playSfx("blip", 0.4);
  });
  const colorEl = document.getElementById("bColor");
  if (colorEl) colorEl.addEventListener("input", () => worldBuilder.setColor(colorEl.value));
  const intEl = document.getElementById("bIntensity");
  if (intEl) intEl.addEventListener("input", () => {
    const v = parseFloat(intEl.value);
    worldBuilder.setIntensity(v);
    document.getElementById("bIntensityVal").textContent = v.toFixed(1);
  });
  const undoBtn = document.getElementById("bUndo");
  if (undoBtn) undoBtn.addEventListener("click", () => { worldBuilder.undo(); actions.playSfx("click", 0.3); });
  const redoBtn = document.getElementById("bRedo");
  if (redoBtn) redoBtn.addEventListener("click", () => { worldBuilder.redo(); actions.playSfx("blip", 0.3); });

  const scriptApply = document.getElementById("bScriptApply");
  const scriptClear = document.getElementById("bScriptClear");
  const scriptEl = document.getElementById("bScript");
  const scriptErrEl = document.getElementById("bScriptError");
  if (scriptApply) scriptApply.addEventListener("click", () => {
    const sel = worldBuilder.getSelected();
    if (!sel) return;
    const code = scriptEl ? scriptEl.value : "";
    worldBuilder.setScript(sel, code);
    const runner = actions.getScriptRunner ? actions.getScriptRunner() : null;
    if (runner) runner.clearCache(sel.uuid);
    if (scriptErrEl) scriptErrEl.textContent = "";
    actions.playSfx("blip", 0.3);
  });
  if (scriptClear) scriptClear.addEventListener("click", () => {
    const sel = worldBuilder.getSelected();
    if (!sel) return;
    worldBuilder.setScript(sel, "");
    const runner = actions.getScriptRunner ? actions.getScriptRunner() : null;
    if (runner) runner.clearCache(sel.uuid);
    if (scriptEl) scriptEl.value = "";
    if (scriptErrEl) scriptErrEl.textContent = "";
  });
}

function wireNamedScenes({ document, worldBuilder, actions }) {
  function refreshSceneList() {
    const sel = document.getElementById("bSceneList");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— select —</option>';
    for (const s of worldBuilder.listNamed()) {
      const opt = document.createElement("option");
      opt.value = s.name; opt.textContent = s.name + " (" + s.count + ")";
      if (s.name === cur) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  refreshSceneList();

  document.getElementById("bSceneSave").addEventListener("click", () => {
    const name = (document.getElementById("bSceneName").value || "").trim();
    if (!name) return;
    const r = worldBuilder.saveNamed(name);
    if (r.ok) { refreshSceneList(); actions.playSfx("blip", 0.4); }
  });
  document.getElementById("bSceneLoad").addEventListener("click", () => {
    const name = document.getElementById("bSceneList").value;
    if (!name) return;
    const r = worldBuilder.loadNamed(name);
    if (r && r.ok) actions.playSfx("blip", 0.5);
  });
  document.getElementById("bSceneDel").addEventListener("click", () => {
    const name = document.getElementById("bSceneList").value;
    if (!name) return;
    if (worldBuilder.deleteNamed(name)) { refreshSceneList(); actions.playSfx("click", 0.3); }
  });

  return refreshSceneList;
}

function wireExportImport({ document, worldBuilder, actions }) {
  document.getElementById("bExport").addEventListener("click", () => {
    const json = worldBuilder.exportSceneJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dwrld-scene-" + Date.now() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    actions.playSfx("blip", 0.4);
  });
  document.getElementById("bImport").addEventListener("click", () => {
    document.getElementById("bImportFile").click();
  });
  document.getElementById("bImportFile").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const r = worldBuilder.importSceneJSON(text);
    if (r && r.ok) actions.playSfx("blip", 0.5);
    e.target.value = "";
  });
}

function rehydrateSavedScene({ worldBuilder, actions }) {
  const prevState = worldBuilder.loadState();
  if (Array.isArray(prevState) && prevState.length > 0) {
    const r = worldBuilder.rehydrate(prevState);
    if (r && r.ok && r.restored > 0) {
      actions.info("Builder: rehydrated " + r.restored + " primitives" +
        (r.skipped > 0 ? " (skipped " + r.skipped + " non-primitives)" : ""));
    }
  }
}
