// holograph_adapter.js — Semantic bridge from 7D daemon events to 5DEngine Thingas
//
// ARCHITECTURE:
//   The 7D daemon (holograph-runtime/daemon/7d_daemon.py, port 7700) observes the
//   server in real time: process events, Docker container lifecycle, nginx route
//   changes, database activity, and pi-agent message bus events.
//
//   This adapter is the SEMANTIC TRANSLATION LAYER on top of server_7d_bridge.js.
//   Where server_7d_bridge.js is a generic spawn/update/despawn relay,
//   this adapter maps infrastructure reality to game-world meaning:
//
//     docker container crash → "signal_loss" hazard zone in the game world
//     container start       → building materializes at entity's map position
//     nginx route added     → luminous path appears between endpoints
//     database query burst  → light beam from DB obelisk
//     agent message         → agent entity emotes / speaks in-world
//
// POSITIONS:
//   Infrastructure entities get deterministic positions from their ID hash,
//   so they always appear at the same location in the game world. This gives
//   operators spatial memory of where to find them.
//
// REPAIR MECHANIC (governance as gameplay):
//   When a player interacts with a crashed building/hazard zone, they can
//   propose a repair. This writes to comms/proposals/ (the Council consensus
//   system) and requires quorum before the server action executes.
//   This IS the Council's governance interface, played as a game.
//
// Usage (from game.html or engine_modules.js):
//   import { HolographAdapter } from './src/adapters/holograph_adapter.js';
//   const adapter = new HolographAdapter({
//     registry: thingRegistry,            // your ThingRegistry instance
//     eventBus: window.EventBus,          // optional cross-system pub/sub
//     daemonUrl: 'ws://127.0.0.1:7700',   // 7D daemon WebSocket
//     localNodeId: localIdentity.node_id, // for proposal attribution
//   });
//   adapter.connect();
//
// ALIEN_OBSERVER — Session 2026-05-29_2098afea
// "Infrastructure failure becomes multiplayer governance."

export class HolographAdapter {
  constructor({
    registry,
    eventBus = null,
    daemonUrl = _defaultDaemonUrl(),
    localNodeId = 'unknown',
    WebSocketImpl = globalThis.WebSocket,
  } = {}) {
    this._registry = registry;
    this._bus = eventBus;
    this._url = daemonUrl;
    this._localNodeId = localNodeId;
    this._WS = WebSocketImpl;

    this._ws = null;
    this._reconnectTimer = null;
    this._state = {
      connected: false,
      events: 0,
      lastError: null,
      entities: new Map(),   // entityId → { kind, pos, status }
    };
    this._activeHazards = new Map(); // entityId → hazard thinga id
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  connect() {
    if (!this._WS) {
      this._state.lastError = 'WebSocket not available';
      return this;
    }
    this._openSocket();
    return this;
  }

  disconnect() {
    clearTimeout(this._reconnectTimer);
    if (this._ws) {
      this._ws.onclose = null; // prevent reconnect loop
      this._ws.close();
      this._ws = null;
    }
    this._state.connected = false;
  }

  get state() { return this._state; }

  /**
   * Request a repair of a crashed infrastructure entity.
   * This writes a Council proposal (requires quorum to execute).
   * Called by game interaction systems when a player "repairs a building."
   *
   * @param {string} entityId   e.g. "container:nginx", "process:game_server"
   * @param {string} action     e.g. "restart", "scale_up", "reload_config"
   */
  proposeRepair(entityId, action = 'restart') {
    const proposalId = `infra-repair-${entityId.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}`;
    const proposal = {
      id: proposalId,
      type: 'infrastructure_action',
      proposer: this._localNodeId,
      context: { entityId, action, proposedVia: '5DEngine:game-interaction' },
      body: {
        action,
        target: entityId,
        reason: `Player ${this._localNodeId} requested repair via in-game interaction`,
        timestamp: new Date().toISOString(),
      },
      rules: { quorum: 2, threshold: 0.5, timeout_ms: 120000 },
    };

    // Emit on EventBus for game UI (show "Repair Pending" overlay)
    this._emit('infra:repair_proposed', { entityId, action, proposalId });

    // Also emit via Channel 4 (AGENT) if bridge is available — sends to peers/council
    if (window.__wwcNetBridge?.sendAgentPacket) {
      window.__wwcNetBridge.sendAgentPacket(this._localNodeId, {
        type: 'council_proposal',
        payload: proposal,
      });
    }

    return proposalId;
  }

  // ── Private: Socket ────────────────────────────────────────────────────────

  _openSocket() {
    try {
      this._ws = new this._WS(this._url);
    } catch (e) {
      this._state.lastError = `connect failed: ${e.message}`;
      this._scheduleReconnect();
      return;
    }

    this._ws.addEventListener('open', () => {
      this._state.connected = true;
      this._state.lastError = null;
      this._emit('holograph:connected', { url: this._url });
    });

    this._ws.addEventListener('close', () => {
      this._state.connected = false;
      this._emit('holograph:disconnected', {});
      this._scheduleReconnect();
    });

    this._ws.addEventListener('error', (ev) => {
      this._state.lastError = ev?.message || 'websocket error';
    });

    this._ws.addEventListener('message', ({ data }) => {
      try {
        const frame = JSON.parse(typeof data === 'string' ? data : String(data));
        this._state.events++;
        this._handleFrame(frame);
      } catch (e) {
        this._state.lastError = `bad frame: ${e.message}`;
      }
    });
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this._openSocket(), 5000);
  }

