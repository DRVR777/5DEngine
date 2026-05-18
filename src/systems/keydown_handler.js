// Keydown handler — all keyboard action routing for the game.
// mountKeydownHandler(deps) → void  (registers addEventListener at call time)
// Keys object is mutated directly (keys[code] = true/false).
export function mountKeydownHandler({
  keys,
  invDiv,
  renderInventory,
  getState,
  set,
  get,
  actions,
  weaponDropMap,
  coinByType,
}) {
  if (typeof document === "undefined") return;

  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    const s = getState();

    // I toggles inventory
    if (e.code === "KeyI" || (e.code === "Escape" && invDiv.classList.contains("open"))) {
      invDiv.classList.toggle("open", !invDiv.classList.contains("open"));
      if (invDiv.classList.contains("open")) renderInventory();
      e.preventDefault();
      return;
    }

    // When computer is OPEN or animating in, Escape cancels/closes it.
    if (s.computerOpen || s.computerEntering) {
      if (e.code === "Escape") { actions.closeComputer(); e.preventDefault(); }
      if (s.computerOpen) return;
      return;
    }

    // E near NPC → open dialog
    if (e.code === "KeyE" && !get.npcDialog().isOpen && !s.nearComputer && !s.computerEntering) {
      const hero = s.world.players.get("hero");
      let closestNpc = null, closestDist = 2.5;
      for (const n of s.NPC_DEFS) {
        const np = s.world.players.get(n.id);
        const d = Math.hypot(hero.u - np.u, hero.v - np.v);
        if (d < closestDist) { closestDist = d; closestNpc = n; }
      }
      if (closestNpc) { get.npcDialog().open(closestNpc.id); e.preventDefault(); return; }
    }

    // Close NPC dialog with E or Escape
    if (get.npcDialog().isOpen && (e.code === "KeyE" || e.code === "Escape")) {
      get.npcDialog().close(); e.preventDefault(); return;
    }

    // E near computer → open desktop OS
    if (e.code === "KeyE" && s.nearComputer && !s.computerEntering) {
      actions.beginComputerEntry(); e.preventDefault(); return;
    }

    // E on in-world screen
    if (e.code === "KeyE" && !s.nearComputer) {
      if (actions.tryClickWorldScreen()) { e.preventDefault(); return; }
    }

    // Build-mode undo/redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
    if (s.buildMode && get.worldBuilder() && (e.ctrlKey || e.metaKey)) {
      if (e.code === "KeyZ" && e.shiftKey) { get.worldBuilder().redo(); actions.playSfx("blip", 0.3); e.preventDefault(); return; }
      if (e.code === "KeyZ")               { get.worldBuilder().undo(); actions.playSfx("click", 0.3); e.preventDefault(); return; }
      if (e.code === "KeyY")               { get.worldBuilder().redo(); actions.playSfx("blip", 0.3); e.preventDefault(); return; }
    }

    // Snap-zone keybinds
    if (window.CameraSpine && !e.ctrlKey && !e.metaKey) {
      if (e.code === "KeyQ") { set.snapZoomTarget(window.CameraSpine.zoomForZone("FIRST_PERSON") * s.CAM_DIST_MAX); e.preventDefault(); return; }
      if (e.code === "KeyV") { set.snapZoomTarget(window.CameraSpine.zoomForZone("THIRD_PERSON") * s.CAM_DIST_MAX); e.preventDefault(); return; }
      if (e.code === "KeyZ") { set.snapZoomTarget(window.CameraSpine.zoomForZone("BIRD_VIEW")    * s.CAM_DIST_MAX); e.preventDefault(); return; }
    }

    // Tab: creative inv (build) / shop (play)
    if (e.code === "Tab") {
      if (s.buildMode) {
        if (window._openCreativeInv && window._closeCreativeInv) {
          const ci = document.getElementById("creativeInv");
          if (ci && ci.classList.contains("open")) window._closeCreativeInv();
          else window._openCreativeInv && window._openCreativeInv();
        }
      } else if (!s.computerOpen) {
        if (get.shop().isOpen) get.shop().close(); else get.shop().open();
      }
      e.preventDefault(); return;
    }

    // Esc: close panels
    if (e.code === "Escape") {
      const kpEl = document.getElementById("keybindPanel");
      if (kpEl && kpEl.style.display !== "none") { kpEl.style.display = "none"; e.preventDefault(); return; }
      if (get.settings().isOpen) { get.settings().close(); e.preventDefault(); return; }
      if (get.shop().isOpen) { get.shop().close(); e.preventDefault(); return; }
      const ci = document.getElementById("creativeInv");
      if (ci && ci.classList.contains("open")) { window._closeCreativeInv && window._closeCreativeInv(); e.preventDefault(); return; }
    }

    // 1-9: hotbar (build) / weapon (play)
    if (e.code >= "Digit1" && e.code <= "Digit9") {
      const idx = parseInt(e.code.replace("Digit", ""), 10) - 1;
      if (s.buildMode) {
        if (window._hotbarSelectSlot) window._hotbarSelectSlot(idx);
        e.preventDefault(); return;
      } else {
        const weps = s.CFG.weapons || [];
        if (weps[idx]) {
          set.weaponAmmoEntry(s.currentWeaponId, s.pistolAmmo);
          const nw = weps[idx];
          set.currentWeaponId(nw.id);
          const stored = get.weaponAmmoEntry(nw.id);
          set.pistolAmmo(stored !== undefined ? stored : nw.magCap);
          if (s._reloading) { set.reloading(false); set.reloadMsg(""); set.reloadMsgUntil(0); }
          actions.switchGunMesh(nw.id);
          set.weaponSwitchT(0.30);
          actions.playSfx("click", 0.4);
          set.reloadMsg(nw.name || nw.id); set.reloadMsgUntil(performance.now() + 1000);
          actions.showWeaponSelector();
          e.preventDefault(); return;
        }
      }
    }

    // F: flashlight (play) / hotbar spawn (build)
    if (e.code === "KeyF") {
      if (s.buildMode && window._hotbarSpawn) { window._hotbarSpawn(); e.preventDefault(); return; }
      if (!s.buildMode && !s.computerOpen) {
        const on = !s._flashlightOn;
        set.flashlightOn(on);
        set.flashLightIntensity(on ? 2.8 : 0);
        actions.showToast(on ? "Flashlight ON" : "Flashlight OFF", "info", 800);
        e.preventDefault(); return;
      }
    }

    // T: smoke grenade
    if (e.code === "KeyT" && !s.buildMode && !s.computerOpen && !s._heroDead) {
      actions.throwSmokeGrenade(); e.preventDefault(); return;
    }

    // U: flashbang
    if (e.code === "KeyU" && !s.buildMode && !s.computerOpen && !s._heroDead) {
      actions.throwFlashbang(); e.preventDefault(); return;
    }

    // M: drop mine (play mode only — mouse-mode is handled below)
    if (e.code === "KeyM" && !s.buildMode && !s.computerOpen && !s._heroDead && !s.mouseMode) {
      actions.dropMine(); e.preventDefault(); return;
    }

    // G: grenade cook (play) / group selected (build)
    if (e.code === "KeyG") {
      if (s.buildMode && window._builderGroupSelected) { window._builderGroupSelected(); e.preventDefault(); return; }
      if (!s.buildMode && !s.computerOpen && s.grenadeCount > 0 && !s._heroDead) {
        if (!s._grenadePressT) set.grenadePressT(performance.now());
        e.preventDefault(); return;
      }
    }

    // R: pointer-lock toggle (build) — reload handled below
    if (s.buildMode && e.code === "KeyR") {
      if (document.pointerLockElement) document.exitPointerLock();
      else get.renderer().domElement.requestPointerLock();
      e.preventDefault(); return;
    }

    // P: turret (play) / char editor (build)
    if (!s.buildMode && !s.computerOpen && e.code === "KeyP") { actions.placeTurret(); e.preventDefault(); return; }
    if (s.buildMode && e.code === "KeyP") {
      const ced = document.getElementById("charEditor");
      if (ced) {
        const show = ced.style.display === "none";
        ced.style.display = show ? "block" : "none";
        if (show) get.heroAnim().refreshCharEditor();
      }
      e.preventDefault(); return;
    }

    // J: quest panel
    if (e.code === "KeyJ" && !s.computerOpen) {
      get.quest().togglePanel(); e.preventDefault(); return;
    }

    // H: scene hierarchy (build) / medkit (play)
    if (s.buildMode && e.code === "KeyH") {
      const shp = document.getElementById("sceneHierarchy");
      if (shp) {
        const show = !shp.classList.contains("visible");
        shp.classList.toggle("visible", show);
        if (show) actions.renderSceneHierarchy();
      }
      e.preventDefault(); return;
    }
    if (e.code === "KeyH" && !s.buildMode && !s.computerOpen && !s._heroDead) {
      const medCount = (typeof Inv !== "undefined") ? Inv.countItem(s.heroInv, "medkit") : 0;
      if (medCount > 0) {
        Inv.removeItem(s.heroInv, "medkit", 1);
        const healed = Math.min(40, s.HERO_MAX_HP + s._perkMaxHpBonus - s.heroHp);
        set.heroHp(Math.min(s.HERO_MAX_HP + s._perkMaxHpBonus, s.heroHp + 40));
        set.heroLastDamageT(-999);
        actions.playSfx("tone:700:120:sine", 0.4);
        const _mkHero = s.world.players.get("hero");
        actions.spawnDamageNumber(_mkHero.u, 2.1, _mkHero.v, `+${Math.round(healed)} HP`, "#00ff88");
        actions.showToast(`Medkit used — +${Math.round(healed)} HP`, "success", 1200);
        actions.spawnParticles(_mkHero.u, 1.2, _mkHero.v, 8, "white", 3, 0.5);
      } else {
        actions.showToast("No medkits! Buy from shop (Tab)", "danger", 1200);
        actions.playSfx("tone:200:60:sine", 0.2);
      }
      e.preventDefault(); return;
    }

    // Ctrl+R: toggle rain
    if (e.code === "KeyR" && e.ctrlKey && !s.buildMode) {
      if (typeof Rain !== "undefined") Rain.toggle();
      actions.showToast(s._rainActive ? "Rain started" : "Rain stopped", "info");
      e.preventDefault(); return;
    }

    // C: crafting panel
    if (e.code === "KeyC" && !s.buildMode && !s.computerOpen) {
      if (typeof Crafting !== "undefined") {
        const cp = document.getElementById("_craftPanel");
        const show = !cp || cp.style.display === "none";
        Crafting.showPanel(show, s.heroInv);
      }
      e.preventDefault(); return;
    }

    // G (non-build): achievement panel
    if (e.code === "KeyG" && !s.buildMode && !s.computerOpen) {
      if (typeof Achievements !== "undefined") {
        const ap = document.getElementById("_achPanel");
        const show = !ap || ap.style.display === "none";
        Achievements.showPanel(show);
      }
      e.preventDefault(); return;
    }

    // N: melee (play) / spawn point (build)
    if (e.code === "KeyN" && !s.buildMode && !s.computerOpen && !s._heroDead && s._meleeCooldown <= 0) {
      set.meleeCooldown(0.8);
      set.meleeSwing(1.0);
      actions.playSfx("tone:120:80:square", 0.25);
      const _hma = s.world.players.get("hero");
      for (let _mi = 0; _mi < 8; _mi++) {
        const _mAng = s.camYaw + (-Math.PI / 3) + (_mi / 7) * (2 * Math.PI / 3);
        const _mU = _hma.u + Math.sin(_mAng) * 1.4, _mV = _hma.v + Math.cos(_mAng) * 1.4;
        actions.spawnParticles(_mU, _hma.y + 1.0, _mV, 2, "cyan", 6, 0.15);
      }
      const hm = s.world.players.get("hero");
      let enemyKills = s.enemyKills;
      let comboCount = s.comboCount;
      for (const en of s.enemies) {
        if (en.dead) continue;
        const ep = s.world.players.get(en.id);
        const d = Math.hypot(ep.u - hm.u, ep.v - hm.v);
        if (d < 1.5) {
          const mDmg = 35;
          en.hp = Math.max(0, en.hp - mDmg); en._hpBarShowT = performance.now() / 1000;
          en._kbU = (ep.u - hm.u) * 4; en._kbV = (ep.v - hm.v) * 4; en._kbT = 0.15;
          en._staggerT = 0.4; en._staggerAngle = Math.atan2(ep.u - hm.u, ep.v - hm.v) + Math.PI;
          en._flinchX = -0.5;
          set.hitMarkerUntil(performance.now() + 120);
          actions.spawnDamageNumber(ep.u, 1.2, ep.v, `-${mDmg}`, "#ff8800");
          actions.spawnParticles(ep.u, 1.2, ep.v, 4, "orange", 4, 0.2);
          actions.playSfx("tone:200:60:sawtooth", 0.3);
          if (en.hp === 0 && !en.dead) {
            en.dead = true; en.respawnT = performance.now() / 1000; en._wasChasing = false;
            enemyKills++; comboCount++;
            set.comboLastT(performance.now() / 1000);
            actions.spawnDecal(ep.u, ep.v, en.type === "robot" ? "oil" : "blood");
            if (en.type === "incendiary") actions.spawnFirePatch(ep.u, ep.v);
            if (en.type === "poisoner")   actions.spawnPoisonPuddle(ep.u, ep.v);
            actions.addKillFeedEntry(`★ MELEE KILL #${enemyKills} — ${en.type}`, "#ff8800");
            actions.trackKillAndPanic(ep.u, ep.v);
            actions.spawnAmmoPickup(ep.u, ep.v, en.dropQty || 12, en.dropAmmo);
            if (weaponDropMap[en.type]) actions.spawnWeaponPickup(ep.u + 0.5, ep.v + 0.5, weaponDropMap[en.type]);
            const _mCoinMul = Math.min(8, comboCount);
            actions.spawnCoinDrop(ep.u, ep.v, (coinByType[en.type] || 1) * _mCoinMul);
          }
        }
      }
      set.enemyKills(enemyKills);
      set.comboCount(comboCount);
      for (const cr of s.crates) {
        if (cr.broken) continue;
        if (Math.hypot(cr.u - hm.u, cr.v - hm.v) < 1.5) {
          cr.hp -= 35;
          if (cr.hp <= 0) actions.breakCrate(cr);
        }
      }
      e.preventDefault(); return;
    }
    if (s.buildMode && e.code === "KeyN") {
      const sp = actions.addSpawnPoint(s.freeCamPos.x, s.freeCamPos.z);
      get.quest().completeQuestStep("world", 1);
      actions.showToast(`Spawn point ${sp.label} placed`, "success");
      e.preventDefault(); return;
    }

    // X: dodge roll
    if (e.code === "KeyX" && !s.buildMode && !s.computerOpen && !s._heroDead && !s.inCar && s._dodgeCooldown <= 0 && s._stamina >= 20) {
      const hm = s.world.players.get("hero");
      const _fwd = new THREE.Vector3(); get.camera().getWorldDirection(_fwd); _fwd.y = 0; _fwd.normalize();
      const _rgt = new THREE.Vector3(-_fwd.z, 0, _fwd.x);
      const _dF = (keys["KeyW"] ? 1 : 0) - (keys["KeyS"] ? 1 : 0);
      const _dR = (keys["KeyD"] ? 1 : 0) - (keys["KeyA"] ? 1 : 0);
      const dfU = (_fwd.x * _dF + _rgt.x * _dR) || _fwd.x;
      const dfV = (_fwd.z * _dF + _rgt.z * _dR) || _fwd.z;
      const dm = Math.hypot(dfU, dfV) || 1;
      set.dodgeVelU((dfU / dm) * s.DODGE_SPEED);
      set.dodgeVelV((dfV / dm) * s.DODGE_SPEED);
      set.dodgeT(s.DODGE_DURATION);
      set.dodgeCooldown(s.DODGE_COOLDOWN);
      set.stamina(Math.max(0, s._stamina - 20));
      actions.applyScreenShake(0.08);
      actions.playSfx("tone:280:60:square", 0.18);
      e.preventDefault(); return;
    }

    // K: config editor (build)
    if (s.buildMode && e.code === "KeyK") {
      const ced = document.getElementById("cfgEditor");
      if (ced) {
        const show = ced.style.display === "none";
        ced.style.display = show ? "block" : "none";
        if (show && get.cfgEditor()) get.cfgEditor().build();
      }
      e.preventDefault(); return;
    }

    // ?: keybind panel
    if (e.key === "?" && !s.buildMode && !s.computerOpen) {
      const kp = document.getElementById("keybindPanel");
      if (kp) kp.style.display = kp.style.display === "none" ? "block" : "none";
      e.preventDefault(); return;
    }

    // O: env panel (build) / settings (play)
    if (e.code === "KeyO") {
      if (s.buildMode) {
        const ep = document.getElementById("envPanel");
        if (ep) ep.style.display = ep.style.display === "none" ? "block" : "none";
      } else {
        if (get.settings().isOpen) get.settings().close(); else get.settings().open();
      }
      e.preventDefault(); return;
    }

    // B: toggle build mode
    if (e.code === "KeyB" && window.Builder) {
      const newBm = !s.buildMode;
      set.buildMode(newBm);
      if (get.worldBuilder()) get.worldBuilder().setActive(newBm);
      if (newBm) {
        get.quest().completeQuestStep("world", 0);
        const hp = s.world.players.get("hero");
        const hRender = get.bridge().engineToRenderPos(hp);
        set.freeCamPos(hRender.x, hRender.y + 3, hRender.z - 6);
        set.freeCamYaw(s.camYaw);
        set.freeCamPitch(s.camPitch);
        if (document.pointerLockElement) document.exitPointerLock();
      }
      e.preventDefault(); return;
    }

    // Ctrl+D: clone selected (build)
    if (s.buildMode && get.worldBuilder() && (e.ctrlKey || e.metaKey) && e.code === "KeyD") {
      if (get.worldBuilder().cloneSelected()) actions.playSfx("blip", 0.4);
      e.preventDefault(); return;
    }

    // Arrow keys / page / bracket / scale / delete (build, selected object)
    if (s.buildMode && get.worldBuilder()) {
      const sel = get.worldBuilder().getSelected();
      if (sel) {
        const step = e.shiftKey ? 1.0 : 0.25;
        if (e.code === "ArrowUp")    { get.worldBuilder().translate(0, 0, -step); e.preventDefault(); return; }
        if (e.code === "ArrowDown")  { get.worldBuilder().translate(0, 0,  step); e.preventDefault(); return; }
        if (e.code === "ArrowLeft")  { get.worldBuilder().translate(-step, 0, 0); e.preventDefault(); return; }
        if (e.code === "ArrowRight") { get.worldBuilder().translate( step, 0, 0); e.preventDefault(); return; }
        if (e.code === "PageUp")     { get.worldBuilder().translate(0,  step, 0); e.preventDefault(); return; }
        if (e.code === "PageDown")   { get.worldBuilder().translate(0, -step, 0); e.preventDefault(); return; }
        if (e.code === "BracketLeft")  { get.worldBuilder().rotateY(-Math.PI / 16); e.preventDefault(); return; }
        if (e.code === "BracketRight") { get.worldBuilder().rotateY( Math.PI / 16); e.preventDefault(); return; }
        if (e.code === "Equal" || e.code === "NumpadAdd")      { get.worldBuilder().scaleBy(1.1);    e.preventDefault(); return; }
        if (e.code === "Minus" || e.code === "NumpadSubtract") { get.worldBuilder().scaleBy(1/1.1); e.preventDefault(); return; }
        if (e.code === "Delete" || e.code === "Backspace")     { get.worldBuilder().deleteSelected(); e.preventDefault(); return; }
      }
    }

    // M: toggle mouse-mode
    if (e.code === "KeyM") {
      if (s.mouseMode) {
        actions.exitScreenMouseMode();
      } else {
        let best = null, bestD = 50;
        const hp = s.world.players.get("hero");
        for (const [, entry] of s.worldScreens) {
          const pos = entry.mesh.position;
          const d = Math.hypot(pos.x - hp.u, pos.z - hp.v);
          if (entry.screen.widthM >= 5 && d < bestD) { best = entry.screen; bestD = d; }
        }
        if (best) actions.enterScreenMouseMode(best, { x: 0.5, y: 0.5 });
      }
      e.preventDefault(); return;
    }

    // Esc: exit mouse-mode
    if (e.code === "Escape" && s.mouseMode) {
      actions.exitScreenMouseMode(); e.preventDefault(); return;
    }

    // L: flip camera shoulder
    if (e.code === "KeyL") {
      set.camSide(-s.camSide); e.preventDefault(); return;
    }

    // R: reload weapon
    if (e.code === "KeyR") {
      if (s._reloading) { e.preventDefault(); return; }
      const wep = get.weapon();
      const need = get.pistolMagCap() - s.pistolAmmo;
      if (need <= 0) {
        set.reloadMsg("already full"); set.reloadMsgUntil(performance.now() + 1200);
        e.preventDefault(); return;
      }
      const invAmmo = Inv.countItem(s.heroInv, wep.ammoItem || "pistol_9mm");
      if (invAmmo <= 0) {
        actions.playSfx("noise", 0.2);
        set.reloadMsg("no ammo — pick some up"); set.reloadMsgUntil(performance.now() + 1500);
        e.preventDefault(); return;
      }
      set.reloading(true); set.reloadStart(performance.now());
      actions.playSfx("tone:200:120:square", 0.5); actions.playSfx("click", 0.5);
      set.reloadMsg("reloading…"); set.reloadMsgUntil(performance.now() + get.reloadDur());
      e.preventDefault(); return;
    }

    // E: vehicle enter/exit
    if (e.code === "KeyE") {
      const VDIST = s.CFG.vehicleInteractDist || 3.0;
      let nearestVeh = null, nearestDist = Infinity;
      for (const v of s.VEHICLE_DEFS) {
        const d = get.bridge().uvDist(s.world, "hero", v.id);
        if (d < nearestDist) { nearestDist = d; nearestVeh = v; }
      }
      if (!s.inCar && nearestVeh && nearestDist < VDIST) {
        set.inCar(true); set.activeVehicleId(nearestVeh.id);
        const def = s.VEHICLE_DEFS.find(v => v.id === nearestVeh.id) || null;
        set.activeVehicleDef(def); set.platformsDirty(true);
        if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.VEHICLE_ENTER, { vehicleId: nearestVeh.id, vehicleDef: def });
      } else if (s.inCar && s.activeVehicleId) {
        const _prevVehicleId = s.activeVehicleId;
        set.inCar(false);
        const vst = s.vehicleStates.get(s.activeVehicleId);
        const cp = s.world.players.get(s.activeVehicleId);
        const h = s.world.players.get("hero");
        if (cp && h) {
          s.world.setPlayer("hero", h.x, 0, h.z,
            cp.u + 1.5 * Math.cos(vst.heading),
            cp.v - 1.5 * Math.sin(vst.heading));
        }
        set.activeVehicleId(null); set.activeVehicleDef(null); set.platformsDirty(true);
        if (typeof EventBus !== "undefined") EventBus.emit(EventBus.EVENTS.VEHICLE_EXIT, { vehicleId: _prevVehicleId });
      }
    }
  });
}
