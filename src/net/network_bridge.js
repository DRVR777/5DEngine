/**
 * network_bridge.js — browser-side relay between 5DEngine and worldWideComms/mkii
 *
 * Architecture path:
 *   5DEngine (browser, socket.io client)
 *     → game_server.py (Flask-SocketIO, port 5050)
 *     → GameBridge TCP (localhost:7780, mkii/game_bridge.py)
 *     → NodeMKII stream encryption
 *     → relay → peer
 *
 * Wire channels (must match game_bridge.py NET_CHANNELS):
 *   0 STATE   — hero position, HP, game mode (20Hz)
 *   1 EVENTS  — kills, pickups, wave start (immediate)
 *   2 WORLD   — build mutations, tile changes (on-change)
 *   3 CHAT    — voice/text (reserved)
 *   4 AGENT   — dworld:// identity + payload (on-demand)
 *
 * Usage:
 *   import { NetworkBridge } from "./src/net/network_bridge.js";
 *   const bridge = new NetworkBridge(socket, peerId, Engine.Core);
 *   bridge.start();
 *   // State sends happen automatically at 20Hz once bridge.start() is called.
 *   // To send a game event:
 *   bridge.sendEvent("enemy_killed", { type: "grunt", pos: { u, v } });
 */

export class NetworkBridge {
  constructor(socket, peerId, core, getState) {
    this._socket = socket;
    this._peerId = peerId;
    this._core = core;
    this._getState = getState;   // () => { heroHp, heroU, heroV, gameMode, ... }
    this._running = false;
    this._stateInterval = null;
    this._connected = false;
    this._stats = { sent: 0, recv: 0, bytes: 0 };
  }

  start() {
    if (this._running) return;
    this._running = true;

    this._socket.on("bridge_connected", ({ peer_id }) => {
      if (peer_id !== this._peerId) return;
      this._connected = true;
      this._core.emit("net:connected", { peerId: this._peerId });
      this._startStatePump();
    });

    this._socket.on("bridge_disconnected", ({ peer_id }) => {
      if (peer_id !== this._peerId) return;
      this._connected = false;
      this._core.emit("net:disconnected", { peerId: this._peerId });
      this._stopStatePump();
    });

    this._socket.on("bridge_frame", (frame) => {
      this._stats.recv++;
      this._core.emit("net:recv", frame);
      this._dispatch(frame);
    });

    // Wire Core event bus → socket relay
    this._core.on("net:send", ({ channel, data }) => {
      if (!this._connected) return;
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      this._socket.emit("bridge_frame", {
        peer_id: this._peerId,
        channel,
        data: payload,
      });
      this._stats.sent++;
      this._stats.bytes += payload.length;
    });
  }

  stop() {
    this._running = false;
    this._connected = false;
    this._stopStatePump();
  }

  /** Send a one-shot game event to peer. */
  sendEvent(type, payload) {
    this._core.netSend(this._core.NET_CHANNELS.EVENTS, { type, payload, t: Date.now() });
  }

  /** Send a world mutation (build, destruct). */
  sendWorldMutation(op, data) {
    this._core.netSend(this._core.NET_CHANNELS.WORLD, { op, data, t: Date.now() });
  }

  /** Send a dworld:// agent packet (identity + payload). */
  sendAgentPacket(identityId, payload, hopHistory = []) {
    this._core.sendAgentPacket({ identityId, payload, hopHistory });
  }

  get stats() { return { ...this._stats, connected: this._connected }; }

  // ── Private ────────────────────────────────────────────────────────────────

  _startStatePump() {
    this._stopStatePump();
    this._stateInterval = setInterval(() => {
      if (!this._connected || !this._getState) return;
      const state = this._getState();
      this._core.netSend(this._core.NET_CHANNELS.STATE, state);
    }, 50); // 20Hz
  }

  _stopStatePump() {
    if (this._stateInterval) {
      clearInterval(this._stateInterval);
      this._stateInterval = null;
    }
  }

  _dispatch(frame) {
    // Route incoming frames to specific Core events by channel
    switch (frame.channel) {
      case 0: this._core.emit("net:state",  frame.data); break;
      case 1: this._core.emit("net:event",  frame.data); break;
      case 2: this._core.emit("net:world",  frame.data); break;
      case 3: this._core.emit("net:chat",   frame.data); break;
      case 4: this._core.emit("net:agent",  frame.data); break;
    }
  }
}