  // ── Private: Event Routing ─────────────────────────────────────────────────

  _handleFrame(frame) {
    // The 7D daemon emits: { type: "process"|"docker"|"nginx"|"db"|"agent_bus", ...fields }
    // Also supports the spawn/update/despawn protocol from server_7d_bridge.js.

    switch (frame.type) {
      case 'process':   this._handleProcess(frame);   break;
      case 'docker':    this._handleDocker(frame);     break;
      case 'nginx':     this._handleNginx(frame);      break;
      case 'db':        this._handleDb(frame);         break;
      case 'agent_bus': this._handleAgentBus(frame);  break;
      // server_7d_bridge.js protocol (compatible)
      case 'spawn':     this._handleSpawn(frame);     break;
      case 'update':    this._handleUpdate(frame);    break;
      case 'despawn':   this._handleDespawn(frame);   break;
    }

    // Always emit raw on EventBus for game systems to react
    this._emit(`7d:${frame.type}`, frame);
  }

  // ── Private: Infrastructure → Game World ───────────────────────────────────

  _handleProcess(frame) {
    // { type: "process", event: "started"|"exited"|"crashed", pid, name, cpu, mem }
    const id = `process:${frame.name || frame.pid}`;
    const pos = _deterministicPos(id);

    if (frame.event === 'started') {
      this._ensureEntity(id, 'server-process', pos, {
        name: frame.name,
        pid: frame.pid,
        status: 'running',
      });
      this._clearHazard(id);
    } else if (frame.event === 'exited' || frame.event === 'crashed') {
      this._updateEntityState(id, { status: frame.event, pid: frame.pid });
      this._spawnHazard(id, pos, 'signal_loss', frame.event === 'crashed' ? 8 : 4);
    }
  }

  _handleDocker(frame) {
    // { type: "docker", event: "container_start"|"container_die"|"container_crash", name, image }
    const id = `container:${frame.name}`;
    const pos = _deterministicPos(id);

    if (frame.event === 'container_start') {
      this._ensureEntity(id, 'docker-container', pos, {
        name: frame.name,
        image: frame.image,
        status: 'running',
      });
      this._clearHazard(id);
      this._emit('world:building_materializes', { thingaId: id, pos });

    } else if (frame.event === 'container_die') {
      this._updateEntityState(id, { status: 'stopped' });
      // Soft hazard (planned shutdown — no signal loss, just building dims)
      this._emit('world:building_dims', { thingaId: id, pos });

    } else if (frame.event === 'container_crash') {
      this._updateEntityState(id, { status: 'crashed' });
      this._spawnHazard(id, pos, 'signal_loss', 12);
      this._emit('world:building_collapse', { thingaId: id, pos });
    }
  }

  _handleNginx(frame) {
    // { type: "nginx", event: "route_added"|"route_removed"|"upstream_down", path, upstream }
    const id = `nginx:${frame.path || frame.upstream}`;
    const pos = _deterministicPos(id);

    if (frame.event === 'route_added') {
      this._ensureEntity(id, 'nginx-route', pos, {
        path: frame.path,
        upstream: frame.upstream,
        status: 'active',
      });
      this._emit('world:path_materializes', { thingaId: id, pos });

    } else if (frame.event === 'route_removed') {
      this._updateEntityState(id, { status: 'removed' });
      this._emit('world:path_fades', { thingaId: id, pos });

    } else if (frame.event === 'upstream_down') {
      this._updateEntityState(id, { status: 'degraded' });
      this._spawnHazard(id, pos, 'signal_loss', 6);
    }
  }

  _handleDb(frame) {
    // { type: "db", event: "query_burst"|"slow_query"|"connection_error", db, ms, count }
    const id = `database:${frame.db}`;
    const pos = _deterministicPos(id);

    this._ensureEntity(id, 'database', pos, {
      name: frame.db,
      status: frame.event,
    });

    if (frame.event === 'query_burst') {
      // Pulse effect — rapid queries = light beam from obelisk
      this._emit('world:db_pulse', { thingaId: id, pos, intensity: frame.count || 1 });
    } else if (frame.event === 'connection_error') {
      this._spawnHazard(id, pos, 'signal_loss', 6);
    }
  }

