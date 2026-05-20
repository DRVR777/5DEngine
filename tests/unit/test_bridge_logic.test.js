import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mountTestBridge } from "../../src/bridges/test_bridge.js";

// ── DOM stubs for Node.js environment ────────────────────────────────────────
// The bridge uses document.getElementById and window.addEventListener;
// vitest runs in Node so we provide lightweight stubs.

function stubDom() {
  if (!global.window) global.window = {};
  global.window.addEventListener = vi.fn();
  global.document = {
    getElementById: vi.fn(() => null),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
  };
  if (typeof global.performance === "undefined") {
    global.performance = { now: () => Date.now(), memory: null };
  }
}

// ── shared setup ─────────────────────────────────────────────────────────────

function makeWorld(heroPos = { u: 0, v: 0, y: 0 }, extra = {}) {
  const store = new Map([["hero", heroPos], ...Object.entries(extra)]);
  return {
    players: { get: id => store.get(id) ?? null },
    setPlayer: (id, x, y, z, u, v) => store.set(id, { u, v, y: x }),
  };
}

function makeWaveManager(overrides = {}) {
  return {
    getState: () => ({ wave: 1, phase: "active", aliveCount: 2, enemies: [{ count: 3 }], countdown: 5, pauseLeft: 0, started: true, ...overrides }),
    tick: vi.fn(), reset: vi.fn(), start: vi.fn(),
  };
}

function makeStateBundle() {
  let heroHp = 100, pistolAmmo = 30, heroDead = false, reloading = false;
  let camYaw = 0, camPitch = 0, camDist = 4, buildMode = false, aiming = false;
  let gameMode = "free", computerOpen = false, computerEntering = false, firstLaunch = false;
  let currentWeaponId = "pistol", heroArmor = 0, pointerLocked = false;
  let fpsDisplay = 60, lastT = 0;
  let pistolCooldown = 0, shotsFired = 0;
  let lastHeroShotT = 0, heroShotAlertU = 0, heroShotAlertV = 0, heroShotAlertT = 0;
  const weaponAmmo = new Map([["pistol", 30]]);
  const speedOrbs = [], healthPickups = [], coinDrops = [], firePatches = [], poisonPuddles = [], mines = [];
  let inCar = false;
  return {
    raw: { get heroHp() { return heroHp; }, get pistolAmmo() { return pistolAmmo; }, get heroDead() { return heroDead; }, get camYaw() { return camYaw; }, get camPitch() { return camPitch; }, get buildMode() { return buildMode; }, get aiming() { return aiming; }, get gameMode() { return gameMode; }, get computerOpen() { return computerOpen; }, get currentWeaponId() { return currentWeaponId; }, get shotsFired() { return shotsFired; }, get heroShotAlertT() { return heroShotAlertT; } },
    get: {
      heroHp: () => heroHp, HERO_MAX_HP: () => 100, perkMaxHpBonus: () => 0,
      pistolAmmo: () => pistolAmmo, heroDead: () => heroDead, reloading: () => reloading,
      camYaw: () => camYaw, camPitch: () => camPitch, camDist: () => camDist,
      buildMode: () => buildMode, aiming: () => aiming, gameMode: () => gameMode,
      computerOpen: () => computerOpen, computerEntering: () => computerEntering, firstLaunch: () => firstLaunch,
      currentWeaponId: () => currentWeaponId, heroArmor: () => heroArmor, pointerLocked: () => pointerLocked,
      fpsDisplay: () => fpsDisplay, lastT: () => lastT, noRender: () => false,
      weaponAmmo: () => weaponAmmo, shotsFired: () => shotsFired,
      speedOrbs: () => speedOrbs, healthPickups: () => healthPickups, coinDrops: () => coinDrops,
      firePatches: () => firePatches, poisonPuddles: () => poisonPuddles, mines: () => mines,
      inCar: () => inCar,
    },
    set: {
      heroHp: v => { heroHp = v; }, pistolAmmo: v => { pistolAmmo = v; },
      heroDead: v => { heroDead = v; }, reloading: v => { reloading = v; },
      camYaw: v => { camYaw = v; }, camPitch: v => { camPitch = v; },
      buildMode: v => { buildMode = v; }, aiming: v => { aiming = v; }, gameMode: v => { gameMode = v; },
      computerOpen: v => { computerOpen = v; }, computerEntering: v => { computerEntering = v; },
      firstLaunch: v => { firstLaunch = v; }, currentWeaponId: v => { currentWeaponId = v; },
      pistolCooldown: v => { pistolCooldown = v; }, shotsFired: v => { shotsFired = v; },
      lastHeroShotT: v => { lastHeroShotT = v; }, heroShotAlertU: v => { heroShotAlertU = v; },
      heroShotAlertV: v => { heroShotAlertV = v; }, heroShotAlertT: v => { heroShotAlertT = v; },
      lastT: v => { lastT = v; },
    },
  };
}

