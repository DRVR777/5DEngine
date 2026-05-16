// multiplayer.js — server + client glue between Net hub and WorldState.
//
// Server (authoritative): owns truth. Receives "intent" envelopes,
// applies them to the world, periodically broadcasts a "snapshot".
// Client: sends intents, applies snapshots locally. Never sends positions.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMP = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Server side. Wraps Hub + WorldState, ticks at 20Hz by default.
  function createServer(opts) {
    const Net = (typeof require === "function") ? require("./net.js") :
      (typeof self !== "undefined" ? self.GTANet : null);
    if (!Net) throw new Error("Net module not available");
    opts = opts || {};
    const hub = Net.createHub({ nodeId: opts.nodeId || "server" });
    const world = opts.world; // caller supplies a WorldState
    const speed = opts.walkSpeed || 5;
    const tickHz = opts.tickHz || 20;
    let intents = [];

    function attachClient(roomId, clientId, sendFn) {
      hub.joinRoom(roomId, clientId, sendFn);
      // Spawn a player entry in world for them
      world.setPlayer(clientId, 0, 0, 0, 0, 0);
    }
    function detachClient(roomId, clientId) {
      hub.leaveRoom(roomId, clientId);
      world.players.delete(clientId);
    }

    function receiveIntent(roomId, clientId, intent) {
      intents.push({ roomId, clientId, intent });
    }

    // Apply queued intents → broadcast snapshot.
    function tick(dt) {
      // Apply
      for (const { roomId, clientId, intent } of intents) {
        const p = world.players.get(clientId);
        if (!p || !intent) continue;
        if (intent.action === "move" && intent.direction) {
          const d = intent.direction;
          const m = Math.hypot(d.u || 0, d.v || 0) || 1;
          const du = (d.u / m) * speed * dt;
          const dv = (d.v / m) * speed * dt;
          world.setPlayer(clientId, p.x, p.y, p.z, p.u + du, p.v + dv);
        }
      }
      intents = [];
      // Broadcast a positions snapshot per room
      for (const [roomId, room] of hub.rooms) {
        const positions = {};
        for (const cid of room.clients.keys()) {
          const p = world.players.get(cid);
          if (p) positions[cid] = { u: p.u, v: p.v, y: p.y };
        }
        const env = Net.encodeEnvelope("snapshot", { positions, t: Date.now() });
        hub.broadcast(roomId, env, null);
      }
    }

    return { hub, world, tickHz, attachClient, detachClient, receiveIntent, tick };
  }

  // Client side. Tracks remote-player positions from snapshots.
  function createClient(opts) {
    opts = opts || {};
    const remotePositions = new Map();   // clientId → {u, v, y}
    let onSelfMoved = null;

    function handleEnvelope(env) {
      if (!env) return;
      if (env.type === "snapshot" && env.payload && env.payload.positions) {
        remotePositions.clear();
        for (const [id, p] of Object.entries(env.payload.positions)) {
          remotePositions.set(id, p);
        }
      } else if (env.type === "peer_joined" || env.type === "peer_left") {
        // No-op for v1 — snapshot will reflect roster
      } else if (env.type === "room_state" && env.payload && env.payload.peers) {
        // Initial roster known; positions fill in on first snapshot
      }
    }

    return {
      remotePositions,
      handleEnvelope,
    };
  }

  return { createServer, createClient };
});
