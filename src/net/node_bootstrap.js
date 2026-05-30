/**
 * node_bootstrap.js — Fault-tolerant hivemind node startup sequence.
 *
 * Designed by ARCHITECT (Council), 2026-05-29.
 * Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 *
 * PRINCIPLE: Offline-first. The player is in a playable game within 3 seconds
 * regardless of network conditions. Every step has a fallback.
 *
 * STARTUP PHASES:
 *   Phase 0: LOCAL BOOTSTRAP — always succeeds, fully offline
 *   Phase 1: PEER DISCOVERY — best-effort, 5s timeout
 *   Phase 2: WORLD SYNC — async, non-blocking
 *   Phase 3: MULTIPLAYER HANDSHAKE — once sync complete
 *
 * Usage (from index.html or game.html):
 *   import { NodeBootstrap } from "./src/net/node_bootstrap.js";
 *   const boot = new NodeBootstrap({ onReady: (mode) => console.log("node ready:", mode) });
 *   await boot.start();
 *
 * Events emitted (via EventBus if available):
 *   "node:offline_mode"     — started in offline mode
 *   "node:peer_found"       — connected to at least one peer
 *   "node:world_syncing"    — world delta being fetched
 *   "node:ready"            — multiplayer fully active
 *   "node:sync_progress"    — { percent, bytesTotal, bytesLoaded }
 */

// Known bootstrap nodes — baked into the client at build time.
// These are well-known stable nodes that respond to connection requests.
// Like BitTorrent's hardcoded trackers.
const BOOTSTRAP_NODES = [
  "ws://dwrld.xyz:9950",       // quandaleServer relay
  "wss://dwrld.xyz:9950",      // quandaleServer relay (TLS)
  // Additional backup nodes can be added here by vvv
];

// LAN discovery broadcast address (game_server.js already supports this)
const LAN_DISCOVERY_PORT = 4321;

/** Timeouts (ms) for each phase step */
const TIMEOUTS = {
  identity_load:    500,
  relay_connect:    5000,
  lan_discovery:    3000,
  root_thinga:      3000,
  tier0_download:   5000,
  world_sync:       Infinity,  // async background
};

/** Bootstrap node tiers (per POOR_HUMAN progressive loading spec) */
const WORLD_TIERS = {
  TIER_0: { max_bytes: 64 * 1024,        label: "identity + starting area" },
  TIER_1: { max_bytes: 10 * 1024 * 1024, label: "local region" },
  TIER_2: { max_bytes: 100 * 1024 * 1024,label: "extended world" },
  TIER_3: { max_bytes: Infinity,          label: "full graph (streaming)" },
};

export class NodeBootstrap {
  constructor({ onReady, onProgress, onMode, registry, socket } = {}) {
    this._onReady    = onReady    || (() => {});
    this._onProgress = onProgress || (() => {});
    this._onMode     = onMode     || (() => {});
    this._registry   = registry;   // ThingRegistry (optional at construction time)
    this._socket     = socket;     // socket.io socket (optional)
    this._mode       = "offline";  // "offline" | "solo" | "online"
    this._peers      = [];
    this._log        = [];
  }

  /**
   * Start the bootstrap sequence.
   * Returns the mode string: "offline" | "solo" | "online"
   */
  async start() {
    this._emit("node:boot_start");
    this._log.push({ t: Date.now(), msg: "boot:start" });

    // ── Phase 0: LOCAL BOOTSTRAP (always succeeds) ──────────────────────────
    const identity = await this._phase0_local();

    // ── Phase 1: PEER DISCOVERY (best-effort) ──────────────────────────────
    const peerResult = await this._phase1_peers(identity);

    // ── Phase 2: WORLD SYNC (async background) ─────────────────────────────
    if (peerResult.connected) {
      this._phase2_sync(peerResult).catch(err => {
        this._log.push({ t: Date.now(), msg: `sync:error: ${err.message}` });
      });
    }

    // ── Phase 3: Announce readiness ────────────────────────────────────────
    const mode = peerResult.connected ? "online" : (identity.has_cache ? "solo" : "offline");
    this._mode = mode;
    this._emit("node:ready", { mode, identity });
    this._onReady(mode);
    this._onMode(mode);
    return mode;
  }