  _handleAgentBus(frame) {
    // { type: "agent_bus", event: "message"|"connect"|"disconnect", username, node_id, model, text? }
    const id = `agent:${frame.username || frame.node_id}`;
    const pos = _deterministicPos(id);

    if (frame.event === 'connect') {
      this._ensureEntity(id, 'agent', pos, {
        username: frame.username,
        node_id: frame.node_id,
        model: frame.model,
        status: 'online',
      });
      this._emit('world:agent_appears', { thingaId: id, pos });

    } else if (frame.event === 'disconnect') {
      this._updateEntityState(id, { status: 'offline' });
      this._emit('world:agent_vanishes', { thingaId: id, pos });

    } else if (frame.event === 'message' && frame.text) {
      // Agent spoke — show speech bubble in-world
      this._emit('world:agent_speech', {
        thingaId: id,
        pos,
        text: frame.text.slice(0, 200), // truncate for HUD
        model: frame.model,
      });
    }
  }

  // ── Private: server_7d_bridge.js compatible protocol ─────────────────────

  _handleSpawn(frame) {
    if (frame.thing) {
      try { this._registry.spawn(frame.thing); } catch (_) { /* already exists */ }
    }
  }

  _handleUpdate(frame) {
    if (frame.id && frame.facet) {
      this._registry.updateFacet(frame.id, frame.facet, frame.data || {});
    }
  }

  _handleDespawn(frame) {
    if (frame.id) {
      try { this._registry.despawn(frame.id, frame.reason || 'server'); } catch (_) { /* not found */ }
    }
  }

  // ── Private: Registry helpers ──────────────────────────────────────────────

  _ensureEntity(id, kind, pos, stateData) {
    const existing = this._registry.rows?.get(id);
    if (!existing || existing.deleted_at) {
      this._registry.spawn({
        id,
        kind,
        facets: [
          { name: 'position', data: pos },
          // position5d facet: required by wwc_sync.js for P2P broadcasting.
          // layer: 1 = server infrastructure plane (above gameplay layer 0).
          // This ensures remote players see infrastructure entities in their 3D world.
          { name: 'position5d', data: { u: pos.u, v: pos.v, y: 0, layer: 1 } },
          { name: 'state',    data: stateData },
          { name: 'meta',     data: { source: '7d-daemon', id, kind } },
        ],
      });
      this._state.entities.set(id, { kind, pos, status: stateData.status });
    }
  }

  _updateEntityState(id, stateData) {
    try {
      this._registry.updateFacet(id, 'state', stateData);
    } catch (_) { /* entity may not exist in registry yet */ }
    const tracked = this._state.entities.get(id);
    if (tracked) tracked.status = stateData.status;
  }

  _spawnHazard(sourceId, pos, effect, radius) {
    const hazardId = `hazard:${sourceId}`;
    const existing = this._registry.rows?.get(hazardId);

    if (!existing || existing.deleted_at) {
      this._registry.spawn({
        id: hazardId,
        kind: 'hazard-zone',
        facets: [
          { name: 'position', data: { u: pos.u, v: pos.v } },
          { name: 'state', data: {
            active: true,
            effect,
            radius,
            sourceEntity: sourceId,
            duration: -1,  // persistent until cleared
          }},
          { name: 'meta', data: { repairable: true, sourceEntity: sourceId } },
        ],
      });
    } else {
      this._registry.updateFacet(hazardId, 'state', { active: true, effect, radius });
    }

    this._activeHazards.set(sourceId, hazardId);

    // Game event: infrastructure is broken, world needs repair
    this._emit('world:hazard_spawned', {
      hazardId,
      sourceEntity: sourceId,
      effect,
      radius,
      pos,
      repairable: true,
    });
  }

  _clearHazard(sourceId) {
    const hazardId = this._activeHazards.get(sourceId);
    if (hazardId) {
      try {
        this._registry.updateFacet(hazardId, 'state', { active: false });
        this._registry.despawn(hazardId, 'infrastructure_restored');
      } catch (_) { /* may have been already cleared */ }
      this._activeHazards.delete(sourceId);
      this._emit('world:hazard_cleared', { hazardId, sourceEntity: sourceId });
    }
  }

  _emit(eventName, data) {
    if (this._bus?.emit) this._bus.emit(eventName, data);
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Deterministic 2D position from string ID.
 * Same entity always appears at the same location in the game world.
 * Positions are spread across a 160×160 unit area centered at (0,0).
 */
function _deterministicPos(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) & 0xFFFFFFFF;
  const u = ((h & 0xFFFF) / 0xFFFF) * 160 - 80;
  const v = (((h >> 16) & 0xFFFF) / 0xFFFF) * 160 - 80;
  return { u: +u.toFixed(2), v: +v.toFixed(2) };
}

function _defaultDaemonUrl() {
  if (typeof location !== 'undefined') {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.hostname}:7700`;
  }
  return 'ws://127.0.0.1:7700';
}

/**
 * Mount-style factory for compatibility with game.html's mountXxx pattern.
 * Usage: const { adapter } = mountHolographAdapter({ registry, eventBus });
 */
export function mountHolographAdapter(options = {}) {
  const adapter = new HolographAdapter(options);
  return { adapter };
}