function makeFns(overrides = {}) {
  return {
    getWeapon: () => ({ id: "pistol", magCap: 30, damage: 12, falloff: 0, ammoItem: "pistol_9mm" }),
    tryShoot: vi.fn(), switchGunMesh: vi.fn(), closeComputer: vi.fn(),
    flashDamage: vi.fn(), showPerkPicker: vi.fn(),
    spawnHealthPickup: vi.fn(), spawnAmmoPickup: vi.fn(), spawnArmorShard: vi.fn(),
    spawnWeaponPickup: vi.fn(), spawnCoinDrop: vi.fn(), spawnFirePatch: vi.fn(),
    spawnPoisonPuddle: vi.fn(), throwGrenade: vi.fn(), throwSmokeGrenade: vi.fn(),
    throwFlashbang: vi.fn(), dropMine: vi.fn(), spawnSpeedOrb: vi.fn(),
    spawnEnemyAtHero: vi.fn(), gameTick: vi.fn(), ...overrides,
  };
}

function mountWith(opts = {}) {
  Object.defineProperty(global, "location", { value: { search: "?_5dtest=1" }, configurable: true, writable: true });
  stubDom();
  global.window.Engine = { debug: { godMode: false } };

  const world = opts.world ?? makeWorld();
  const st = opts.state ?? makeStateBundle();
  const fns = opts.fns ?? makeFns();
  const WaveManager = opts.WaveManager ?? makeWaveManager();
  const enemies = opts.enemies ?? [];
  const bullets3D = opts.bullets3D ?? [];
  const shop = { isOpen: false, open: vi.fn(), close: vi.fn() };
  const settings = { isOpen: false, open: vi.fn(), close: vi.fn() };
  const npcDialog = { isOpen: false, open: vi.fn(), close: vi.fn() };

  mountTestBridge({
    enemies, world, WaveManager, THREE: { Object3D: class { position = { set: vi.fn() }; } },
    renderer: { setPixelRatio: vi.fn(), setSize: vi.fn() },
    camera: { lookAt: vi.fn(), updateMatrixWorld: vi.fn() },
    composer: { setSize: vi.fn() },
    scene: { children: [] },
    Vfx: { getCounts: () => ({ particles: 0 }) },
    bullets3D, enemyBullets: [], buildingBlockers: [], hasLOS: () => true,
    CFG: { weapons: [{ id: "pistol", magCap: 30 }] },
    shop, settings, npcDialog,
    get: st.get, set: st.set, fns,
  });

  return { world, st, fns, WaveManager, enemies, bullets3D, shop, settings, npcDialog };
}

afterEach(() => { if (global.window) delete global.window._5DTest; });

// ── URL guard ─────────────────────────────────────────────────────────────────

