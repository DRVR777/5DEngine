/**
 * register_bridge.js — The ANKHOR ↔ game.html register bridge
 *
 * PURPOSE:
 *   Makes the Ankhor substrate a live mirror of game.html's GTAXxx globals.
 *   Every system that was hardcoded in game.html as window.GTAXxx becomes
 *   a Thinga in the Ankhor registry, with facets representing its live state.
 *
 *   This is the "second abstraction phase" completion step:
 *   game.html can keep running (legacy surface) while Ankhor reads/writes
 *   its state. When a GTAXxx system is fully migrated, its bridge entry is
 *   deleted — not the system, just the bridge.
 *
 * ARCHITECTURE:
 *   game.html GTAXxx globals ←→ Ankhor Registry (ThingaRegistry)
 *   ──────────────────────────────────────────────────────────────
 *   window.GTAEngine.WorldState   →  world Thinga facet "world-state"
 *   window.GTAEntity              →  registry.spawn() / registry.get()
 *   window.GTAHealth              →  facet "health" on entity Thingas
 *   window.GTAPhysics             →  facet "aabb-collision" + "position"
 *   window.WaveManager            →  facet "wave-spawner" on world Thinga
 *   window.DayNight               →  facet "day-night" on world Thinga
 *   window.GTAAudio               →  facet "audio-state" (read-only mirror)
 *   window.GTAInventory           →  facet "inventory" on hero Thinga
 *   window.GTAGuns                →  facet "weapon" on hero Thinga
 *   window.TriggerZones           →  Thingas of kind "trigger-zone"
 *   window.BuilderScripting       →  facet "scripting" on world Thinga
 *   window.DevConsole             →  facet "dev-console" (meta Thinga)
 *   window.EventBus               →  registry event bus (already unified)
 *
 * USAGE (in boot.js or game.html init section):
 *   import { RegisterBridge } from "./register_bridge.js";
 *   const bridge = new RegisterBridge(registry);
 *   bridge.install();
 *   bridge.startSync(16); // sync every 16ms (~60fps)
 *
 * MODES:
 *   READ  — GTAXxx → Ankhor (game.html writes, Ankhor reads)
 *   WRITE — Ankhor → GTAXxx (Ankhor writes, game.html reads)
 *   DUAL  — bidirectional, last-write-wins with dirty tracking
 *
 * @author SCHIZOPHRENIC_ACELLERATOR
 * @session 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_VERSION = "1.0.0";
const SYNC_INTERVAL_MS = 16; // default ~60fps

// ─── GTAXxx → Thinga facet mapping table ─────────────────────────────────────
//
// Each entry: {
//   global: string          — window.XXX global name
//   thingaKind: string      — kind of Thinga this maps to
//   facet: string           — facet name on that Thinga
//   mode: "read"|"write"|"dual"
//   readFn: (global) => {}  — extract facet data from global
//   writeFn: (thinga, data) — push Ankhor data back to global (optional)
// }

const MAPPING_TABLE = [
  // ── World-level state ──────────────────────────────────────────────────────
  {
    global: "GTAEngine",
    thingaKind: "world",
    facet: "world-state",
    mode: "dual",
    readFn: (g) => {
      const ws = g?.WorldState;
      if (!ws) return null;
      return {
        mode:        ws.mode       ?? "explore",
        phase:       ws.phase      ?? 0,
        score:       ws.score      ?? 0,
        coins:       ws.coins      ?? 0,
        time:        ws.time       ?? 0,
        paused:      ws.paused     ?? false,
        difficulty:  ws.difficulty ?? 1,
      };
    },
    writeFn: (thinga, data) => {
      const ws = window.GTAEngine?.WorldState;
      if (!ws) return;
      if (data.mode       !== undefined) ws.mode       = data.mode;
      if (data.score      !== undefined) ws.score      = data.score;
      if (data.coins      !== undefined) ws.coins      = data.coins;
      if (data.paused     !== undefined) ws.paused     = data.paused;
      if (data.difficulty !== undefined) ws.difficulty = data.difficulty;
    }
  },

  {
    global: "DayNight",
    thingaKind: "world",
    facet: "day-night",
    mode: "read",
    readFn: (g) => ({
      hour:     g?.hour     ?? 12,
      sky:      g?.sky      ?? 0x1a1a2e,
      sunI:     g?.sunI     ?? 1.0,
      sunColor: g?.sunColor ?? 0xfff5e0,
      fog:      g?.fog      ?? 0x1a1a2e,
    }),
  },

  {
    global: "WaveManager",
    thingaKind: "world",
    facet: "wave-state",
    mode: "dual",
    readFn: (g) => ({
      wave:      g?.wave       ?? 0,
      phase:     g?.phase      ?? "idle",
      enemies:   g?.enemies    ?? 0,
      spawned:   g?.spawned    ?? 0,
      killed:    g?.killed     ?? 0,
      nextWave:  g?.nextWaveIn ?? 0,
    }),
    writeFn: (thinga, data) => {
      const wm = window.WaveManager;
      if (!wm) return;
      // Only allow writes that advance the wave (prevent rewind attacks)
      if (data.wave !== undefined && data.wave > (wm.wave ?? 0)) wm.wave = data.wave;
    }
  },

  // ── Hero / Player state ────────────────────────────────────────────────────
  {
    global: "GTAHealth",
    thingaKind: "hero",
    facet: "health",
    mode: "dual",
    readFn: (g) => {
      // GTAHealth can track multiple entities; we want the hero
      const hero = g?.getEntity?.("hero") ?? g?.hero ?? g;
      if (!hero) return null;
      return {
        hp:       hero.hp       ?? 100,
        maxHp:    hero.maxHp    ?? 100,
        armor:    hero.armor    ?? 0,
        maxArmor: hero.maxArmor ?? 100,
        dead:     hero.dead     ?? false,
      };
    },
    writeFn: (thinga, data) => {
      const g = window.GTAHealth;
      if (!g?.hero) return;
      if (data.hp    !== undefined) g.hero.hp    = Math.max(0, data.hp);
      if (data.armor !== undefined) g.hero.armor = Math.max(0, data.armor);
    }
  },

  {
    global: "GTAInventory",
    thingaKind: "hero",
    facet: "inventory",
    mode: "read",
    readFn: (g) => {
      if (!g?.slots) return null;
      return {
        slots: g.slots.map(s => s ? { id: s.id, count: s.count ?? 1 } : null),
        active: g.activeSlot ?? 0,
        capacity: g.capacity ?? 9,
      };
    }
  },

  {
    global: "GTAGuns",
    thingaKind: "hero",
    facet: "weapon",
    mode: "read",
    readFn: (g) => {
      const w = g?.current;
      if (!w) return null;
      return {
        id:       w.id       ?? "none",
        ammo:     w.ammo     ?? 0,
        maxAmmo:  w.maxAmmo  ?? 0,
        reserved: w.reserved ?? 0,
        fireRate: w.fireRate ?? 0,
        damage:   w.damage   ?? 0,
      };
    }
  },

  // ── Position (hero) ────────────────────────────────────────────────────────
  {
    global: "GTAEngine",
    thingaKind: "hero",
    facet: "position5d",
    mode: "dual",
    readFn: (g) => {
      const hero = g?.hero ?? g?.player;
      if (!hero) return null;
      const pos = hero.position ?? hero.pos ?? {};
      return {
        x: pos.x ?? 0,
        y: pos.y ?? 0,
        z: pos.z ?? 0,
        u: pos.u ?? 0.0,   // phase dimension (default: legacy slice 0)
        v: pos.v ?? 0.0,   // phase dimension
        w: pos.w ?? 0,     // world-layer (which 6D shard)
        t: pos.t ?? 0,     // time coordinate
        heading: hero.heading ?? hero.rotY ?? 0,
      };
    },
    writeFn: (thinga, data) => {
      const hero = window.GTAEngine?.hero ?? window.GTAEngine?.player;
      if (!hero) return;
      // Never write x,y,z from network (see multiplayer_plan.md: "your position is NEVER touched by the network")
      // Only write u,v,w,t (dimensional coordinates)
      if (data.u !== undefined && hero.position) hero.position.u = data.u;
      if (data.v !== undefined && hero.position) hero.position.v = data.v;
      if (data.w !== undefined && hero.position) hero.position.w = data.w;
    }
  },

  // ── Physics ────────────────────────────────────────────────────────────────
  {
    global: "GTAPhysics",
    thingaKind: "world",
    facet: "physics-state",
    mode: "read",
    readFn: (g) => ({
      gravity:     g?.gravity    ?? -20,
      entityCount: g?.bodies?.length ?? 0,
      collidersActive: g?.activeColliders ?? 0,
    })
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  {
    global: "GTAAudio",
    thingaKind: "world",
    facet: "audio-state",
    mode: "read",
    readFn: (g) => ({
      context: g?.ctx?.state ?? "suspended",
      masterVolume: g?.masterVol ?? 1.0,
      musicVolume:  g?.musicVol  ?? 0.7,
      sfxVolume:    g?.sfxVol    ?? 1.0,
    })
  },

  // ── Builder / World Editor ─────────────────────────────────────────────────
  {
    global: "WorldBuilder",
    thingaKind: "world",
    facet: "builder-state",
    mode: "read",
    readFn: (g) => ({
      active:    g?.active     ?? false,
      selected:  g?.selected   ?? null,
      mode:      g?.mode       ?? "select",
      objectCount: g?.objects?.size ?? g?.objects?.length ?? 0,
    })
  },

  // ── Scripting sandbox ──────────────────────────────────────────────────────
  {
    global: "BuilderScripting",
    thingaKind: "world",
    facet: "scripting",
    mode: "read",
    readFn: (g) => ({
      running: g?.running ?? false,
      scripts: g?.scripts ? Object.keys(g.scripts) : [],
    })
  },

  // ── Dev console ───────────────────────────────────────────────────────────
  {
    global: "DevConsole",
    thingaKind: "meta",
    facet: "dev-console",
    mode: "read",
    readFn: (g) => ({
      open:  g?.visible ?? g?.open ?? false,
      lines: g?.lines?.length ?? 0,
    })
  },

  // ── EventBus (pass-through — Ankhor already uses events) ──────────────────
  {
    global: "EventBus",
    thingaKind: "meta",
    facet: "event-bus",
    mode: "read",
    readFn: (g) => ({
      listeners: g?.listeners?.size ?? 0,
    })
  },

  // ── Trigger Zones (one Thinga per zone) ───────────────────────────────────
  // Handled specially in _syncTriggerZones below — zones are dynamic
];

// ─── RegisterBridge class ─────────────────────────────────────────────────────

export class RegisterBridge {
  /**
   * @param {object} registry — Ankhor ThingRegistry instance
   * @param {object} [opts]
   * @param {boolean} [opts.verbose=false] — log every sync
   * @param {function} [opts.onSync] — called after each sync pass with diff
   */
  constructor(registry, opts = {}) {
    this._registry  = registry;
    this._verbose   = opts.verbose ?? false;
    this._onSync    = opts.onSync ?? null;
    this._timer     = null;
    this._dirty     = new Map(); // facetKey → true
    this._lastSync  = new Map(); // facetKey → JSON snapshot
    this._installed = false;
    this._worldId   = null;
    this._heroId    = null;
    this._metaId    = null;
  }

  /**
   * Install the bridge — creates Ankhor Thingas for world/hero/meta
   * if they don't already exist.
   */
  install() {
    if (this._installed) return;
    this._installed = true;
    this._ensureCoreThingas();
    this._installEventWiring();
    if (this._verbose) console.log(`[RegisterBridge v${BRIDGE_VERSION}] installed`);
  }

  /**
   * Start syncing at the given interval.
   * @param {number} [intervalMs=16]
   */
  startSync(intervalMs = SYNC_INTERVAL_MS) {
    if (this._timer) this.stopSync();
    this._timer = setInterval(() => this._syncPass(), intervalMs);
    if (this._verbose) console.log(`[RegisterBridge] sync started @ ${intervalMs}ms`);
  }

  stopSync() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  /**
   * Manual single sync pass (call from your game loop if preferred).
   */
  tick() {
    this._syncPass();
  }

  // ── Internal: ensure Thingas exist ─────────────────────────────────────────

  _ensureCoreThingas() {
    const reg = this._registry;

    // world Thinga
    if (reg.byKind) {
      const worlds = reg.byKind("world");
      this._worldId = worlds?.[0]?.id ?? this._spawnIfMissing("world", "bridge-world");
    } else {
      this._worldId = "bridge-world";
    }

    // hero Thinga
    const heroes = reg.byKind?.("hero") ?? [];
    this._heroId = heroes?.[0]?.id ?? this._spawnIfMissing("hero", "bridge-hero");

    // meta Thinga (dev console, event bus)
    const metas = reg.byKind?.("meta") ?? [];
    this._metaId = metas?.[0]?.id ?? this._spawnIfMissing("meta", "bridge-meta");
  }

  _spawnIfMissing(kind, id) {
    const reg = this._registry;
    if (reg.get?.(id)) return id;
    if (reg.spawn) {
      reg.spawn({ id, kind, facets: {}, name: `bridge:${kind}` });
    } else if (reg.register) {
      reg.register({ id, kind, facets: {}, name: `bridge:${kind}` });
    }
    return id;
  }

  // ── Internal: event bus wiring ─────────────────────────────────────────────

  _installEventWiring() {
    // When game.html fires on EventBus, mirror to Ankhor registry events
    const eb = window.EventBus;
    if (!eb) return;

    const forwardEvents = [
      "wave:start", "wave:complete", "player:killed", "player:respawn",
      "pickup:collected", "build:spawn", "build:delete", "game:mode",
    ];
    for (const ev of forwardEvents) {
      eb.on?.(ev, (data) => {
        this._registry.emit?.(ev, data);
        this._dirty.set(`event:${ev}`, true);
      });
    }
  }

  // ── Internal: main sync pass ───────────────────────────────────────────────

  _syncPass() {
    const diff = [];

    for (const entry of MAPPING_TABLE) {
      const global = window[entry.global];
      if (!global) continue;

      const thingaId = this._thingaIdForKind(entry.thingaKind);
      if (!thingaId) continue;

      // READ: GTAXxx → Ankhor
      if (entry.mode === "read" || entry.mode === "dual") {
        try {
          const data = entry.readFn(global);
          if (data === null) continue;
          const key = `${entry.thingaKind}:${entry.facet}`;
          const snap = JSON.stringify(data);
          if (this._lastSync.get(key) !== snap) {
            this._setFacet(thingaId, entry.facet, data);
            this._lastSync.set(key, snap);
            diff.push({ kind: entry.thingaKind, facet: entry.facet, from: "game" });
          }
        } catch (e) {
          if (this._verbose) console.warn(`[RegisterBridge] read error ${entry.global}.${entry.facet}:`, e);
        }
      }

      // WRITE: Ankhor → GTAXxx  (only if dirty and writeFn exists)
      if ((entry.mode === "write" || entry.mode === "dual") && entry.writeFn) {
        const key = `${entry.thingaKind}:${entry.facet}:write`;
        if (this._dirty.get(key)) {
          try {
            const data = this._getFacet(thingaId, entry.facet);
            if (data) {
              entry.writeFn(null, data);
              this._dirty.delete(key);
              diff.push({ kind: entry.thingaKind, facet: entry.facet, from: "ankhor" });
            }
          } catch (e) {
            if (this._verbose) console.warn(`[RegisterBridge] write error ${entry.global}.${entry.facet}:`, e);
          }
        }
      }
    }

    // Sync dynamic trigger zones
    this._syncTriggerZones();

    if (diff.length && this._onSync) this._onSync(diff);
    if (this._verbose && diff.length) console.log("[RegisterBridge] sync diff:", diff);
  }

  _syncTriggerZones() {
    const tz = window.TriggerZones;
    if (!tz?.zones) return;
    for (const [id, zone] of Object.entries(tz.zones)) {
      const thingaId = `trigger-zone:${id}`;
      const data = {
        pos: zone.pos ?? { x: 0, y: 0, z: 0 },
        radius: zone.radius ?? 1,
        active: zone.active ?? true,
        kind: zone.kind ?? "generic",
      };
      const key = `trigger-zone:${id}`;
      const snap = JSON.stringify(data);
      if (this._lastSync.get(key) !== snap) {
        this._spawnIfMissing("trigger-zone", thingaId);
        this._setFacet(thingaId, "zone", data);
        this._lastSync.set(key, snap);
      }
    }
  }

  // ── Internal: registry accessors (handle multiple registry shapes) ─────────

  _thingaIdForKind(kind) {
    switch (kind) {
      case "world":  return this._worldId;
      case "hero":   return this._heroId;
      case "meta":   return this._metaId;
      default:       return null;
    }
  }

  _setFacet(thingaId, facetName, data) {
    const reg = this._registry;
    if (reg.setFacet) {
      reg.setFacet(thingaId, facetName, data);
    } else if (reg.facetData && reg.thingas) {
      // Ankhor boot.js pattern: facetData is read-only; write via internal map
      const t = reg.thingas?.get?.(thingaId);
      if (t) t[facetName] = data;
    } else if (reg.get) {
      const t = reg.get(thingaId);
      if (t) t[facetName] = data;
    }
  }

  _getFacet(thingaId, facetName) {
    const reg = this._registry;
    // Registry is AUTHORITATIVE when present (per ARCHITECT + RICH_HUMAN position5d design).
    // The priority chain is:
    //   1. Registry facet data (written by facet handlers, network updates)
    //   2. GTAEngine globals (game.html live state — fallback/initialization only)
    //   3. Default values (0, 0, etc.)
    // For position5d specifically: RICH_HUMAN's facet handler writes u,v,w,t to the registry.
    // Once it has data, always prefer registry over globals.
    if (reg.facetData) {
      const data = reg.facetData(thingaId, facetName);
      // If registry has non-null data, it wins
      if (data !== null && data !== undefined) return data;
    }
    if (reg.get) return reg.get(thingaId)?.[facetName];
    return null;
  }

  // ── API: write from Ankhor → GTAXxx ───────────────────────────────────────

  /**
   * Mark a facet as dirty (will be pushed to GTAXxx on next sync pass).
   * Call this when you change Ankhor data and want game.html to see it.
   */
  markDirty(thingaKind, facetName) {
    this._dirty.set(`${thingaKind}:${facetName}:write`, true);
  }

  /**
   * Get current bridge state — useful for debugging.
   */
  status() {
    return {
      version: BRIDGE_VERSION,
      installed: this._installed,
      syncing: !!this._timer,
      worldId: this._worldId,
      heroId: this._heroId,
      metaId: this._metaId,
      mappings: MAPPING_TABLE.length,
      dirty: this._dirty.size,
      lastSyncKeys: Array.from(this._lastSync.keys()),
    };
  }
}

// ─── Convenience factory ──────────────────────────────────────────────────────

/**
 * Quick install: creates a bridge, installs it, starts syncing.
 * @param {object} registry — Ankhor ThingRegistry
 * @param {object} [opts]
 * @returns {RegisterBridge}
 */
export function installRegisterBridge(registry, opts = {}) {
  const bridge = new RegisterBridge(registry, opts);
  bridge.install();
  bridge.startSync(opts.intervalMs ?? SYNC_INTERVAL_MS);
  return bridge;
}

// ─── UMD export (works in game.html <script> tag too) ────────────────────────

if (typeof window !== "undefined") {
  window.RegisterBridge = RegisterBridge;
  window.installRegisterBridge = installRegisterBridge;
}