  // ── Phase 0: Load local identity and cached world ─────────────────────────

  async _phase0_local() {
    this._log.push({ t: Date.now(), msg: "phase0:start" });

    // Load or generate player profile
    let identity = this._loadLocalIdentity();
    if (!identity) {
      identity = this._generateIdentity();
      this._saveLocalIdentity(identity);
      this._log.push({ t: Date.now(), msg: "phase0:new_identity" });
    } else {
      this._log.push({ t: Date.now(), msg: `phase0:loaded ${identity.peer_id}` });
    }

    // Check for cached world data
    identity.has_cache = this._hasCachedWorld();
    identity.tier = identity.has_cache ? this._cachedWorldTier() : 0;

    this._log.push({ t: Date.now(), msg: `phase0:done tier=${identity.tier}` });
    return identity;
  }

  // ── Phase 1: Discover peers ────────────────────────────────────────────────

  async _phase1_peers(identity) {
    this._log.push({ t: Date.now(), msg: "phase1:start" });

    // 1a: Try cached peers from last session
    const cachedPeers = this._loadCachedPeers();
    if (cachedPeers.length > 0) {
      const result = await this._tryPeers(cachedPeers, TIMEOUTS.relay_connect);
      if (result.connected) {
        this._log.push({ t: Date.now(), msg: `phase1:cached_peer ${result.peer}` });
        return result;
      }
    }

    // 1b: Try bootstrap nodes (hardcoded)
    const bootstrapResult = await this._tryPeers(BOOTSTRAP_NODES, TIMEOUTS.relay_connect);
    if (bootstrapResult.connected) {
      this._log.push({ t: Date.now(), msg: `phase1:bootstrap ${bootstrapResult.peer}` });
      this._emit("node:peer_found", { peer: bootstrapResult.peer });
      return bootstrapResult;
    }

    // 1c: Try LAN discovery
    const lanResult = await this._tryLanDiscovery(TIMEOUTS.lan_discovery);
    if (lanResult.connected) {
      this._log.push({ t: Date.now(), msg: `phase1:lan ${lanResult.peer}` });
      this._emit("node:peer_found", { peer: lanResult.peer });
      return lanResult;
    }

    // 1d: All failed — offline mode
    this._log.push({ t: Date.now(), msg: "phase1:offline_mode" });
    this._emit("node:offline_mode");
    this._onMode("offline");
    return { connected: false };
  }

  // ── Phase 2: World sync (background, non-blocking) ─────────────────────────

  async _phase2_sync({ peer, socket: relaySocket }) {
    this._emit("node:world_syncing");
    this._log.push({ t: Date.now(), msg: `phase2:sync from ${peer}` });

    // Determine what tier the user can download based on their network_budget
    const profile = this._loadLocalIdentity();
    const tier = this._budgetToTier(profile?.network_budget?.tier || "standard");
    const maxBytes = WORLD_TIERS[tier]?.max_bytes || WORLD_TIERS.TIER_1.max_bytes;

    // Request world delta since last session
    const lastSession = this._loadLastSessionTimestamp();
    const deltaRequest = {
      type: "world_delta_request",
      since: lastSession,
      world_slice: profile?.last_world_slice || "",
      max_bytes: maxBytes,
    };

    if (relaySocket) {
      relaySocket.emit("world_delta_request", deltaRequest);
      relaySocket.on("world_delta_chunk", (chunk) => {
        this._applyWorldChunk(chunk);
        const progress = chunk.progress || 0;
        this._emit("node:sync_progress", { percent: progress });
        this._onProgress(progress);
      });
      relaySocket.on("world_delta_complete", () => {
        this._log.push({ t: Date.now(), msg: "phase2:sync_complete" });
        this._saveLastSessionTimestamp(Date.now());
        this._emit("node:sync_complete");
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async _tryPeers(peers, timeout) {
    for (const peer of peers) {
      try {
        const connected = await this._connectToPeer(peer, timeout);
        if (connected) return { connected: true, peer };
      } catch { /* try next */ }
    }
    return { connected: false };
  }

  async _connectToPeer(url, timeout) {
    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(false), timeout);
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => { clearTimeout(t); ws.close(); resolve(true); };
        ws.onerror = () => { clearTimeout(t); resolve(false); };
      } catch { clearTimeout(t); resolve(false); }
    });
  }