describe("URL guard", () => {
  it("does NOT mount when _5dtest absent from URL", () => {
    Object.defineProperty(global, "location", { value: { search: "" }, configurable: true, writable: true });
    mountTestBridge({
      enemies: [], world: makeWorld(), WaveManager: makeWaveManager(),
      THREE: {}, renderer: null, camera: null, composer: null, scene: {}, Vfx: {},
      bullets3D: [], enemyBullets: [], buildingBlockers: [], hasLOS: () => true, CFG: {},
      shop: {}, settings: {}, npcDialog: {},
      get: makeStateBundle().get, set: makeStateBundle().set, fns: makeFns(),
    });
    expect(global.window?._5DTest).toBeUndefined();
  });

  it("mounts when _5dtest is present", () => {
    mountWith();
    expect(global.window._5DTest).toBeDefined();
  });
});

// ── crash handler ─────────────────────────────────────────────────────────────

describe("installCrashHandler", () => {
  it("installs once, no-op on second call", () => {
    mountWith();
    expect(global.window._5DTest.installCrashHandler()).toEqual({ ok: true, installed: true });
    expect(global.window._5DTest.installCrashHandler()).toEqual({ ok: true, installed: false });
  });

  it("getErrors is empty before any errors", () => {
    mountWith();
    global.window._5DTest.installCrashHandler();
    expect(global.window._5DTest.getErrors()).toEqual([]);
  });

  it("clearErrors empties accumulated errors", () => {
    mountWith();
    global.window._5DTest.installCrashHandler();
    global.window._5DTest.clearErrors();
    expect(global.window._5DTest.getErrors()).toEqual([]);
  });
});

// ── enemy snapshot ────────────────────────────────────────────────────────────

describe("enemy snapshot", () => {
  it("computes distance between hero and enemy", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en1: { u: 3, v: 4, y: 0 } });
    const enemies = [{ id: "en1", type: "grunt", hp: 50, maxHp: 100, dead: false }];
    mountWith({ world, enemies });
    const snap = global.window._5DTest.state().enemies;
    expect(snap[0].distance).toBe(5);
  });

  it("marks enemy dead when hp <= 0", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en2: { u: 1, v: 1, y: 0 } });
    const enemies = [{ id: "en2", type: "grunt", hp: 0, maxHp: 100, dead: false }];
    mountWith({ world, enemies });
    expect(global.window._5DTest.state().enemies[0].dead).toBe(true);
  });

  it("uses .dead flag for dead enemies regardless of hp", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en3: { u: 1, v: 1, y: 0 } });
    const enemies = [{ id: "en3", type: "grunt", hp: 100, maxHp: 100, dead: true }];
    mountWith({ world, enemies });
    expect(global.window._5DTest.state().enemies[0].dead).toBe(true);
  });
});

// ── wave state ────────────────────────────────────────────────────────────────

describe("wave state via WaveManager", () => {
  it("maps WaveManager.getState() into wave object", () => {
    const wm = makeWaveManager({ wave: 4, phase: "pause", aliveCount: 7 });
    mountWith({ WaveManager: wm });
    const w = global.window._5DTest.state().wave;
    expect(w.number).toBe(4);
    expect(w.phase).toBe("pause");
    expect(w.aliveCount).toBe(7);
  });

  it("advanceWaveClock calls tick N times", () => {
    const wm = makeWaveManager();
    mountWith({ WaveManager: wm });
    global.window._5DTest.advanceWaveClock(8, 0.1);
    expect(wm.tick).toHaveBeenCalledTimes(8);
  });

  it("advanceWaveClock clamps steps to 60", () => {
    const wm = makeWaveManager();
    mountWith({ WaveManager: wm });
    global.window._5DTest.advanceWaveClock(999);
    expect(wm.tick).toHaveBeenCalledTimes(60);
  });

  it("advanceWaveClock returns ok:true", () => {
    mountWith();
    const r = global.window._5DTest.advanceWaveClock(3, 0.25);
    expect(r.ok).toBe(true);
    expect(r.steps).toBe(3);
  });
});

// ── hero state accessors ──────────────────────────────────────────────────────

