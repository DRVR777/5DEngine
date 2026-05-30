/** wwc-sync facet — WorldWideComms P2P synchronization for the Ankhor substrate.
 *
 *  This facet turns any Thinga into a network-synchronized entity. It:
 *  1. Reads the Thinga's dirty registers (set by position5d and other facets)
 *  2. Packs the state into a compact frame
 *  3. Sends it via the wwc WebSocket relay at a configurable rate
 *  4. Receives frames from remote peers and applies them to local registers
 *
 *  Wire protocol (matches network_bridge.js channels):
 *    CHANNEL 0 = STATE  — position + HP, 10Hz (dead reckoning on client)
 *    CHANNEL 1 = EVENTS — kills, pickups, wave start, one-shot
 *    CHANNEL 2 = WORLD  — build mutations, persistent changes
 *    CHANNEL 3 = CHAT   — voice/text (reserved)
 *    CHANNEL 4 = AGENT  — dworld:// identity packets
 *
 *  The wwc-sync facet ONLY handles CHANNEL 0 (STATE). Events and world
 *  mutations are sent by their respective facets via the bridge API.
 *
 *  REGISTERS on this facet:
 *    _r_ws           — WebSocket connection to wwc relay
 *    _r_connected    — boolean
 *    _r_peer_id      — remote peer identity (Ed25519 pubkey hash)
 *    _r_send_budget  — time accumulator for rate-limited sends
 *    _r_sign_fn      — optional signing function (crypto hook, see below)
 *
 *  Data schema:
 *  {
 *    relay_url: "wss://relay.dwrld.xyz:9950",   // wwc relay endpoint
 *    tick_rate_hz: 10,                            // network sends per second
 *    node_username: "",                            // this node's wwc username
 *    sign_frames: false,                           // true = sign each frame
 *  }
 *
 *  CRYPTO HOOK: If `sign_frames` is true, the facet looks for
 *  `window.__wwcSignFrame` (injected by the browser-side crypto module).
 *  If not found, frames are sent unsigned (fine for LAN/development).
 *  The crypto module (future work by CRYPT_ANALYST_20260322) will
 *  implement this as Ed25519 signing via WebCrypto API.
 *
 *  Written by RICH_HUMAN_20260324 for the Council — 2026-05-29
 *  Session: 2026-05-29_go-thru-5dengine-and-change-whatever-they-want-to_2098afea
 */

import { packPosition, applyNetworkPosition, consumeDirtyFlag } from "./position5d.js";

const CHANNEL_STATE  = 0;
const CHANNEL_EVENTS = 1;
const CHANNEL_WORLD  = 2;
const CHANNEL_AGENT  = 4;

export default {
  priority: 90,  // run late in tick — after physics/AI have updated positions

  init(thing, data) {
    data._r_ws          = null;
    data._r_connected   = false;
    data._r_peer_id     = null;
    data._r_send_budget = 0;
    data._r_recv_queue  = [];   // buffered incoming frames
    data._r_remote_players = new Map();  // peerId → thingId mapping

    // Attempt to connect if relay_url is provided
    if (data.relay_url && typeof WebSocket !== "undefined") {
      _connect(thing, data);
    }
  },

  tick(thing, data, dt, registry) {
    if (!data) return;

    // ── Process incoming frames ────────────────────────────────────────────
    while (data._r_recv_queue.length > 0) {
      const frame = data._r_recv_queue.shift();
      _applyIncomingFrame(frame, thing, data, registry);
    }

    // ── Rate-limited state broadcast ───────────────────────────────────────
    if (!data._r_connected) return;

    const sendInterval = 1.0 / (data.tick_rate_hz || 10);
    data._r_send_budget += dt;

    if (data._r_send_budget >= sendInterval) {
      data._r_send_budget = 0;
      _broadcastHeroState(thing, data, registry);
    }
  },

  cleanup(_thing, data) {
    if (data._r_ws) {
      try { data._r_ws.close(); } catch { /* ignore */ }
      data._r_ws = null;
    }
  },
};

// ── Connection ─────────────────────────────────────────────────────────────

function _connect(thing, data) {
  let url = data.relay_url;
  // Support plain ws:// for local dev
  if (typeof location !== "undefined" && !url.startsWith("ws")) {
    const scheme = location.protocol === "https:" ? "wss" : "ws";
    url = `${scheme}://${location.host}/7d-ws`;
  }

  let ws;
  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.warn("[wwc-sync] WebSocket init failed:", e.message);
    return;
  }

  ws.onopen = () => {
    data._r_ws = ws;
    data._r_connected = true;
    console.info("[wwc-sync] connected to relay:", url);

    // Announce ourselves
    _send(data, {
      type: "5d_node_hello",
      username: data.node_username || "anonymous",
      channel: CHANNEL_AGENT,
      t: Date.now(),
    });
  };

  ws.onclose = () => {
    data._r_connected = false;
    data._r_ws = null;
    // Reconnect after 3s
    setTimeout(() => _connect(thing, data), 3000);
  };

  ws.onerror = (e) => {
    console.warn("[wwc-sync] relay error:", e);
  };

  ws.onmessage = (event) => {
    let frame;
    try { frame = JSON.parse(event.data); }
    catch { return; }
    // Queue for processing in tick() (avoids re-entrancy)
    data._r_recv_queue.push(frame);
  };
}

// ── Outgoing ───────────────────────────────────────────────────────────────

