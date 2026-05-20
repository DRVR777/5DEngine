// Extracted from index.html world-builder setup.
// Behavior-preservation phase: preserve window bridges, DOM ids, tuning numbers, and sync timing.

export function mountWorldBuilderHotbar({
  documentRef = document,
  windowRef = window,
  worldBuilder,
  get,
  actions,
}) {
  const document = documentRef;
  const hotbarSlots = Array(9).fill(null);
  let hotbarActive = 0;
  const multiSelectList = [];
  windowRef._builderMultiList = multiSelectList;

  const PRIM_ICONS = { cube:"🟦", sphere:"🔵", cylinder:"🔶", plane:"🟩", light:"💡" };

  function hotbarSlotEl(i) {
    return document.querySelector('.hb-slot[data-slot="' + i + '"]');
  }

  function refreshHotbar() {
    for (let i = 0; i < 9; i++) {
      const el = hotbarSlotEl(i);
      if (!el) continue;
      const slot = hotbarSlots[i];
      const iconEl = el.querySelector(".hb-icon");
      const nameEl = el.querySelector(".hb-name");
      if (slot) {
        iconEl.textContent = slot.primitive ? (PRIM_ICONS[slot.primitive] || "📦") : "📂";
        nameEl.textContent = slot.primitive || (slot.name ? slot.name.replace(/\.\w+$/, "").slice(0, 12) : "?");
      } else {
        iconEl.textContent = "➕";
        nameEl.textContent = "empty";
      }
      el.classList.toggle("active", i === hotbarActive);
    }
  }

  function setHotbarSlot(i, entry) {
    hotbarSlots[i] = entry;
    refreshHotbar();
  }

  function spawnHotbarActive() {
    const slot = hotbarSlots[hotbarActive];
    if (!slot) return;
    const hp = get.heroPos();
    const camYaw = get.camYaw();
    const fx = Math.sin(camYaw) * 2.5;
    const fz = Math.cos(camYaw) * 2.5;
    const pos = { x: hp.u + fx, y: 1.0, z: hp.v + fz };
    if (slot.primitive) {
      worldBuilder.spawnPrimitive(slot.primitive, pos);
      actions.playSfx("blip", 0.4);
    } else if (slot.assetData) {
      worldBuilder.spawnFromLibrary(slot, pos).then(() => { actions.playSfx("blip", 0.4); });
    }
  }

  document.getElementById("hotbar").addEventListener("click", (e) => {
    const sl = e.target.closest(".hb-slot");
    if (!sl) return;
    const i = parseInt(sl.dataset.slot, 10);
    if (i === hotbarActive) {
      spawnHotbarActive();
    } else {
      hotbarActive = i;
      refreshHotbar();
    }
  });

  windowRef._hotbarSelectSlot = (i) => { hotbarActive = i; refreshHotbar(); };
  windowRef._hotbarSpawn = spawnHotbarActive;

  function refreshCreativeInv() {
    const ciAssets = document.getElementById("ciAssets");
    if (!ciAssets) return;
    const lib = worldBuilder.getLibrary();
    if (lib.length === 0) {
      ciAssets.innerHTML = '<span style="color:#555;font-size:10px">none yet — drag .glb/.obj/.fbx into the window</span>';
    } else {
      ciAssets.innerHTML = lib.map((e, i) =>
        `<div class="ci-item" data-libidx="${i}">
          <div class="ci-icon">📂</div>
          <div class="ci-label">${e.name.replace(/\.\w+$/, "").slice(0,14)}</div>
        </div>`
      ).join("");
    }
  }

  let creativeOpen = false;
  function openCreativeInv() {
    creativeOpen = true;
    refreshCreativeInv();
    document.getElementById("creativeInv").classList.add("open");
  }
  function closeCreativeInv() {
    creativeOpen = false;
    document.getElementById("creativeInv").classList.remove("open");
  }
  windowRef._openCreativeInv = openCreativeInv;
  windowRef._closeCreativeInv = closeCreativeInv;

  document.getElementById("ciPrimitives").addEventListener("click", (e) => {
    const item = e.target.closest(".ci-item");
    if (!item) return;
    setHotbarSlot(hotbarActive, { primitive: item.dataset.kind });
    closeCreativeInv();
    actions.playSfx("blip", 0.3);
  });
  document.getElementById("ciAssets").addEventListener("click", (e) => {
    const item = e.target.closest(".ci-item");
    if (!item) return;
    const idx = parseInt(item.dataset.libidx, 10);
    const lib = worldBuilder.getLibrary();
    if (lib[idx]) { setHotbarSlot(hotbarActive, lib[idx]); closeCreativeInv(); actions.playSfx("blip", 0.3); }
  });
  document.getElementById("creativeInv").addEventListener("click", (e) => {
    if (e.target === document.getElementById("creativeInv")) closeCreativeInv();
  });

  function refreshTexPanel() {
    const sw = document.getElementById("texSwatches");
    if (!sw) return;
    const texs = worldBuilder.getTextures();
    if (texs.length === 0) {
      sw.innerHTML = '<span style="color:#555;font-size:9px">none — drop PNG/JPG below</span>';
    } else {
      sw.innerHTML = texs.map((t, i) =>
        `<div class="tex-swatch" title="${t.name}" data-texidx="${i}"
              style="background-image:url('${t.dataUrl}')"></div>`
      ).join("");
    }
  }
  document.getElementById("texSwatches").addEventListener("click", (e) => {
    const sw = e.target.closest(".tex-swatch");
    if (!sw) return;
    const idx = parseInt(sw.dataset.texidx, 10);
    const texs = worldBuilder.getTextures();
    if (texs[idx]) {
      const ok = worldBuilder.applyTexture(texs[idx].dataUrl);
      if (ok) actions.playSfx("blip", 0.4);
    }
  });
  const texDrop = document.getElementById("texDropZone");
  texDrop.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none";
    document.body.appendChild(inp);
    inp.click();
    inp.addEventListener("change", () => {
      const file = inp.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        worldBuilder.addTexture(file.name, ev.target.result);
        refreshTexPanel();
        actions.playSfx("blip", 0.3);
      };
      reader.readAsDataURL(file);
      document.body.removeChild(inp);
    });
  });
  texDrop.addEventListener("dragover", (e) => { e.preventDefault(); });
  texDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    for (const file of (e.dataTransfer && e.dataTransfer.files) || []) {
      if (!file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = (ev) => {
        worldBuilder.addTexture(file.name, ev.target.result);
        refreshTexPanel();
        actions.playSfx("blip", 0.3);
      };
      reader.readAsDataURL(file);
    }
  });
  refreshTexPanel();

  windowRef._builderGroupSelected = () => {
    if (multiSelectList.length >= 2) {
      worldBuilder.groupSelected(multiSelectList);
      multiSelectList.length = 0;
      actions.playSfx("tone:440:80:sine", 0.4);
    } else if (worldBuilder.getSelected()) {
      actions.playSfx("noise", 0.2);
    }
  };

  refreshHotbar();

  let buildSyncDirty = false;
  let applyingRemoteSync = false;
  function markBuildDirty() {
    if (get.gameMode() === "peaceful") buildSyncDirty = true;
  }

  const intervalId = actions.setInterval(() => {
    const mp = get.mp();
    if (!buildSyncDirty || applyingRemoteSync) return;
    if (get.gameMode() !== "coop_build") return;
    if (!mp || !mp.enabled) return;
    buildSyncDirty = false;
    const json = worldBuilder.exportSceneJSON();
    mp.sendEvent("build", { action: "sync", json });
  }, 1000);

  const mpState = get.mpState();
  mpState.onMpBuildEvent = function(data) {
    if (data.action !== "sync" || !data.json) return;
    if (get.gameMode() !== "coop_build" || !worldBuilder) return;
    applyingRemoteSync = true;
    try {
      worldBuilder.importSceneJSON(data.json);
      if (typeof actions.showToast === "function") actions.showToast("Scene synced from peer", "info", 1000);
    } catch (e) {
      actions.warn("[F3] Build sync import failed:", e);
    }
    applyingRemoteSync = false;
  };

  mpState.onMpWelcomeHook = function() {
    const mp = get.mp();
    if (get.gameMode() !== "coop_build" || !worldBuilder) return;
    if (!mp || !mp.enabled) return;
    const json = worldBuilder.exportSceneJSON();
    mp.sendEvent("build", { action: "sync", json });
  };

  const wbOrigSpawn = worldBuilder.spawnPrimitive.bind(worldBuilder);
  const wbOrigDel = worldBuilder.deleteSelected.bind(worldBuilder);
  const wbOrigClone = worldBuilder.cloneSelected.bind(worldBuilder);
  const wbOrigSetPos = worldBuilder.setPosition.bind(worldBuilder);
  const wbOrigSetRot = worldBuilder.setRotation.bind(worldBuilder);
  const wbOrigSetScl = worldBuilder.setScale.bind(worldBuilder);
  const wbOrigSetCol = worldBuilder.setColor.bind(worldBuilder);

  worldBuilder.spawnPrimitive = (...a) => { const r = wbOrigSpawn(...a); markBuildDirty(); return r; };
  worldBuilder.deleteSelected = (...a) => { const r = wbOrigDel(...a); markBuildDirty(); return r; };
  worldBuilder.cloneSelected = (...a) => { const r = wbOrigClone(...a); markBuildDirty(); return r; };
  worldBuilder.setPosition = (...a) => { const r = wbOrigSetPos(...a); markBuildDirty(); return r; };
  worldBuilder.setRotation = (...a) => { const r = wbOrigSetRot(...a); markBuildDirty(); return r; };
  worldBuilder.setScale = (...a) => { const r = wbOrigSetScl(...a); markBuildDirty(); return r; };
  worldBuilder.setColor = (...a) => { const r = wbOrigSetCol(...a); markBuildDirty(); return r; };

  return {
    hotbarSlots,
    multiSelectList,
    refreshHotbar,
    refreshCreativeInv,
    refreshTexPanel,
    intervalId,
    getHotbarActive: () => hotbarActive,
    isCreativeOpen: () => creativeOpen,
  };
}