describe("hero state via get/set", () => {
  it("state() reflects heroHp from getter", () => {
    const st = makeStateBundle();
    mountWith({ state: st });
    expect(global.window._5DTest.state().hero.hp).toBe(100);
    st.set.heroHp(42);
    expect(global.window._5DTest.state().hero.hp).toBe(42);
  });

  it("setHeroHp clamps to maxHp", () => {
    const st = makeStateBundle();
    mountWith({ state: st });
    global.window._5DTest.ensureGodModeAndInfiniteAmmo();
    global.window._5DTest.setHeroHp(99999);
    expect(st.raw.heroHp).toBe(100);
  });

  it("ensureGodModeAndInfiniteAmmo sets godMode flag and resets dead", () => {
    const st = makeStateBundle();
    st.set.heroDead(true);
    mountWith({ state: st });
    const r = global.window._5DTest.ensureGodModeAndInfiniteAmmo();
    expect(r.ok).toBe(true);
    expect(global.window.Engine.debug.godMode).toBe(true);
    expect(global.window._5DTestInfiniteAmmo).toBe(true);
    expect(st.raw.heroDead).toBe(false);
  });
});

// ── bullet spawning ───────────────────────────────────────────────────────────

describe("fireAtEnemyByPosition", () => {
  it("pushes one bullet into bullets3D on hit", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en4: { u: 5, v: 0, y: 0 } });
    const enemies = [{ id: "en4", type: "grunt", hp: 50, maxHp: 100, dead: false }];
    const bullets3D = [];
    mountWith({ world, enemies, bullets3D });
    global.window._5DTest.ensureGodModeAndInfiniteAmmo();
    const r = global.window._5DTest.fireAtEnemyByPosition("en4");
    expect(r.ok).toBe(true);
    expect(bullets3D.length).toBe(1);
  });

  it("returns no-target for dead enemy", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en5: { u: 5, v: 0, y: 0 } });
    const enemies = [{ id: "en5", type: "grunt", hp: 0, maxHp: 100, dead: true }];
    mountWith({ world, enemies });
    const r = global.window._5DTest.fireAtEnemyByPosition("en5");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no target");
  });

  it("increments shotsFired counter", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en6: { u: 3, v: 0, y: 0 } });
    const enemies = [{ id: "en6", type: "grunt", hp: 50, maxHp: 100, dead: false }];
    const st = makeStateBundle();
    const bullets3D = [];
    mountWith({ world, enemies, bullets3D, state: st });
    global.window._5DTest.ensureGodModeAndInfiniteAmmo();
    global.window._5DTest.fireAtEnemyByPosition("en6");
    expect(st.raw.shotsFired).toBe(1);
  });
});

// ── hero movement ─────────────────────────────────────────────────────────────

describe("moveHeroTo / moveHeroTowardEnemy", () => {
  it("moveHeroTo updates world position", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 });
    mountWith({ world });
    const r = global.window._5DTest.moveHeroTo(10, 20);
    expect(r.ok).toBe(true);
    expect(world.players.get("hero").u).toBe(10);
    expect(world.players.get("hero").v).toBe(20);
  });

  it("moveHeroTowardEnemy places hero at desired distance", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en7: { u: 10, v: 0, y: 0 } });
    const enemies = [{ id: "en7", type: "grunt", hp: 50, maxHp: 100, dead: false }];
    mountWith({ world, enemies });
    const r = global.window._5DTest.moveHeroTowardEnemy("en7", 3);
    expect(r.ok).toBe(true);
    expect(r.distance).toBe(3);
  });

  it("moveHeroTowardEnemy returns no-target when no enemies", () => {
    mountWith({ enemies: [] });
    const r = global.window._5DTest.moveHeroTowardEnemy(null, 4);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no target");
  });
});

// ── kill helpers ──────────────────────────────────────────────────────────────

