/**
 * core.js — ECS runtime for 5DEngine
 *
 * Entities:   monotonic integer IDs, stored in a Set
 * Components: Map<name, Map<entityId, data>> — pure data, no methods
 * Systems:    (dt, core, ctx) => void — pure functions sorted by priority
 * Events:     snapshot-safe pub/sub so handlers can unsubscribe during emit
 * Timestep:   fixed 1/60s accumulator; rAF delta is the only input
 * Prefabs:    data-driven entity templates with `extends` inheritance + cycle guard
 * Network:    optional bridge to worldWideComms/mkii game_bridge TCP protocol
 *             via the event bus — systems emit "net:send", bridge relays to peer
 */

export const Core = (() => {
  "use strict";

  // ── Entity registry ────────────────────────────────────────────────────────
  let _nextId = 1;
  const _entities = new Set();
  const _pendingDespawn = new Set();

  function createEntity() {
    const id = _nextId++;
    _entities.add(id);
    return id;
  }

  function destroyEntity(id) {
    _pendingDespawn.add(id);
  }

  function _flushDespawn() {
    for (const id of _pendingDespawn) {
      _entities.delete(id);
      for (const store of _components.values()) store.delete(id);
    }
    _pendingDespawn.clear();
  }

  function alive(id) { return _entities.has(id) && !_pendingDespawn.has(id); }

  // ── Component store ────────────────────────────────────────────────────────
  // Map<componentName, Map<entityId, data>>
  const _components = new Map();

  function addComponent(id, name, data) {
    if (!_components.has(name)) _components.set(name, new Map());
    _components.get(name).set(id, data);
    return data;
  }

  function removeComponent(id, name) {
    _components.get(name)?.delete(id);
  }

  function getComponent(id, name) {
    return _components.get(name)?.get(id);
  }

  function hasComponent(id, name) {
    return _components.get(name)?.has(id) ?? false;
  }

  /**
   * query(...componentNames) → entityId[]
   * Returns every entity that has ALL named components.
   * Uses smallest-store-first iteration to minimize inner-loop cost.
   */
  function query(...names) {
    if (!names.length) return [..._entities];
    const stores = names.map(n => _components.get(n)).filter(Boolean);
    if (stores.length !== names.length) return [];
    const sorted = [...stores].sort((a, b) => a.size - b.size);
    const [smallest, ...rest] = sorted;
    const result = [];
    for (const id of smallest.keys()) {
      if (rest.every(s => s.has(id))) result.push(id);
    }
    return result;
  }

  // ── Event bus ──────────────────────────────────────────────────────────────
  const _handlers = new Map();

  function on(event, fn) {
    if (!_handlers.has(event)) _handlers.set(event, new Set());
    _handlers.get(event).add(fn);
    return () => off(event, fn);          // returns unsub handle
  }

  function off(event, fn) {
    _handlers.get(event)?.delete(fn);
  }

  function emit(event, data) {
    const handlers = _handlers.get(event);
    if (!handlers) return;
    for (const fn of [...handlers]) fn(data); // snapshot → safe to unsub during emit
  }

  // ── System runner ──────────────────────────────────────────────────────────
  const _systems = [];
  let _systemsDirty = false;

  function addSystem(fn, priority = 0, label = "") {
    _systems.push({ fn, priority, label });
    _systemsDirty = true;
  }

  function removeSystem(fn) {
    const idx = _systems.findIndex(s => s.fn === fn);
    if (idx !== -1) _systems.splice(idx, 1);
  }

  function _sortSystems() {
    if (!_systemsDirty) return;
    _systems.sort((a, b) => a.priority - b.priority);
    _systemsDirty = false;
  }

  function runSystems(dt, ctx) {
    _sortSystems();
    for (const { fn } of _systems) fn(dt, api, ctx);
    _flushDespawn();
  }

  // ── Fixed timestep ─────────────────────────────────────────────────────────
  const FIXED_DT = 1 / 60;
  const MAX_FRAME_DT = 0.05;   // 50ms cap — prevents spiral of death
  let _acc = 0;

  /**
   * tick(rawDelta, ctx) — call from rAF with the raw frame delta (seconds).
   * Runs as many FIXED_DT steps as accumulated. Returns interpolation alpha [0, 1].
   */
  function tick(rawDelta, ctx) {
    _acc += Math.min(rawDelta, MAX_FRAME_DT);
    while (_acc >= FIXED_DT) {
      runSystems(FIXED_DT, ctx);
      _acc -= FIXED_DT;
    }
    return _acc / FIXED_DT; // alpha for visual interpolation
  }

  // ── Prefab system ──────────────────────────────────────────────────────────
  // Prefab spec: { extends?: string, components: { [name]: data } }
  const _prefabs = new Map();

  function registerPrefab(name, spec) {
    _prefabs.set(name, spec);
  }

  function _resolvePrefab(name, visited) {
    if (visited.has(name)) throw new Error(`Prefab cycle: ${[...visited, name].join(" → ")}`);
    visited.add(name);
    const spec = _prefabs.get(name);
    if (!spec) throw new Error(`Unknown prefab: ${name}`);
    if (!spec.extends) return spec;
    const parent = _resolvePrefab(spec.extends, visited);
    return {
      components: Object.assign({}, parent.components || {}, spec.components || {}),
    };
  }

  function instantiate(name, overrides = {}) {
    const resolved = _resolvePrefab(name, new Set());
    const id = createEntity();
    const comps = Object.assign({}, resolved.components, overrides.components);
    for (const [cName, cData] of Object.entries(comps)) {
      addComponent(id, cName, structuredClone(cData));
    }
    emit("entity:created", { id, prefab: name });
    return id;
  }

  // ── Data loader ────────────────────────────────────────────────────────────
  // Loads JSON data files from /data/ and caches them.
  // In browser: fetch(). In Node (tests): fs.readFileSync().
  const _dataCache = new Map();

  async function loadData(path) {
    if (_dataCache.has(path)) return _dataCache.get(path);
    let data;
    if (typeof window !== "undefined") {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Core.loadData: ${path} → ${res.status}`);
      data = await res.json();
    } else {
      const fs = await import("fs");
      const url = await import("url");
      const dir = url.fileURLToPath(new URL("../..", import.meta.url));
      data = JSON.parse(fs.readFileSync(`${dir}/${path}`, "utf8"));
    }
    _dataCache.set(path, data);
    return data;
  }

  // ── Network bridge (worldWideComms / mkii game_bridge protocol) ───────────
  // The mkii game_bridge.py expects a raw TCP connection on localhost:7780.
  // Browsers cannot open raw TCP sockets, so we relay through game_server.py
  // via socket.io. Systems emit "net:send" events; the bridge relays them.
  //
  // Wire format mirrored in JS (for documentation — actual packing done on
  // Python side):  [channel:1][length:4][data:N]
  //
  // Channel assignments:
  //   0 — engine state (position, health, game_mode)
  //   1 — game events (kill, pickup, wave_start)
  //   2 — world mutations (build, destruct, place)
  //   3 — voice / chat (reserved)
  //   4 — agent packets (dworld:// identity + payload)
  //
  const NET_CHANNELS = Object.freeze({
    STATE:    0,
    EVENTS:   1,
    WORLD:    2,
    CHAT:     3,
    AGENT:    4,
  });

  let _netSocket = null;    // socket.io socket set by caller
  let _netConnected = false;
  let _netPeerId = null;

  function netConnect(socket, peerId) {
    _netSocket = socket;
    _netPeerId = peerId;
    socket.on("bridge_frame", (frame) => {
      emit("net:recv", frame);
    });
    socket.on("bridge_connected", () => {
      _netConnected = true;
      emit("net:connected", { peerId });
    });
    socket.on("bridge_disconnected", () => {
      _netConnected = false;
      emit("net:disconnected", { peerId });
    });
    on("net:send", ({ channel, data }) => {
      if (!_netSocket || !_netConnected) return;
      _netSocket.emit("bridge_frame", { peerId: _netPeerId, channel, data });
    });
  }

  function netSend(channel, data) {
    emit("net:send", { channel, data });
  }

  // ── dworld:// agent packet ─────────────────────────────────────────────────
  // Sends an identity-file + payload packet through the network.
  // This is the atom described in decentralizeAiNetwork/ARCHITECTURE_SYNTHESIS.md:
  //   identity file + packet → one API call → indexed output
  // The game world is the spatial layer; the agent packet is the semantic layer.
  function sendAgentPacket({ identityId, payload, hopHistory = [] }) {
    netSend(NET_CHANNELS.AGENT, {
      identity: identityId,
      payload,
      hopHistory,
      timestamp: Date.now(),
      origin: "5DEngine",
    });
  }

  // ── Debug snapshot ─────────────────────────────────────────────────────────
  function snapshot() {
    return {
      entityCount:   _entities.size,
      pendingDespawn: _pendingDespawn.size,
      components:    [..._components.entries()].map(([n, m]) => ({ name: n, count: m.size })),
      systems:       _systems.map(s => ({ label: s.label || "?", priority: s.priority })),
      eventChannels: [..._handlers.keys()],
      netConnected:  _netConnected,
      accumulator:   _acc.toFixed(4),
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  const api = Object.freeze({
    // Entity
    createEntity, destroyEntity, alive,
    // Component
    addComponent, removeComponent, getComponent, hasComponent, query,
    // Event bus
    on, off, emit,
    // Systems
    addSystem, removeSystem, runSystems,
    // Timestep
    tick, FIXED_DT,
    // Prefabs
    registerPrefab, instantiate,
    // Data
    loadData,
    // Network
    netConnect, netSend, sendAgentPacket, NET_CHANNELS,
    // Debug
    snapshot,
    // Internal (for tests — exposed so test helpers can trigger flush without running systems)
    _flushDespawn,
    _reset() {
      _nextId = 1;
      _entities.clear();
      _components.clear();
      _pendingDespawn.clear();
      _handlers.clear();
      _systems.length = 0;
      _systemsDirty = false;
      _acc = 0;
      _prefabs.clear();
      _dataCache.clear();
      _netSocket = null;
      _netConnected = false;
      _netPeerId = null;
    },
  });

  return api;
})();

// Bridge to window.Core for browser inline scripts
if (typeof window !== "undefined") {
  if (!window.Engine) window.Engine = {};
  window.Engine.Core = Core;
}

export default Core;
