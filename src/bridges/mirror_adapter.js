/**
 * mirror_adapter.js — ANKHOR Substrate Mirror Adapter for 5DEngine
 *
 * PURPOSE:
 *   Bridges the imperative window.GTAXxx state (game.html legacy layer) INTO
 *   the declarative ThingRegistry (ANKHOR substrate). This is the "register
 *   layer" — the phase boundary between mutation and observation.
 *
 * ARCHITECTURE:
 *   game.html tick() (60Hz via rAF)
 *     → MirrorAdapter.snapshot(window)
 *       → reads window.GTAEngine, window.GTAHealth, window.GTAInventory, etc.
 *       → writes into ThingRegistry via upsert() calls
 *         → hero entity:     kind="hero",  facets=[transform, health, inventory, combat]
 *         → enemy entities:  kind="enemy", facets=[transform, health, ai-state]
 *         → bullet entities: kind="bullet", facets=[transform, physics]
 *         → world metadata:  kind="world",  facets=[world-params, wave-state]
 *
 * REGISTER SCHEMA (the shared membrane):
 *   Each entity's $header.$registers holds fast-access named float registers.
 *   game.html writes raw floats here at 60Hz.
 *   Network bridge reads at 20Hz for STATE channel.
 *   Persistence reads at 1Hz for save/restore.
 *   UI reads at rAF for rendering.
 *
 * USAGE:
 *   // In game.html module, after loading:
 *   import { MirrorAdapter } from "./src/bridges/mirror_adapter.js";
 *   const mirror = new MirrorAdapter(registry); // registry = ThingRegistry instance
 *   mirror.start(); // hooks into the game tick loop
 *
 * Author: SOCRATIC_PROFESSOR_20260326 (Council)
 * Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

// ── Register Name Constants ────────────────────────────────────────────────
export const REG = Object.freeze({
  // Transform registers (60Hz)
  POS_U:     "POS_U",      // world-space U (x-equivalent)
  POS_V:     "POS_V",      // world-space V (y-equivalent)
  POS_LAYER: "POS_LAYER",  // which layer/floor the entity is on
  HEADING:   "HEADING",    // yaw in radians
  SPEED:     "SPEED",      // current movement speed magnitude
  VEL_U:     "VEL_U",      // velocity U component
  VEL_V:     "VEL_V",      // velocity V component

  // Health registers (event-driven, change-only)
  HP:        "HP",
  MAX_HP:    "MAX_HP",
  ARMOR:     "ARMOR",
  MAX_ARMOR: "MAX_ARMOR",
  DEAD:      "DEAD",       // 0 or 1

  // Combat registers (event-driven)
  WEAPON:    "WEAPON",     // weapon id string
  AMMO:      "AMMO",       // current clip
  AMMO_RES:  "AMMO_RES",   // reserve ammo
  KILLS:     "KILLS",
  DEATHS:    "DEATHS",
  RELOADING: "RELOADING",  // 0 or 1

  // AI registers (30Hz for enemies)
  AI_MODE:   "AI_MODE",    // 0=idle 1=patrol 2=chase 3=attack 4=dead
  AI_TARGET: "AI_TARGET",  // entity id of current target (0=none)
  AI_ALERT:  "AI_ALERT",   // 0.0-1.0 alert level

  // Game/Wave registers (1Hz)
  WAVE_NUM:  "WAVE_NUM",
  WAVE_PHASE:"WAVE_PHASE", // 0=idle 1=running 2=boss 3=intermission
  ENEMY_CT:  "ENEMY_CT",   // live enemy count

  // Network registers (written by NetworkBridge on receive)
  NET_LATENCY: "NET_LATENCY",  // last RTT in ms
  NET_PEER_ID: "NET_PEER_ID",  // owning peer id hash
  NET_SEQ:     "NET_SEQ",      // last received sequence number
});

// ── Register Metadata (write frequency + sync policy) ────────────────────
export const REG_META = {
  [REG.POS_U]:      { hz: 60, threshold: 0.01,  sync: "state",  persist: false },
  [REG.POS_V]:      { hz: 60, threshold: 0.01,  sync: "state",  persist: false },
  [REG.POS_LAYER]:  { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.HEADING]:    { hz: 60, threshold: 0.05,  sync: "state",  persist: false },
  [REG.SPEED]:      { hz: 60, threshold: 0.05,  sync: "state",  persist: false },
  [REG.VEL_U]:      { hz: 60, threshold: 0.01,  sync: "state",  persist: false },
  [REG.VEL_V]:      { hz: 60, threshold: 0.01,  sync: "state",  persist: false },

  [REG.HP]:         { hz: 0,  threshold: 0.5,   sync: "event",  persist: true  },
  [REG.MAX_HP]:     { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.ARMOR]:      { hz: 0,  threshold: 0.5,   sync: "event",  persist: true  },
  [REG.MAX_ARMOR]:  { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.DEAD]:       { hz: 0,  threshold: 0,     sync: "event",  persist: true  },

  [REG.WEAPON]:     { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.AMMO]:       { hz: 0,  threshold: 0,     sync: "event",  persist: false },
  [REG.AMMO_RES]:   { hz: 0,  threshold: 0,     sync: "event",  persist: false },
  [REG.KILLS]:      { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.DEATHS]:     { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.RELOADING]:  { hz: 0,  threshold: 0,     sync: "state",  persist: false },

  [REG.AI_MODE]:    { hz: 30, threshold: 0,     sync: "event",  persist: false },
  [REG.AI_TARGET]:  { hz: 30, threshold: 0,     sync: "event",  persist: false },
  [REG.AI_ALERT]:   { hz: 30, threshold: 0.1,   sync: "state",  persist: false },

  [REG.WAVE_NUM]:   { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.WAVE_PHASE]: { hz: 0,  threshold: 0,     sync: "event",  persist: true  },
  [REG.ENEMY_CT]:   { hz: 2,  threshold: 0,     sync: "state",  persist: false },
};

// ── MirrorAdapter ──────────────────────────────────────────────────────────
export class MirrorAdapter {
  /**
   * @param {ThingRegistry} registry - The ANKHOR ThingRegistry instance
   * @param {object} [opts]
   * @param {number} [opts.stateHz=20]   - Rate for "state" sync channel sampling
   * @param {number} [opts.persistHz=1]  - Rate for persistence snapshots
   * @param {boolean} [opts.debug=false] - Emit debug events
   */
  constructor(registry, opts = {}) {
    this._registry = registry;
    this._stateHz = opts.stateHz ?? 20;
    this._persistHz = opts.persistHz ?? 1;
    this._debug = opts.debug ?? false;

    // Previous register values for delta detection
    this._prev = new Map();   // entityId → { [regName]: value }

    // Cached entity IDs
    this._enemyIds = new Set();
    this._bulletIds = new Set();

    // State sampling accumulators
    this._stateAccum = 0;
    this._persistAccum = 0;

    // Subscribers for state-channel snapshots
    this._stateSubscribers = new Set();
    this._eventSubscribers = new Set();

    this._running = false;
    this._lastFrameTime = null;
    this._rafHandle = null;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  start() {
    if (this._running) return;
    this._running = true;
    this._ensureHeroEntity();
    this._ensureWorldEntity();
    const tick = (nowMs) => {
      if (!this._running) return;
      const dt = this._lastFrameTime !== null ? (nowMs - this._lastFrameTime) / 1000 : 0;
      this._lastFrameTime = nowMs;
      this._tick(dt);
      this._rafHandle = requestAnimationFrame(tick);
    };
    this._rafHandle = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  /** Subscribe to state-channel snapshots (emitted at stateHz). */
  onStateSnapshot(fn) {
    this._stateSubscribers.add(fn);
    return () => this._stateSubscribers.delete(fn);
  }

  /** Subscribe to individual register change events. */
  onRegisterChange(fn) {
    this._eventSubscribers.add(fn);
    return () => this._eventSubscribers.delete(fn);
  }

  /** Force a full snapshot right now (useful for save/restore). */
  snapshot() {
    this._snapshotHero();
    this._snapshotEnemies();
    this._snapshotWorld();
    return this._buildStatePacket();
  }

  // ── Internal tick ─────────────────────────────────────────────────────────

  _tick(dt) {
    this._stateAccum += dt;
    this._persistAccum += dt;

    // Always mirror hero at 60Hz (every frame) — cheap, registers are just float writes
    this._snapshotHero();

    // Enemy snapshot at 30Hz
    if (this._stateAccum >= 1 / 30) {
      this._snapshotEnemies();
      this._snapshotBullets();
    }

    // State sync channel at stateHz (default 20Hz)
    if (this._stateAccum >= 1 / this._stateHz) {
      this._stateAccum = 0;
      const packet = this._buildStatePacket();
      for (const fn of this._stateSubscribers) fn(packet);
    }

    // Persistence snapshot at persistHz (default 1Hz)
    if (this._persistAccum >= 1 / this._persistHz) {
      this._persistAccum = 0;
      this._snapshotWorld();
      // Future: write to IndexedDB via local_db_bridge.js
    }
  }

  // ── Hero mirroring ────────────────────────────────────────────────────────

  _snapshotHero() {
    const W = window;
    if (!W.Engine) return;

    const hero = W._heroState ?? {};       // legacy hero state object
    const health = W.GTAHealth;
    const inv = W.GTAInventory;
    const guns = W.GTAGuns;
    const engine = W.Engine;

    const heroId = "hero";
    const regs = {};

    // Transform (read from Engine state or hero object)
    regs[REG.POS_U]     = hero.u ?? hero.x ?? 0;
    regs[REG.POS_V]     = hero.v ?? hero.y ?? 0;
    regs[REG.POS_LAYER] = hero.layer ?? 0;
    regs[REG.HEADING]   = hero.heading ?? hero.yaw ?? 0;
    regs[REG.SPEED]     = hero.speed ?? 0;
    regs[REG.VEL_U]     = hero.velU ?? hero.vx ?? 0;
    regs[REG.VEL_V]     = hero.velV ?? hero.vy ?? 0;

    // Health
    if (health) {
      const hs = health.getHeroStats?.() ?? {};
      regs[REG.HP]        = hs.hp        ?? hero.hp        ?? 100;
      regs[REG.MAX_HP]    = hs.maxHp     ?? hero.maxHp     ?? 100;
      regs[REG.ARMOR]     = hs.armor     ?? hero.armor     ?? 0;
      regs[REG.MAX_ARMOR] = hs.maxArmor  ?? hero.maxArmor  ?? 100;
      regs[REG.DEAD]      = (regs[REG.HP] <= 0) ? 1 : 0;
    }

    // Combat
    if (guns) {
      const ws = guns.getActiveWeapon?.() ?? {};
      regs[REG.WEAPON]    = ws.id ?? hero.weapon ?? "none";
      regs[REG.AMMO]      = ws.ammo ?? hero.ammo ?? 0;
      regs[REG.AMMO_RES]  = ws.reserve ?? hero.ammoReserve ?? 0;
      regs[REG.RELOADING] = ws.reloading ? 1 : 0;
    }

    if (W._heroKills !== undefined)  regs[REG.KILLS]  = W._heroKills;
    if (W._heroDeaths !== undefined) regs[REG.DEATHS] = W._heroDeaths;

    this._writeRegisters(heroId, regs);
  }

  // ── Enemy mirroring ───────────────────────────────────────────────────────

  _snapshotEnemies() {
    const enemies = window._enemies ?? window.GTAEngine?.enemies ?? [];
    const seen = new Set();

    for (const enemy of enemies) {
      if (!enemy || enemy.dead) continue;
      const id = `enemy-${enemy.id ?? enemy._id ?? Math.random().toString(36).slice(2)}`;
      seen.add(id);

      const regs = {
        [REG.POS_U]:    enemy.u ?? enemy.x ?? 0,
        [REG.POS_V]:    enemy.v ?? enemy.y ?? 0,
        [REG.POS_LAYER]:enemy.layer ?? 0,
        [REG.HEADING]:  enemy.heading ?? 0,
        [REG.SPEED]:    enemy.speed ?? 0,
        [REG.HP]:       enemy.hp ?? 0,
        [REG.MAX_HP]:   enemy.maxHp ?? enemy.hpMax ?? 100,
        [REG.DEAD]:     (enemy.dead || enemy.hp <= 0) ? 1 : 0,

        // AI state: map string modes to integers for register
        [REG.AI_MODE]:   this._encodeAiMode(enemy.mode ?? enemy.state ?? "idle"),
        [REG.AI_TARGET]: enemy.target?.id ? this._hashId(enemy.target.id) : 0,
        [REG.AI_ALERT]:  enemy.alertLevel ?? 0,
      };

      this._writeRegisters(id, regs);
      this._enemyIds.add(id);
    }

    // Remove despawned enemies
    for (const id of this._enemyIds) {
      if (!seen.has(id)) {
        this._registry.remove?.(id);
        this._enemyIds.delete(id);
        this._prev.delete(id);
      }
    }
  }

  // ── Bullet mirroring ──────────────────────────────────────────────────────

  _snapshotBullets() {
    const bullets = window._bullets ?? window.GTAEngine?.bullets ?? [];
    const seen = new Set();

    for (const b of bullets) {
      if (!b || b.dead) continue;
      const id = `bullet-${b.id ?? b._id}`;
      seen.add(id);
      this._writeRegisters(id, {
        [REG.POS_U]:  b.u ?? b.x ?? 0,
        [REG.POS_V]:  b.v ?? b.y ?? 0,
        [REG.VEL_U]:  b.velU ?? b.vx ?? 0,
        [REG.VEL_V]:  b.velV ?? b.vy ?? 0,
        [REG.HEADING]:b.heading ?? 0,
      });
      this._bulletIds.add(id);
    }

    for (const id of this._bulletIds) {
      if (!seen.has(id)) {
        this._registry.remove?.(id);
        this._bulletIds.delete(id);
        this._prev.delete(id);
      }
    }
  }

  // ── World / wave mirroring ─────────────────────────────────────────────────

  _snapshotWorld() {
    const wm = window.WaveManager;
    const dn = window.DayNight;
    if (!wm && !dn) return;

    const regs = {};
    if (wm) {
      regs[REG.WAVE_NUM]   = wm.currentWave  ?? wm.wave  ?? 0;
      regs[REG.WAVE_PHASE] = this._encodeWavePhase(wm.phase ?? wm.state ?? "idle");
      regs[REG.ENEMY_CT]   = wm.activeEnemies ?? wm.enemyCount ?? 0;
    }

    this._writeRegisters("world", regs);
  }

  // ── Register write with delta detection ──────────────────────────────────

  _writeRegisters(entityId, regs) {
    let prevMap = this._prev.get(entityId);
    if (!prevMap) {
      prevMap = {};
      this._prev.set(entityId, prevMap);
      // Ensure entity exists in registry
      this._ensureEntity(entityId);
    }

    const changed = [];
    for (const [name, value] of Object.entries(regs)) {
      const meta = REG_META[name];
      const threshold = meta?.threshold ?? 0;
      const prev = prevMap[name];

      const isDifferent = prev === undefined ||
        (typeof value === "number"
          ? Math.abs(value - prev) > threshold
          : value !== prev);

      if (isDifferent) {
        prevMap[name] = value;
        changed.push({ name, value, prev });
      }
    }

    if (changed.length === 0) return;

    // Write to ThingRegistry facet store
    for (const { name, value } of changed) {
      this._registry.setRegister?.(entityId, name, value);
    }

    // Emit change events for event-channel registers
    for (const change of changed) {
      const meta = REG_META[change.name];
      if (meta?.sync === "event") {
        for (const fn of this._eventSubscribers) {
          fn({ entityId, ...change });
        }
      }
    }
  }

  // ── State packet builder ──────────────────────────────────────────────────

  /**
   * Build the 20Hz STATE channel packet for NetworkBridge.
   * Only includes entities whose registers have changed since last packet.
   */
  _buildStatePacket() {
    const heroRegs = this._prev.get("hero") ?? {};
    return {
      t: Date.now(),
      hero: {
        u:       heroRegs[REG.POS_U]     ?? 0,
        v:       heroRegs[REG.POS_V]     ?? 0,
        layer:   heroRegs[REG.POS_LAYER] ?? 0,
        heading: heroRegs[REG.HEADING]   ?? 0,
        speed:   heroRegs[REG.SPEED]     ?? 0,
        hp:      heroRegs[REG.HP]        ?? 100,
        armor:   heroRegs[REG.ARMOR]     ?? 0,
        weapon:  heroRegs[REG.WEAPON]    ?? "none",
        ammo:    heroRegs[REG.AMMO]      ?? 0,
        dead:    heroRegs[REG.DEAD]      ?? 0,
      },
      world: {
        wave:  (this._prev.get("world") ?? {})[REG.WAVE_NUM] ?? 0,
        phase: (this._prev.get("world") ?? {})[REG.WAVE_PHASE] ?? 0,
      },
    };
  }

  // ── Entity bootstrap ──────────────────────────────────────────────────────

  _ensureHeroEntity() {
    if (this._registry.has?.("hero")) return;
    this._registry.spawn?.({
      id: "hero",
      kind: "hero",
      facets: [
        { name: "transform",  data: { u: 0, v: 0, layer: 0, heading: 0 } },
        { name: "health",     data: { hp: 100, maxHp: 100, armor: 0, maxArmor: 100 } },
        { name: "combat",     data: { weapon: "pistol", ammo: 12, kills: 0, deaths: 0 } },
        { name: "inventory",  data: { slots: [], equipped: null } },
        { name: "registers",  data: {} },
      ],
    });
  }

  _ensureWorldEntity() {
    if (this._registry.has?.("world")) return;
    this._registry.spawn?.({
      id: "world",
      kind: "world",
      facets: [
        { name: "world-params", data: { seed: 0, size: 256, tileSize: 4 } },
        { name: "wave-state",   data: { wave: 0, phase: "idle", enemies: 0 } },
        { name: "registers",    data: {} },
      ],
    });
  }

  _ensureEntity(id) {
    if (this._registry.has?.(id)) return;
    const kind = id.startsWith("enemy-")  ? "enemy"
               : id.startsWith("bullet-") ? "bullet"
               : id.startsWith("npc-")    ? "npc"
               : "unknown";
    this._registry.spawn?.({
      id,
      kind,
      facets: [
        { name: "transform", data: { u: 0, v: 0, layer: 0, heading: 0 } },
        { name: "registers", data: {} },
      ],
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _encodeAiMode(mode) {
    return { idle: 0, patrol: 1, chase: 2, attack: 3, dead: 4, flee: 5 }[mode] ?? 0;
  }

  _encodeWavePhase(phase) {
    return { idle: 0, running: 1, boss: 2, intermission: 3, victory: 4 }[phase] ?? 0;
  }

  _hashId(id) {
    // Simple djb2 hash to convert string id to number register
    let h = 5381;
    for (let i = 0; i < id.length; i++) h = ((h << 5) + h) + id.charCodeAt(i);
    return h >>> 0;
  }
}

// ── ThingRegistry extension: setRegister / getRegister ─────────────────────
/**
 * Patches an existing ThingRegistry instance to support fast register access.
 * Registers are stored in a separate Map for O(1) access without facet parsing.
 *
 * Call this once after creating your ThingRegistry:
 *   patchRegistryWithRegisters(registry);
 */
export function patchRegistryWithRegisters(registry) {
  if (registry._registers) return; // already patched

  // Map<entityId, Map<registerName, value>>
  registry._registers = new Map();

  registry.setRegister = function(entityId, name, value) {
    let regMap = this._registers.get(entityId);
    if (!regMap) {
      regMap = new Map();
      this._registers.set(entityId, regMap);
    }
    regMap.set(name, value);
  };

  registry.getRegister = function(entityId, name) {
    return this._registers.get(entityId)?.get(name) ?? null;
  };

  registry.getAllRegisters = function(entityId) {
    const m = this._registers.get(entityId);
    return m ? Object.fromEntries(m) : {};
  };

  registry.has = function(id) {
    return this.rows.has(id);
  };
}

// ── Integration with NetworkBridge ─────────────────────────────────────────
/**
 * Wire MirrorAdapter to NetworkBridge's STATE channel.
 *
 * Usage:
 *   const mirror = new MirrorAdapter(registry);
 *   const bridge = new NetworkBridge(socket, peerId, Engine.Core, () => mirror.snapshot());
 *   wireMirrorToNetwork(mirror, bridge);
 *   mirror.start();
 *   bridge.start();
 */
export function wireMirrorToNetwork(mirror, bridge) {
  // When mirror produces a state snapshot, send it over the STATE channel
  mirror.onStateSnapshot((packet) => {
    bridge._core?.emit?.("net:send", {
      channel: 0, // NET_CHANNELS.STATE
      data: packet,
    });
  });

  // When we receive a remote STATE frame, write it into the registry as a remote peer entity
  bridge._core?.on?.("net:recv", (frame) => {
    if (frame.channel !== 0) return;
    const data = typeof frame.data === "string" ? JSON.parse(frame.data) : frame.data;
    if (!data?.hero) return;

    const peerId = frame.peer_id ?? "remote-unknown";
    const entityId = `remote-${peerId}`;

    // Write remote hero state as registers on a remote-hero entity
    const regs = {
      [REG.POS_U]:     data.hero.u       ?? 0,
      [REG.POS_V]:     data.hero.v       ?? 0,
      [REG.POS_LAYER]: data.hero.layer   ?? 0,
      [REG.HEADING]:   data.hero.heading ?? 0,
      [REG.HP]:        data.hero.hp      ?? 100,
      [REG.ARMOR]:     data.hero.armor   ?? 0,
      [REG.DEAD]:      data.hero.dead    ?? 0,
      [REG.WEAPON]:    data.hero.weapon  ?? "none",
      [REG.NET_LATENCY]: Date.now() - (data.t ?? Date.now()),
      [REG.NET_PEER_ID]: mirror._hashId(peerId),
      [REG.NET_SEQ]:   data.seq ?? 0,
    };

    // Ensure remote entity exists
    if (!mirror._registry.has(entityId)) {
      mirror._registry.spawn?.({
        id: entityId,
        kind: "hero",
        facets: [
          { name: "transform",   data: {} },
          { name: "health",      data: {} },
          { name: "network-peer", data: { peerId, latency: 0, lastSeen: Date.now() } },
          { name: "registers",   data: {} },
        ],
      });
    }

    for (const [name, value] of Object.entries(regs)) {
      mirror._registry.setRegister(entityId, name, value);
    }
  });
}

// ── Renderer integration: mesh sync from registers ─────────────────────────
/**
 * On each render frame, sync Three.js mesh positions from registers.
 * Call this inside your rAF loop AFTER mirror.tick() but BEFORE renderer.render().
 *
 * Usage:
 *   const meshSync = createRegisterMeshSync(registry, scene, tileSize);
 *   // In rAF:
 *   meshSync.sync();
 *   renderer.render(scene, camera);
 */
export function createRegisterMeshSync(registry, scene, tileSize = 4) {
  // Map<entityId, THREE.Object3D>
  const meshCache = new Map();

  return {
    sync() {
      if (!registry._registers) return;
      for (const [entityId, regMap] of registry._registers) {
        const u = regMap.get(REG.POS_U) ?? 0;
        const v = regMap.get(REG.POS_V) ?? 0;
        const heading = regMap.get(REG.HEADING) ?? 0;
        const dead = regMap.get(REG.DEAD) ?? 0;

        let mesh = meshCache.get(entityId);
        if (!mesh) {
          mesh = scene.getObjectByName(entityId);
          if (mesh) meshCache.set(entityId, mesh);
        }
        if (!mesh) continue;

        mesh.position.x = u * tileSize;
        mesh.position.z = v * tileSize;
        mesh.rotation.y = heading;
        mesh.visible = dead === 0;
      }
    },

    addMesh(entityId, mesh) {
      meshCache.set(entityId, mesh);
    },
  };
}
