// net.js — CWP v1.0 wire protocol + transport-agnostic server hub.
//
// The envelope shape is FROZEN at v1.0 — extend by adding fields/types,
// never break old ones. Per GAME_SERVER_NETWORKING.md.
//
//   { cwp: "1.0", type, session, vclock, sig, payload, ts? }
//
// vclock: { nodeId: counter, ... }; merge by per-key max.
// sig: Ed25519 signature placeholder (string). Iter 20 ships the SHAPE;
// crypto comes in a later iter.
//
// Hub: in-memory room registry. Clients connect via any transport (ws,
// in-process channel, etc) — Hub doesn't know.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANet = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PROTOCOL_VERSION = "1.0";

  // ---- Envelope ----
  function encodeEnvelope(type, payload, opts) {
    opts = opts || {};
    return {
      cwp: PROTOCOL_VERSION,
      type,
      session: opts.session || null,
      vclock:  opts.vclock  || {},
      sig:     opts.sig     || "",
      payload: payload || null,
      ts:      opts.ts != null ? opts.ts : Date.now(),
    };
  }

  function decodeEnvelope(raw) {
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return { ok: false, reason: "bad_json" }; }
    }
    if (!raw || typeof raw !== "object") return { ok: false, reason: "not_object" };
    if (raw.cwp !== PROTOCOL_VERSION) return { ok: false, reason: `bad_protocol_${raw.cwp}` };
    if (typeof raw.type !== "string") return { ok: false, reason: "missing_type" };
    return { ok: true, env: raw };
  }

  // ---- Vector clocks ----
  function vclockBump(vc, nodeId) {
    const out = Object.assign({}, vc);
    out[nodeId] = (out[nodeId] || 0) + 1;
    return out;
  }
  function vclockMerge(a, b) {
    const out = Object.assign({}, a);
    for (const k of Object.keys(b)) {
      out[k] = Math.max(out[k] || 0, b[k]);
    }
    return out;
  }
  // -1 = a precedes b; 1 = b precedes a; 0 = concurrent
  function vclockCompare(a, b) {
    let aLess = false, bLess = false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const av = a[k] || 0, bv = b[k] || 0;
      if (av < bv) aLess = true;
      if (bv < av) bLess = true;
    }
    if (aLess && !bLess) return -1;
    if (bLess && !aLess) return 1;
    return 0; // equal or concurrent
  }

  // ---- Hub ----
  function createHub(opts) {
    opts = opts || {};
    const hub = {
      nodeId: opts.nodeId || `hub_${Math.random().toString(36).slice(2, 8)}`,
      rooms: new Map(),       // roomId → { clients: Map<clientId, send>, vclock, state }
      clients: new Map(),     // clientId → { send, roomIds: Set }
    };

    function ensureRoom(roomId) {
      if (!hub.rooms.has(roomId)) {
        hub.rooms.set(roomId, { clients: new Map(), vclock: {}, state: {} });
      }
      return hub.rooms.get(roomId);
    }

    function joinRoom(roomId, clientId, sendFn) {
      const room = ensureRoom(roomId);
      room.clients.set(clientId, sendFn);
      if (!hub.clients.has(clientId)) hub.clients.set(clientId, { send: sendFn, roomIds: new Set() });
      hub.clients.get(clientId).roomIds.add(roomId);
      // Tell the joiner who's already here
      sendFn(encodeEnvelope("room_state", {
        roomId,
        peers: Array.from(room.clients.keys()).filter(id => id !== clientId),
        state: room.state,
      }, { vclock: room.vclock }));
      // Tell others someone joined
      broadcast(roomId, encodeEnvelope("peer_joined", { clientId }), clientId);
    }

    function leaveRoom(roomId, clientId) {
      const room = hub.rooms.get(roomId);
      if (!room) return;
      room.clients.delete(clientId);
      const c = hub.clients.get(clientId);
      if (c) c.roomIds.delete(roomId);
      broadcast(roomId, encodeEnvelope("peer_left", { clientId }), null);
      if (room.clients.size === 0) hub.rooms.delete(roomId);
    }

    function broadcast(roomId, env, exceptClientId) {
      const room = hub.rooms.get(roomId);
      if (!room) return 0;
      // Bump room vclock and merge envelope's
      room.vclock = vclockBump(room.vclock, hub.nodeId);
      if (env.vclock) room.vclock = vclockMerge(room.vclock, env.vclock);
      env.vclock = room.vclock;
      let n = 0;
      for (const [cid, send] of room.clients) {
        if (cid === exceptClientId) continue;
        send(env);
        n++;
      }
      return n;
    }

    // Player intent (pos update) — owner of room ticks; replicas just receive
    function pushIntent(roomId, clientId, intent) {
      const env = encodeEnvelope("intent", { clientId, intent });
      broadcast(roomId, env, null);
    }

    function disconnect(clientId) {
      const c = hub.clients.get(clientId);
      if (!c) return;
      for (const roomId of Array.from(c.roomIds)) leaveRoom(roomId, clientId);
      hub.clients.delete(clientId);
    }

    return { ...hub, ensureRoom, joinRoom, leaveRoom, broadcast, pushIntent, disconnect };
  }

  return {
    PROTOCOL_VERSION,
    encodeEnvelope, decodeEnvelope,
    vclockBump, vclockMerge, vclockCompare,
    createHub,
  };
});
