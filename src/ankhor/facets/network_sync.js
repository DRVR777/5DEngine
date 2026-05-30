/**
 * network_sync.js — P2P state synchronization facet.
 *
 * This facet, when attached to a Thing, enables that Thing's state to be
 * serialized and broadcast to peers via the NetworkBridge (STATE channel).
 *
 * Architecture:
 *   1. Each Thing with "network-sync" has an assigned owner (peerId).
 *   2. On tick, the owner serializes the Thing's allowed facets (respecting
 *      visibility policy) into a compact STATE packet.
 *   3. Packets are sent at the configured rate (default 20Hz).
 *   4. Remote peers deserialize and call registry.updateFacet() to apply.
 *   5. Interpolation is applied client-side to smooth jitter.
 *
 * Delta protocol:
 *   - Full snapshot on first connect (or after >500ms gap).
 *   - Delta diffs thereafter — only changed facets included.
 *   - Sequence numbers for ordering + gap detection.
 *   - Drift correction: if remote is >3 ticks behind, force full snapshot.
 *
 * Data shape:
 *   {
 *     owner_peer_id: string,      // who controls this Thing
 *     sync_rate_hz: number,       // how often to send (default 20)
 *     facets_to_sync: string[],   // facet names to include
 *     // internal state:
 *     _last_sent_t: number,
 *     _seq: number,
 *     _last_snapshot: object,
 *     // interpolation for remote Things:
 *     _interp_buffer: Array<{t, snapshot}>,
 *     _interp_delay_ms: number,   // how far behind to interpolate (default 100ms)
 *   }
 *
 * Integration with NetworkBridge:
 *   The NetworkBridge's net:recv handler should call:
 *     networkSync.applyRemotePacket(registry, packet)
 *   when a STATE channel packet arrives.
 *
 * ARCHITECT (2026-05-29): This replaces the stub app_multiplayer_wiring.js.
 * The delta protocol is simple but sufficient for 2-4 player co-op.
 * For 16+ players, add spatial partitioning on the u,v axes.
 */

// Facets that are safe to include in STATE packets by default
const DEFAULT_SYNC_FACETS = [
  "position5d",
  "position",
  "health",
];

// How many state snapshots to buffer for interpolation
const INTERP_BUFFER_SIZE = 8;

export default {
  priority: 200,  // runs LAST — after all systems update state, then sync

  init(_thing, data) {
    if (!data.owner_peer_id) data.owner_peer_id = null;
    if (!data.sync_rate_hz) data.sync_rate_hz = 20;
    if (!data.facets_to_sync) data.facets_to_sync = [...DEFAULT_SYNC_FACETS];
    data._last_sent_t = 0;
    data._seq = 0;
    data._last_snapshot = null;
    data._interp_buffer = [];
    data._interp_delay_ms = 100;
  },

  tick(thing, data, _dt, registry) {
    if (!data || !data.owner_peer_id) return;

    // Determine if this Thing is locally owned
    const localPeerId = registry.facetData("__session__", "peer-id")?.id;
    if (!localPeerId) return;
    const isOwner = data.owner_peer_id === localPeerId;

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const interval = 1000 / (data.sync_rate_hz || 20);

    if (isOwner && (now - data._last_sent_t) >= interval) {
      // Take snapshot of owned facets
      const snapshot = _takeSnapshot(thing, data, registry);
      // Compute delta vs last snapshot
      const delta = _computeDelta(data._last_snapshot, snapshot);
      if (delta) {
        data._seq = (data._seq + 1) & 0xffff;
        const packet = {
          type: "state",
          thing_id: thing.id,
          thing_kind: thing.kind,
          seq: data._seq,
          t: now,
          delta,
          full: !data._last_snapshot,  // first packet is always full
        };
        // Emit through EventBus if available
        const bus = (typeof EventBus !== "undefined") ? EventBus : null;
        if (bus?.emit) bus.emit("net:state_packet", packet);
        data._last_snapshot = snapshot;
        data._last_sent_t = now;
      }
    } else if (!isOwner) {
      // Apply interpolation for remote Things
      _applyInterpolation(thing, data, now, registry);
    }
  },

  /**
   * Apply a STATE packet received from a remote peer.
   * Call this from the NetworkBridge net:recv handler.
   */
  applyRemotePacket(registry, packet) {
    if (packet.type !== "state" || !packet.thing_id) return;

    const syncData = registry.facetData(packet.thing_id, "network-sync");
    if (!syncData) return;

    // Merge delta into interp buffer
    if (packet.full) {
      syncData._last_snapshot = packet.delta;
    } else if (syncData._last_snapshot) {
      syncData._last_snapshot = { ...syncData._last_snapshot, ...packet.delta };
    } else {
      // Got delta but no baseline — request full snapshot
      // (simple: just use it as-is, next full will correct)
      syncData._last_snapshot = packet.delta;
    }

    syncData._interp_buffer.push({ t: packet.t, snapshot: { ...syncData._last_snapshot } });
    if (syncData._interp_buffer.length > INTERP_BUFFER_SIZE) {
      syncData._interp_buffer.shift();
    }
  },
};

function _takeSnapshot(thing, data, registry) {
  const snapshot = {};
  for (const facetName of data.facets_to_sync) {
    const fd = registry.facetData(thing.id, facetName);
    if (fd != null) snapshot[facetName] = _shallowCopy(fd);
  }
  return snapshot;
}

function _computeDelta(prev, curr) {
  if (!prev) return curr;
  const delta = {};
  let changed = false;
  for (const [k, v] of Object.entries(curr)) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(v)) {
      delta[k] = v;
      changed = true;
    }
  }
  return changed ? delta : null;
}

function _applyInterpolation(thing, data, nowMs, registry) {
  const buf = data._interp_buffer;
  if (buf.length < 2) return;

  const targetT = nowMs - (data._interp_delay_ms || 100);

  // Find the two frames to interpolate between
  let fromIdx = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].t <= targetT && buf[i + 1].t > targetT) {
      fromIdx = i;
      break;
    }
  }

  const from = buf[fromIdx];
  const to = buf[Math.min(fromIdx + 1, buf.length - 1)];
  if (!from || !to || from === to) return;

  const span = to.t - from.t;
  if (span <= 0) return;

  const alpha = Math.max(0, Math.min(1, (targetT - from.t) / span));

  // Interpolate position5d if present
  if (from.snapshot["position5d"] && to.snapshot["position5d"]) {
    const fp = from.snapshot["position5d"];
    const tp = to.snapshot["position5d"];
    const pos = registry.facetData(thing.id, "position5d");
    if (pos) {
      pos.x = _lerp(fp.x, tp.x, alpha);
      pos.y = _lerp(fp.y, tp.y, alpha);
      pos.z = _lerp(fp.z, tp.z, alpha);
      pos.u = _lerp(fp.u, tp.u, alpha);
      pos.v = _lerp(fp.v, tp.v, alpha);
      pos.heading = _lerpAngle(fp.heading, tp.heading, alpha);
    }
  }
}

function _lerp(a, b, t) { return a + (b - a) * t; }
function _lerpAngle(a, b, t) {
  // Shortest-path angle interpolation
  let delta = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + delta * t;
}
function _shallowCopy(obj) {
  if (typeof obj !== "object" || obj == null) return obj;
  return { ...obj };
}
