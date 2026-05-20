// Extracted from index.html (iter 688) — window._5DTest test harness bridge.
// Activated only when ?_5dtest=1 is in the URL. Zero production impact.
export function mountTestBridge({
  enemies, world, WaveManager, THREE, renderer, camera, composer, scene, Vfx,
  bullets3D, enemyBullets, buildingBlockers, hasLOS, CFG,
  shop, settings, npcDialog,
  get, set, fns,
}) {
  if (typeof location === "undefined" || !new URLSearchParams(location.search).has("_5dtest")) return;

  let _lowPower = false;
  let _infiniteAmmo = false;
  let _crashHandlerInstalled = false;
  const _errors = [];

  const _safe = fn => { try { return fn(); } catch (e) { return { ok: false, error: e.message, stack: e.stack }; } };
  const _hero = () => world.players.get("hero") || { u: 0, v: 0, y: 0 };

  const _enemySnapshot = () => {
    const hpOf = en => en.hp ?? en.health ?? 0;
    return enemies.map(en => {
      const ep = world.players.get(en.id) || { u: null, v: null, y: null };
      const hp = hpOf(en);
      const hero = _hero();
      return {
        id: en.id,
        type: en.type || en.kind || "enemy",
        u: ep.u, v: ep.v, y: ep.y ?? null,
        hp,
        maxHp: en.maxHp ?? en.hpMax ?? en.baseHp ?? hp,
        dead: !!en.dead || hp <= 0,
        distance: Number.isFinite(ep.u) && Number.isFinite(ep.v) ? Math.hypot(ep.u - hero.u, ep.v - hero.v) : null,
        hasLOS: Number.isFinite(ep.u) && Number.isFinite(ep.v) ? hasLOS(hero.u, hero.v, ep.u, ep.v, buildingBlockers) : null,
      };
    });
  };

  const _waveState = () => {
    const ws = typeof WaveManager !== "undefined" ? WaveManager.getState() : {};
    const live = enemies.filter(en => !en.dead && (en.hp ?? 1) > 0).length;
    return {
      number: ws.wave ?? null,
      phase: ws.phase ?? null,
      aliveCount: ws.aliveCount ?? live,
      totalEnemies: ws.enemies ? ws.enemies.reduce((n, g) => n + (g.count || 0), 0) : live,
      countdown: ws.countdown ?? 0,
      pauseLeft: ws.pauseLeft ?? 0,
      perkPickerVisible: document.getElementById("perkPicker")?.style?.display !== "none",
    };
  };

  window._5DTest = {
    installCrashHandler: () => {
      if (_crashHandlerInstalled) return { ok: true, installed: false };
      window.addEventListener("error", e => {
        _errors.push({ type: "error", message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno });
      });
      window.addEventListener("unhandledrejection", e => {
        _errors.push({ type: "unhandledrejection", message: String(e.reason?.message || e.reason || "") });
      });
      _crashHandlerInstalled = true;
      return { ok: true, installed: true };
    },
    getErrors: () => _errors.slice(),
    clearErrors: () => { _errors.length = 0; return { ok: true }; },
    bootStatus: () => ({ ok: true, hasWorld: !!world, hasHero: !!world.players.get("hero"), hasWaveManager: typeof WaveManager !== "undefined" }),
    setLowPowerMode: () => _safe(() => {
      _lowPower = true;
      window._5DTestLowPower = true;
      if (renderer) {
        renderer.setPixelRatio(0.01);
        renderer.setSize(1, 1, false);
      }
      const canvas = document.getElementById("gameCanvas") || document.querySelector("canvas");
      if (canvas) {
        canvas.width = 1; canvas.height = 1;
        canvas.style.width = "1px"; canvas.style.height = "1px";
      }
      if (composer?.setSize) composer.setSize(1, 1);
      return { ok: true, width: 1, height: 1, noRender: get.noRender() };
    }),
    state: () => {
      const hero = _hero();
      const weapon = fns.getWeapon();
      return {
        hero: {
          u: hero.u, v: hero.v, y: hero.y,
          hp: get.heroHp(),
          maxHp: get.HERO_MAX_HP() + (get.perkMaxHpBonus() || 0),
          ammo: get.pistolAmmo(),
          dead: !!get.heroDead(),
          weaponId: get.currentWeaponId(),
          godMode: !!(window.Engine?.debug?.godMode),
          infiniteAmmo: _infiniteAmmo,
        },
        enemies: _enemySnapshot(),
        wave: _waveState(),
        camera: { yaw: get.camYaw(), pitch: get.camPitch(), dist: get.camDist(), mode: get.buildMode() ? "build" : get.camDist() < 0.5 ? "fp" : "tp" },
        perf: {
          fps: get.fpsDisplay() || 0,
          frameTimeMs: Math.max(0, performance.now() - get.lastT()),
          lastFrameMs: get.lastT(),
          memoryMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        },
        counts: {
          particles: Vfx.getCounts?.().particles ?? 0,
          bullets: bullets3D.length,
          enemyBullets: enemyBullets.length,
          listeners: null, intervals: null,
          meshes: scene?.children?.length ?? null,
          materials: null, geometries: null,
        },
        blocked: window._5DTest.isBlocked(),
        weapon: { id: weapon.id, ammoItem: weapon.ammoItem || null },
      };
    },
    dismissAllDialogs: () => _safe(() => {
      const dismissed = [];
      if (typeof fns.closeComputer === "function") { fns.closeComputer(); dismissed.push("computer"); }
      set.computerOpen(false); set.computerEntering(false); set.firstLaunch(false);
      if (shop?.isOpen) { shop.close(); dismissed.push("shop"); }
      if (settings?.isOpen) { settings.close(); dismissed.push("settings"); }
      if (npcDialog?.isOpen) { npcDialog.close(); dismissed.push("npc_dialog"); }
      const inv = document.getElementById("inventory");
      if (inv?.classList?.contains("open")) { inv.classList.remove("open"); dismissed.push("inventory"); }
      const death = document.getElementById("deathScreen");
      if (death && death.style.display !== "none") { death.style.display = "none"; dismissed.push("death"); }
      set.buildMode(false);
      return { ok: true, dismissed, remaining: window._5DTest.isBlocked().blocked ? [window._5DTest.isBlocked().by] : [] };
    }),
    isBlocked: () => {
      const perk = document.getElementById("perkPicker");
      if (perk && perk.style.display !== "none") return { blocked: true, by: "perk_picker" };
      if (get.computerOpen() || get.computerEntering()) return { blocked: true, by: "computer" };
      if (shop?.isOpen) return { blocked: true, by: "shop" };
      if (settings?.isOpen) return { blocked: true, by: "settings" };
      if (npcDialog?.isOpen) return { blocked: true, by: "npc_dialog" };
      if (get.buildMode()) return { blocked: true, by: "build_mode" };
      return { blocked: false, by: null };
    },
    startWaveMode: () => _safe(() => {
      window._5DTest.dismissAllDialogs();
      set.gameMode("wave_defense");
      if (typeof WaveManager !== "undefined") {
        const ws = WaveManager.getState();
        if (!ws.started || ws.phase === "idle" || ws.phase === "done") {
          WaveManager.reset();
          WaveManager.start();
        }
        for (let i = 0; i < 18; i++) WaveManager.tick(0.35);
      }
      if (!enemies.some(en => !en.dead && (en.hp ?? 1) > 0) && typeof fns.spawnEnemyAtHero === "function") {
        fns.spawnEnemyAtHero("grunt");
      }
      return { ok: true, wave: _waveState() };
    }),
    pickFirstPerk: () => _safe(() => {
      const overlay = document.getElementById("perkPicker");
      if (!overlay || overlay.style.display === "none") return { ok: true, picked: null, reason: "no perk picker visible" };
      const card = document.querySelector("#perkCards > div");
      if (!card) { overlay.style.display = "none"; return { ok: true, picked: null, reason: "no perk card available" }; }
      const picked = card.textContent || "first";
      card.click();
      return { ok: true, picked };
    }),
    pickPreferredPerk: (preferredLabels = []) => _safe(() => {
      const overlay = document.getElementById("perkPicker");
      if (!overlay || overlay.style.display === "none") return { ok: true, picked: null, reason: "no perk picker visible" };
      const cards = [...document.querySelectorAll("#perkCards > div")];
      if (cards.length === 0) { overlay.style.display = "none"; return { ok: true, picked: null, reason: "no perk card available" }; }
      const preferred = preferredLabels.map(s => String(s).toLowerCase());
      const card = cards.find(c => preferred.some(p => c.textContent.toLowerCase().includes(p))) || cards[0];
      const picked = card.textContent || "first";
      card.click();
      return { ok: true, picked };
    }),
    ensureGodModeAndInfiniteAmmo: () => _safe(() => {
      window.Engine.debug.godMode = true;
      _infiniteAmmo = true;
      window._5DTestInfiniteAmmo = true;
      set.heroDead(false);
      set.heroHp(get.HERO_MAX_HP() + (get.perkMaxHpBonus() || 0));
      set.reloading(false);
      for (const w of (CFG.weapons || [])) get.weaponAmmo().set(w.id, w.magCap || 999);
      set.pistolAmmo(fns.getWeapon().magCap || 999);
      return { ok: true, heroHp: get.heroHp(), ammo: get.pistolAmmo() };
    }),
    healthState: () => ({ hp: get.heroHp(), maxHp: get.HERO_MAX_HP() + (get.perkMaxHpBonus() || 0), dead: !!get.heroDead(), armor: get.heroArmor() }),
    lockOnNearestEnemy: () => _safe(() => {
      const hero = _hero();
      const target = _enemySnapshot()
        .filter(en => !en.dead && Number.isFinite(en.u) && Number.isFinite(en.v))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!target) return null;
      set.camYaw(Math.atan2(target.u - hero.u, target.v - hero.v));
      set.camPitch(-0.08);
      set.aiming(true);
      camera.lookAt(target.u, (target.y ?? 0) + 1.0, target.v);
      camera.updateMatrixWorld(true);
      return target.id;
    }),
    shootNearestBurst: (shots = 1) => _safe(() => {
      const id = window._5DTest.lockOnNearestEnemy();
      if (!id || id.ok === false) return { ok: false, id: null, shots: 0, reason: "no target" };
      let fired = 0;
      const maxShots = _lowPower ? 1 : Math.max(1, shots);
      for (let i = 0; i < maxShots; i++) {
        if (_infiniteAmmo) {
          set.reloading(false);
          set.pistolAmmo(fns.getWeapon().magCap || get.pistolAmmo() || 999);
          get.weaponAmmo().set(get.currentWeaponId(), get.pistolAmmo());
        }
        set.pistolCooldown(0);
        fns.tryShoot();
        fired++;
      }
      return { ok: true, id, shots: fired };
    }),
    fireAtEnemyByPosition: (id = null, options = {}) => _safe(() => {
      const hero = _hero();
      const target = id
        ? enemies.find(en => en.id === id && !en.dead && (en.hp ?? 1) > 0)
        : _enemySnapshot().filter(en => !en.dead && Number.isFinite(en.u) && Number.isFinite(en.v))
            .sort((a, b) => a.distance - b.distance)[0];
      if (!target) return { ok: false, id: null, reason: "no target" };
      const ep = world.players.get(target.id);
      if (!ep) return { ok: false, id: target.id, reason: "target has no position" };
      const du = ep.u - hero.u, dv = ep.v - hero.v;
      const dist = Math.hypot(du, dv) || 1;
      const dirU = du / dist, dirV = dv / dist;
      const spawnNearTarget = !!options.spawnNearTarget;
      const startU = spawnNearTarget ? ep.u - dirU * 0.25 : hero.u;
      const startV = spawnNearTarget ? ep.v - dirV * 0.25 : hero.v;
      const startY = spawnNearTarget ? ((ep.y ?? 0) + 1.1) : hero.y + 1.1;
      const wep = fns.getWeapon();
      if (_infiniteAmmo) {
        set.reloading(false);
        set.pistolAmmo(wep.magCap || get.pistolAmmo() || 999);
        get.weaponAmmo().set(get.currentWeaponId(), get.pistolAmmo());
      }
      const mesh = new THREE.Object3D();
      mesh.position.set(startU, startY, startV);
      bullets3D.push({
        mesh, posU: startU, posV: startV, posY: startY,
        dirU, dirY: 0, dirV,
        speed: spawnNearTarget ? 30 : Math.max(30, Math.min(120, dist * 12)),
        traveled: 0,
        range: spawnNearTarget ? 2 : Math.max(10, dist + 5),
        damage: wep.damage || 12,
        falloff: wep.falloff || 0,
        weaponId: get.currentWeaponId(),
      });
      set.shotsFired(get.shotsFired() + 1);
      set.lastHeroShotT(performance.now() / 1000);
      set.heroShotAlertU(hero.u);
      set.heroShotAlertV(hero.v);
      set.heroShotAlertT(3.0);
      return { ok: true, id: target.id, distance: dist, spawnNearTarget };
    }),
    moveHeroTo: (u, v, y = null) => _safe(() => {
      const hero = _hero();
      const ny = Number.isFinite(y) ? y : hero.y;
      world.setPlayer("hero", u, ny, v, u, v);
      return { ok: true, hero: { u, v, y: ny } };
    }),
    moveHeroTowardEnemy: (id = null, desiredDistance = 4) => _safe(() => {
      const hero = _hero();
      const target = id
        ? enemies.find(en => en.id === id && !en.dead && (en.hp ?? 1) > 0)
        : _enemySnapshot().filter(en => !en.dead && Number.isFinite(en.u) && Number.isFinite(en.v))
            .sort((a, b) => a.distance - b.distance)[0];
      if (!target) return { ok: false, reason: "no target" };
      const ep = world.players.get(target.id);
      if (!ep) return { ok: false, id: target.id, reason: "target has no position" };
      const du = hero.u - ep.u, dv = hero.v - ep.v;
      const len = Math.hypot(du, dv) || 1;
      const dist = Math.max(1, desiredDistance);
      const u = ep.u + (du / len) * dist, v = ep.v + (dv / len) * dist;
      world.setPlayer("hero", u, hero.y, v, u, v);
      set.camYaw(Math.atan2(ep.u - u, ep.v - v));
      set.camPitch(-0.08);
      return { ok: true, id: target.id, hero: { u, v, y: hero.y }, distance: dist };
    }),
    tickGame: (steps = 1, dt = 0.033) => _safe(() => {
      if (typeof fns.gameTick !== "function") return { ok: false, error: "gameTick not exposed" };
      const maxSteps = Math.max(1, Math.min(300, steps | 0));
      const safeDt = Math.max(0.001, Math.min(0.1, Number(dt) || 0.033));
      for (let i = 0; i < maxSteps; i++) {
        set.lastT(performance.now() - safeDt * 1000);
        fns.gameTick();
      }
      return { ok: true, steps: maxSteps, dt: safeDt };
    }),
    advanceWaveClock: (steps = 1, dt = 0.35) => _safe(() => {
      const maxSteps = Math.max(1, Math.min(60, steps | 0));
      const safeDt = Math.max(0.016, Math.min(1, Number(dt) || 0.35));
      if (typeof WaveManager !== "undefined") {
        for (let i = 0; i < maxSteps; i++) WaveManager.tick(safeDt);
      }
      return { ok: true, steps: maxSteps, dt: safeDt, wave: _waveState() };
    }),
    killEnemy: (id) => _safe(() => {
      const en = enemies.find(e => e.id === id);
      if (!en) return { ok: false, error: "enemy not found" };
      en.hp = 0; en.dead = true; en._hpBarShowT = performance.now() / 1000;
      return { ok: true, id };
    }),
    killNearestEnemy: () => {
      const id = window._5DTest.lockOnNearestEnemy();
      if (!id || id.ok === false) return id;
      return window._5DTest.killEnemy(id);
    },
    forceNextWave: () => _safe(() => {
      for (const en of enemies) {
        if (String(en.id).startsWith("en_spawned_")) { en.hp = 0; en.dead = true; }
      }
      if (typeof WaveManager !== "undefined") WaveManager.tick(1);
      return { ok: true, wave: _waveState() };
    }),
    hardReset: () => _safe(() => {
      window._5DTest.dismissAllDialogs();
      set.heroDead(false);
      set.heroHp(get.HERO_MAX_HP() + (get.perkMaxHpBonus() || 0));
      for (const en of enemies) { en.dead = true; en.hp = 0; }
      if (typeof WaveManager !== "undefined") { WaveManager.reset(); WaveManager.start(); }
      return { ok: true };
    }),
    perfSnapshot: () => window._5DTest.state().perf,
    shoot: () => {
      try {
        if (_infiniteAmmo) {
          set.reloading(false);
          set.pistolAmmo(fns.getWeapon().magCap || get.pistolAmmo() || 999);
          get.weaponAmmo().set(get.currentWeaponId(), get.pistolAmmo());
        }
        fns.tryShoot();
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    setWeapon: (id) => { set.currentWeaponId(id); fns.switchGunMesh(id); },
    setAiming: (on) => { set.aiming(!!on); },
    closeOverlays: () => {
      if (typeof fns.closeComputer === "function") fns.closeComputer();
      set.computerOpen(false); set.computerEntering(false); set.firstLaunch(false);
      shop?.close(); settings?.close();
    },
    getWeaponIds: () => (typeof CFG !== "undefined" && CFG.weapons) ? CFG.weapons.map(w => w.id) : [],
    switchWeapon: (id) => { try { window._5DTest.setWeapon(id); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnHealth:       (u, v) => { try { fns.spawnHealthPickup(u, v, 30);              return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnAmmo:         (u, v) => { try { fns.spawnAmmoPickup(u, v, 30, "pistol_9mm"); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnArmor:        (u, v) => { try { fns.spawnArmorShard(u, v, 10);               return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnWeaponPickup: (u, v, id) => { try { fns.spawnWeaponPickup(u, v, id);         return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnCoinDrop:     (u, v) => { try { fns.spawnCoinDrop(u, v, 5);                  return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnFirePatch:    (u, v) => { try { fns.spawnFirePatch(u, v, 2, 5);              return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    spawnPoisonPuddle: (u, v) => { try { fns.spawnPoisonPuddle(u, v);                return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    triggerWaveStart: (waveNum) => {
      try {
        if (typeof fns.spawnSpeedOrb === "function" && waveNum >= 2) {
          const _ang = Math.random() * Math.PI * 2, _dist = 4 + Math.random() * 4;
          fns.spawnSpeedOrb(Math.cos(_ang) * _dist, Math.sin(_ang) * _dist);
        }
        return { ok: true };
      } catch (e) { return { ok: false, error: e.message }; }
    },
    throwGrenade:   () => { try { fns.throwGrenade(0);       return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    throwSmoke:     () => { try { fns.throwSmokeGrenade();   return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    throwFlashbang: () => { try { fns.throwFlashbang();      return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    dropMine:       () => { try { fns.dropMine();            return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    openShop:       () => { try { shop.open();               return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    closeShop:      () => { try { shop.close();              return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    openSettings:   () => { try { settings.open();           return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    closeSettings:  () => { try { settings.close();          return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    showPerkPicker: (wave) => { try { fns.showPerkPicker(wave || 1); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    openNpcDialog:  (id) => { try { npcDialog.open(id || "merchant"); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    closeNpcDialog: () => { try { npcDialog.close();         return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    setHeroHp:   (hp) => { try { set.heroHp(Math.max(0, Math.min(get.HERO_MAX_HP() + (get.perkMaxHpBonus() || 0), hp))); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    applyDamage: (dmg) => { try { set.heroHp(Math.max(0, get.heroHp() - dmg)); fns.flashDamage(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    setGameMode: (mode) => { try { set.gameMode(mode); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } },
    getState: () => window._5DTest.state(),
    legacyState: () => ({
      camDist:            get.camDist(),
      currentWeaponId:    get.currentWeaponId(),
      gameMode:           get.gameMode(),
      pistolAmmo:         get.pistolAmmo(),
      heroHp:             get.heroHp(),
      heroAlive:          !get.heroDead(),
      pointerLocked:      get.pointerLocked(),
      bulletCount:        bullets3D.length,
      scopeVisible:       document.getElementById("scopeOverlay")?.style?.display === "block",
      shopOpen:           shop?.isOpen,
      settingsOpen:       settings?.isOpen,
      npcDialogOpen:      npcDialog?.isOpen,
      buildMode:          get.buildMode(),
      speedOrbCount:      get.speedOrbs().length,
      healthPickupCount:  get.healthPickups().length,
      coinDropCount:      get.coinDrops().length,
      firePatchCount:     get.firePatches().length,
      poisonPuddleCount:  get.poisonPuddles().length,
      mineCount:          get.mines().length,
      inCar:              get.inCar(),
    }),
  };
  console.info("[5DTest] test bridge active");
}
