// Settings panel — sniper sensitivity slider + admin weapon editor.
// mountSettingsPanel({ getCFG, getRenderer, getBuildMode, password, initialSniperSens })
// Returns { open(), close(), isOpen, getSniperSens() }
export function mountSettingsPanel({ getCFG, getRenderer, getBuildMode, password, initialSniperSens = 3.0 }) {
  if (typeof document === "undefined") {
    let _s = initialSniperSens;
    return { open: () => {}, close: () => {}, get isOpen() { return false; }, getSniperSens: () => _s };
  }

  let _isOpen = false;
  let _sniperScopeSens = initialSniperSens;
  let _adminUnlocked = false;

  function _renderAdminGrid() {
    const grid = document.getElementById("adminWeaponGrid");
    if (!grid) return;
    const cfg = getCFG ? getCFG() : {};
    const weps = cfg.weapons || [];
    grid.innerHTML = "";
    weps.forEach(w => {
      const row = document.createElement("div");
      row.className = "adminRow";
      row.innerHTML = `<label><b style="color:#ffd166">${w.name || w.id}</b></label>
        <div style="display:flex;gap:6px;align-items:center">
          <span style="width:50px">DMG</span>
          <input type="number" value="${w.damage || 0}" min="1" max="9999" style="width:70px"
            onchange="(function(v){ const idx=(CFG.weapons||[]).findIndex(x=>x.id==='${w.id}');if(idx>=0)CFG.weapons[idx].damage=+v; })(this.value)">
          <span style="width:50px;margin-left:4px">RPM</span>
          <input type="number" value="${w.fireRate ? Math.round(w.fireRate*60) : 0}" min="1" max="9999" style="width:70px"
            onchange="(function(v){ const idx=(CFG.weapons||[]).findIndex(x=>x.id==='${w.id}');if(idx>=0)CFG.weapons[idx].fireRate=v/60; })(this.value)">
        </div>`;
      grid.appendChild(row);
    });
  }

  function open() {
    _isOpen = true;
    document.exitPointerLock();
    const el = document.getElementById("settingsOverlay");
    if (el) el.classList.add("open");
    const sl = document.getElementById("sniperSensSlider");
    if (sl) { sl.value = _sniperScopeSens; sl.dispatchEvent(new Event("input")); }
    if (_adminUnlocked) _renderAdminGrid();
  }

  function close() {
    _isOpen = false;
    const el = document.getElementById("settingsOverlay");
    if (el) el.classList.remove("open");
    const renderer = getRenderer ? getRenderer() : null;
    const bm = getBuildMode ? getBuildMode() : false;
    setTimeout(() => {
      if (!document.pointerLockElement && !bm && renderer) renderer.domElement.requestPointerLock();
    }, 50);
  }

  const closeBtn = document.getElementById("settingsClose");
  if (closeBtn) closeBtn.addEventListener("click", close);

  const sl = document.getElementById("sniperSensSlider");
  const sv = document.getElementById("sniperSensVal");
  if (sl && sv) {
    sl.addEventListener("input", () => {
      _sniperScopeSens = parseFloat(sl.value);
      sv.textContent = _sniperScopeSens.toFixed(1) + "x";
    });
  }

  const unlockBtn = document.getElementById("adminUnlockBtn");
  if (unlockBtn) {
    unlockBtn.addEventListener("click", () => {
      const pw = document.getElementById("adminPwInput")?.value || "";
      const msg = document.getElementById("adminLockMsg");
      if (pw === password) {
        _adminUnlocked = true;
        document.getElementById("adminContent").style.display = "block";
        document.getElementById("adminLockRow").querySelector("input").style.display = "none";
        unlockBtn.style.display = "none";
        if (msg) msg.textContent = "✓ Unlocked";
        _renderAdminGrid();
      } else {
        if (msg) { msg.textContent = "Wrong password"; setTimeout(() => { msg.textContent = ""; }, 1500); }
      }
    });
  }

  return {
    open,
    close,
    get isOpen() { return _isOpen; },
    getSniperSens: () => _sniperScopeSens,
  };
}