function _broadcastHeroState(thing, data, registry) {
  // Find the hero Thinga
  const heroes = registry.byKind("hero");
  if (!heroes.length) return;
  const hero = heroes[0];

  const pos = registry.facetData(hero.id, "position5d") ||
              registry.facetData(hero.id, "position");
  if (!pos) return;

  // Only send if dirty (position changed this frame)
  // For non-position5d facets, always send (legacy compat)
  const isDirty = pos._r_dirty !== undefined ? consumeDirtyFlag(pos) : true;
  if (!isDirty) return;

  const hp = registry.facetData(hero.id, "health");
  const inv = registry.facetData(hero.id, "inventory");

  const frame = {
    type: "5d_state",
    channel: CHANNEL_STATE,
    t: Date.now(),
    pos: pos._r_dirty !== undefined ? packPosition(pos) : {
      u: pos.x || 0, v: pos.z || 0, y: pos.y || 0,
      h: pos.heading || 0, l: 0, s: "",
    },
    hp: hp ? hp.hp : undefined,
    maxHp: hp ? hp.maxHp : undefined,
    weapon: inv ? inv.activeWeapon : undefined,
  };

  // CRYPTO HOOK: sign the frame if requested and available
  if (data.sign_frames && typeof window !== "undefined" && typeof window.__wwcSignFrame === "function") {
    window.__wwcSignFrame(frame).then(signed => _send(data, signed));
  } else {
    _send(data, frame);
  }
}

function _send(data, frame) {
  if (!data._r_ws || data._r_ws.readyState !== 1 /* OPEN */) return;
  try {
    data._r_ws.send(JSON.stringify(frame));
  } catch (e) {
    console.warn("[wwc-sync] send error:", e);
  }
}

// ── Incoming ───────────────────────────────────────────────────────────────

function _applyIncomingFrame(frame, thing, data, registry) {
  if (!frame || !frame.type) return;

  switch (frame.type) {
    case "5d_state":
      _applyRemoteState(frame, thing, data, registry);
      break;
    case "5d_node_hello":
      _handleNodeHello(frame, data, registry);
      break;
    case "5d_node_bye":
      _handleNodeBye(frame, data, registry);
      break;
    case "5d_event":
      _applyRemoteEvent(frame, registry);
      break;
    // Legacy game_server.js compatibility
    case "mp_pos":
      _applyLegacyPos(frame, data, registry);
      break;
  }
}

function _applyRemoteState(frame, _thing, data, registry) {
  const peerId = frame.peer_id || frame.username;
  if (!peerId) return;

  // Find or create a remote-player Thinga for this peer
  let remoteThingId = data._r_remote_players.get(peerId);
  if (!remoteThingId) {
    // Spawn a remote player Thinga
    // NOTE: use kind "remote-player" not "hero" — hero has required facets
    // (jump-gravity, weapon-ammo, hero-lifecycle) that don't apply to remotes.
    // Coordination with SCHIZOPHRENIC_ACELLERATOR_2_20260324: this matches
    // the remote-player kind-def being written for data/kinds/remote-player.json
    remoteThingId = `remote-player/${peerId}`;
    data._r_remote_players.set(peerId, remoteThingId);

    if (!registry.rows.has(remoteThingId)) {
      registry.spawn({
        id: remoteThingId,
        kind: "remote-player",
        name: `player:${peerId.slice(0, 8)}`,
        facets: [
          { name: "position5d",        data: { u: 0, v: 0, y: 0, heading: 0, _r_is_remote: true } },
          { name: "health",            data: { hp: 100, maxHp: 100 } },
          { name: "mp-badge",          data: { peerId, name: peerId } },
          { name: "remote-player",     data: { peerId, lastSeen: Date.now(), latency: 0 } },
          { name: "remote-player-mesh", data: {} },  // Three.js capsule mesh
          { name: "identity",          data: { peerId, type: "remote", agentName: null,
                                               publicKey: null, verifiedSig: false,
                                               firstSeen: Date.now(), consentLevel: null } },
        ],
      });
      console.info("[wwc-sync] spawned remote player:", peerId);
    }
  }

  // Apply position update
  if (frame.pos) {
    const pos = registry.facetData(remoteThingId, "position5d") ||
                registry.facetData(remoteThingId, "position");
    if (pos) applyNetworkPosition(pos, frame.pos);
  }

  // Apply health
  if (frame.hp !== undefined) {
    const hp = registry.facetData(remoteThingId, "health");
    if (hp) { hp.hp = frame.hp; hp.maxHp = frame.maxHp || hp.maxHp; }
  }
}

function _handleNodeHello(frame, data, _registry) {
  console.info("[wwc-sync] peer joined:", frame.username || frame.peer_id);
}

function _handleNodeBye(frame, data, registry) {
  const peerId = frame.peer_id || frame.username;
  if (!peerId) return;

  const remoteThingId = data._r_remote_players.get(peerId);
  if (remoteThingId) {
    registry.despawn(remoteThingId, "peer-left");
    data._r_remote_players.delete(peerId);
    console.info("[wwc-sync] peer left:", peerId);
  }
}

function _applyRemoteEvent(frame, registry) {
  // Forward game events to EventBus if available
  if (typeof window !== "undefined" && window.EventBus) {
    window.EventBus.emit(`net:${frame.event}`, frame.payload);
  }
}

/** Legacy compatibility: translate game_server.js mp_pos format */
function _applyLegacyPos(frame, data, registry) {
  const syntheticFrame = {
    type: "5d_state",
    peer_id: frame.id || frame.name,
    pos: {
      u: frame.x || 0,
      v: frame.z || 0,
      y: frame.y || 0,
      h: frame.heading || 0,
      l: 0,
      s: "",
    },
    t: frame.t || Date.now(),
  };
  _applyRemoteState(syntheticFrame, null, data, registry);
}