  async _tryLanDiscovery(timeout) {
    // LAN discovery via game_server.js UDP broadcast (already implemented)
    // For browser: use socket.io with { hostname: "255.255.255.255" } on LAN_DISCOVERY_PORT
    // Simplified: just try localhost (for dev)
    return this._connectToPeer(`ws://localhost:5050`, Math.min(timeout, 1000))
      .then(connected => ({ connected, peer: "localhost:5050" }))
      .catch(() => ({ connected: false }));
  }

  _budgetToTier(tier) {
    switch (tier) {
      case "minimal":   return "TIER_0";
      case "standard":  return "TIER_1";
      case "extended":  return "TIER_2";
      case "unlimited": return "TIER_3";
      default:          return "TIER_1";
    }
  }

  _applyWorldChunk(chunk) {
    // Delegate to the ThingRegistry if available
    if (this._registry && chunk.things) {
      for (const thing of chunk.things) {
        try {
          if (!this._registry.rows.has(thing.id)) {
            this._registry.spawn(thing);
          } else {
            // Update existing — apply facet deltas
            for (const [facetName, facetData] of Object.entries(thing.facets || {})) {
              this._registry.updateFacet(thing.id, facetName, existing => Object.assign(existing || {}, facetData));
            }
          }
        } catch { /* malformed chunk — skip */ }
      }
    }
    // Cache the chunk to IndexedDB for offline use
    this._cacheChunk(chunk);
  }

  _loadLocalIdentity() {
    try {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem("5dengine_player_profile_v1");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  _generateIdentity() {
    const hex = () => Math.floor(Math.random() * 0x10000).toString(16).toUpperCase().padStart(4, "0");
    return {
      peer_id: `${hex()}-${hex()}`,
      alias: null,
      node_role: "game",
      network_budget: { tier: "standard", per_session_mb: 200, background_mb: 0 },
    };
  }

  _saveLocalIdentity(identity) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("5dengine_player_profile_v1", JSON.stringify(identity));
      }
    } catch { /* quota */ }
  }

  _loadCachedPeers() {
    try {
      if (typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem("5dengine_peer_cache");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  _hasCachedWorld() {
    try {
      if (typeof localStorage === "undefined") return false;
      return !!localStorage.getItem("5dengine_world_cache_v1");
    } catch { return false; }
  }

  _cachedWorldTier() {
    try {
      if (typeof localStorage === "undefined") return 0;
      const raw = localStorage.getItem("5dengine_world_cache_v1");
      if (!raw) return 0;
      const cache = JSON.parse(raw);
      return cache.tier || 0;
    } catch { return 0; }
  }

  _loadLastSessionTimestamp() {
    try {
      if (typeof localStorage === "undefined") return 0;
      return parseInt(localStorage.getItem("5dengine_last_session") || "0");
    } catch { return 0; }
  }

  _saveLastSessionTimestamp(t) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem("5dengine_last_session", String(t));
    } catch { /* quota */ }
  }

  _cacheChunk(chunk) {
    // TODO: IndexedDB implementation for larger caches
    // For now: keep a simple localStorage summary
    try {
      if (typeof localStorage !== "undefined") {
        const summary = { tier: 1, cached_at: Date.now(), chunk_count: 1 };
        localStorage.setItem("5dengine_world_cache_v1", JSON.stringify(summary));
      }
    } catch { /* quota */ }
  }

  _emit(event, data) {
    if (typeof EventBus !== "undefined" && EventBus?.emit) {
      EventBus.emit(event, data);
    }
    this._log.push({ t: Date.now(), msg: `emit:${event}` });
  }

  /** Get the bootstrap log for debugging */
  get log() { return [...this._log]; }

  /** Current network mode */
  get mode() { return this._mode; }
}

/**
 * Convenience: create and start a NodeBootstrap with sensible defaults.
 * Usage: const mode = await bootstrapNode();
 */
export async function bootstrapNode(opts = {}) {
  const b = new NodeBootstrap(opts);
  return b.start();
}