describe("killEnemy", () => {
  it("sets hp=0 and dead=true", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en8: { u: 1, v: 1, y: 0 } });
    const en = { id: "en8", type: "grunt", hp: 80, maxHp: 100, dead: false };
    mountWith({ world, enemies: [en] });
    const r = global.window._5DTest.killEnemy("en8");
    expect(r.ok).toBe(true);
    expect(en.hp).toBe(0);
    expect(en.dead).toBe(true);
  });

  it("returns ok:false for unknown id", () => {
    mountWith();
    expect(global.window._5DTest.killEnemy("nope").ok).toBe(false);
  });
});

// ── isBlocked ─────────────────────────────────────────────────────────────────

describe("isBlocked", () => {
  it("not blocked in clean state", () => {
    mountWith();
    expect(global.window._5DTest.isBlocked()).toEqual({ blocked: false, by: null });
  });

  it("blocked when computerOpen=true", () => {
    const st = makeStateBundle();
    mountWith({ state: st });
    st.set.computerOpen(true);
    expect(global.window._5DTest.isBlocked()).toEqual({ blocked: true, by: "computer" });
  });

  it("blocked when buildMode=true", () => {
    const st = makeStateBundle();
    mountWith({ state: st });
    st.set.buildMode(true);
    expect(global.window._5DTest.isBlocked()).toEqual({ blocked: true, by: "build_mode" });
  });
});

// ── setGameMode ───────────────────────────────────────────────────────────────

describe("setGameMode", () => {
  it("updates the game mode", () => {
    const st = makeStateBundle();
    mountWith({ state: st });
    global.window._5DTest.setGameMode("wave_defense");
    expect(st.raw.gameMode).toBe("wave_defense");
  });
});

// ── camYaw / setAiming ────────────────────────────────────────────────────────

describe("lockOnNearestEnemy camera aim", () => {
  it("sets camPitch to -0.08", () => {
    const world = makeWorld({ u: 0, v: 0, y: 0 }, { en9: { u: 5, v: 0, y: 0 } });
    const enemies = [{ id: "en9", type: "grunt", hp: 50, maxHp: 100, dead: false }];
    const st = makeStateBundle();
    mountWith({ world, enemies, state: st });
    global.window._5DTest.lockOnNearestEnemy();
    expect(st.raw.camPitch).toBe(-0.08);
    expect(st.raw.aiming).toBe(true);
  });
});

// ── tickGame ──────────────────────────────────────────────────────────────────

describe("tickGame", () => {
  it("calls gameTick N times and returns ok with step count", () => {
    const fns = makeFns();
    mountWith({ fns });
    const r = global.window._5DTest.tickGame(5, 0.033);
    expect(r.ok).toBe(true);
    expect(r.steps).toBe(5);
    expect(r.dt).toBeCloseTo(0.033, 3);
    expect(fns.gameTick).toHaveBeenCalledTimes(5);
  });

  it("clamps steps to 300 max", () => {
    const fns = makeFns();
    mountWith({ fns });
    const r = global.window._5DTest.tickGame(9999, 0.033);
    expect(r.ok).toBe(true);
    expect(r.steps).toBe(300);
    expect(fns.gameTick).toHaveBeenCalledTimes(300);
  });

  it("clamps dt between 0.001 and 0.1", () => {
    const fns = makeFns();
    mountWith({ fns });
    const tooFast = global.window._5DTest.tickGame(1, 0.0001);
    expect(tooFast.dt).toBe(0.001);
    const toSlow = global.window._5DTest.tickGame(1, 99);
    expect(toSlow.dt).toBe(0.1);
  });

  it("returns ok:false if gameTick not provided", () => {
    const fns = makeFns({ gameTick: undefined });
    mountWith({ fns });
    const r = global.window._5DTest.tickGame(1);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/gameTick/);
  });

  it("sets lastT before each gameTick call", () => {
    const st = makeStateBundle();
    const capturedLastTs = [];
    const fns = makeFns({
      gameTick: vi.fn(() => { capturedLastTs.push(st.raw ? Date.now() : 0); }),
    });
    mountWith({ fns, state: st });
    global.window._5DTest.tickGame(3, 0.033);
    expect(capturedLastTs).toHaveLength(3);
  });
});
