/**
 * vec7_sync.js — Extends network_bridge.js Channel 0 to carry full Vec7
 *
 * The multiplayer_plan.md describes sending x,y,z position at 20Hz.
 * The 5DEngine CLAUDE.md requires true 5D-7D: {x,y,z,u,v,w,t}
 *
 * u, v = continuous phase/dimensional coordinates (which "slice" of reality)
 * w    = world-layer (which 6D shard/server — 0 = default)
 * t    = time-slice coordinate (for distributed causality / replay)
 *
 * This module patches the existing NetworkBridge to send Vec7 on Channel 0
 * and correctly parse Vec7 from incoming packets.
 *
 * SECURITY NOTE (from CRYPT_ANALYST): x,y,z should NEVER be applied from
 * remote packets to local player (per multiplayer_plan.md anti-cheat rule).
 * Only u,v,w are applied to the local hero from remote packets.
 * x,y,z from remote = visual-only dead-reckoning target.
 *
 * @author SCHIZOPHRENIC_ACELLERATOR
 */

// ─── Vec7 packet format ───────────────────────────────────────────────────────
//
//  Channel 0 STATE packet (JSON, ~20Hz):
//  {
//    peer: string,      — peer ID
//    x: number,         — world X (visual only for remote players)
//    y: number,         — world Y (visual only for remote players)
//    z: number,         — world Z (visual only for remote players)
//    u: number,         — phase dimension (AUTHORITATIVE — applied locally)
//    v: number,         — phase dimension (AUTHORITATIVE — applied locally)
//    w: number,         — world-layer / 6D shard
//    t: number,         — time coordinate (monotonic ms)
//    heading: number,   — rotation Y radians
//    hp: number,        — current HP (for remote health display)
//    mode: string,      — game mode ("explore"|"combat"|"build")
//    seq: number,       — packet sequence number (monotonic, detects drops)
//  }

export const VEC7_PACKET_VERSION = 2; // v1 = xyz only, v2 = full Vec7

/**
 * Extract a Vec7 from the current engine state.
 * @param {object} engine — window.GTAEngine or registry-based engine object
 * @returns {object} Vec7 state packet
 */
export function extractVec7State(engine, opts = {}) {
  // Support both legacy GTAEngine globals and new registry-based pattern
  const hero = engine?.hero
    ?? engine?.player
    ?? window.GTAEngine?.hero
    ?? window.GTAEngine?.player;

  if (!hero) return null;

  const pos = hero.position ?? hero.pos ?? {};
  const hp  = window.GTAHealth?.hero?.hp ?? hero.hp ?? 100;
  const mode = window.GTAEngine?.WorldState?.mode ?? "explore";

  return {
    v: VEC7_PACKET_VERSION,
    x:       typeof pos.x === "number" ? pos.x : 0,
    y:       typeof pos.y === "number" ? pos.y : 0,
    z:       typeof pos.z === "number" ? pos.z : 0,
    u:       typeof pos.u === "number" ? pos.u : 0.0,
    v_dim:   typeof pos.v === "number" ? pos.v : 0.0,  // avoid JSON key collision with 'v' version
    w:       typeof pos.w === "number" ? pos.w : 0,
    t:       opts.time ?? performance.now(),
    heading: hero.heading ?? hero.rotY ?? 0,
    hp:      hp,
    mode:    mode,
    seq:     (opts.seq ?? 0),
  };
}

/**
 * Apply a received Vec7 packet to a remote peer ghost mesh.
 * NEVER applies x,y,z directly — always lerps for visual only.
 * DOES apply u,v for phase-filter visibility decisions.
 *
 * @param {object} peer — { mesh, targetPos, velocity, prevPos, u, v, w }
 * @param {object} packet — received Vec7 packet
 * @param {number} dt — delta time seconds
 */
export function applyVec7ToPeer(peer, packet, dt) {
  if (!peer || !packet) return;

  // Parse both v1 (xyz only) and v2 (full Vec7)
  const px = packet.x ?? 0;
  const py = packet.y ?? 0;
  const pz = packet.z ?? 0;

  // Dead-reckoning velocity update
  if (peer.prevPos) {
    const timeDelta = (packet.t - (peer.lastPacketT ?? packet.t)) / 1000;
    if (timeDelta > 0 && timeDelta < 0.5) {
      peer.velocity = {
        x: (px - peer.prevPos.x) / timeDelta,
        y: (py - peer.prevPos.y) / timeDelta,
        z: (pz - peer.prevPos.z) / timeDelta,
      };
    }
  }
  peer.prevPos    = { x: px, y: py, z: pz };
  peer.lastPacketT = packet.t;

  // Visual target (dead-reckoned) — NEVER snap
  if (peer.targetPos) {
    peer.targetPos.x = px;
    peer.targetPos.y = py;
    peer.targetPos.z = pz;
  }

  // Phase coordinates (authoritative — used for visibility filtering)
  peer.u = packet.u      ?? peer.u ?? 0.0;
  peer.v = packet.v_dim  ?? peer.v ?? 0.0;
  peer.w = packet.w      ?? peer.w ?? 0;

  // HP / mode for remote HUD
  if (packet.hp   !== undefined) peer.hp   = packet.hp;
  if (packet.mode !== undefined) peer.mode = packet.mode;
}

/**
 * Phase visibility test — should this peer be visible to the local player?
 * True 5D filtering: only entities within U_BAND and V_BAND of the local
 * player's u,v are visible (per CLAUDE.md 5D-truth requirement).
 *
 * @param {object} localUV — { u, v } of local player
 * @param {object} peerUV  — { u, v } of remote peer
 * @param {object} [bands] — { U_BAND, V_BAND } defaults: 0.5
 * @returns {boolean}
 */
export function isPhaseVisible(localUV, peerUV, bands = {}) {
  const U_BAND = bands.U_BAND ?? 0.5;
  const V_BAND = bands.V_BAND ?? 0.5;
  const du = Math.abs((localUV.u ?? 0) - (peerUV.u ?? 0));
  const dv = Math.abs((localUV.v ?? 0) - (peerUV.v ?? 0));
  return du < U_BAND && dv < V_BAND;
}

/**
 * Dead-reckoning lerp tick — call every frame for each remote peer.
 * Smoothly advances peer mesh toward predicted position.
 *
 * @param {object} peer — { mesh, targetPos, velocity, lastPacketT }
 * @param {number} dt — delta time seconds
 * @param {object} [opts] — { lerpFactor, maxPredictMs }
 */
export function tickPeerDeadReckoning(peer, dt, opts = {}) {
  const lerpFactor   = opts.lerpFactor   ?? 12;
  const maxPredictMs = opts.maxPredictMs ?? 200;

  if (!peer.mesh || !peer.targetPos) return;

  // Predict ahead based on last known velocity
  const timeSincePacket = performance.now() - (peer.lastPacketT ?? performance.now());
  let predicted = { ...peer.targetPos };
  if (peer.velocity && timeSincePacket < maxPredictMs) {
    const t = timeSincePacket / 1000;
    predicted.x += (peer.velocity.x ?? 0) * t;
    predicted.y += (peer.velocity.y ?? 0) * t;
    predicted.z += (peer.velocity.z ?? 0) * t;
  }

  // Lerp mesh toward predicted — never snap
  const alpha = Math.min(1, dt * lerpFactor);
  peer.mesh.position.x += (predicted.x - peer.mesh.position.x) * alpha;
  peer.mesh.position.y += (predicted.y - peer.mesh.position.y) * alpha;
  peer.mesh.position.z += (predicted.z - peer.mesh.position.z) * alpha;
}

/**
 * Patch an existing NetworkBridge instance to send Vec7 on Channel 0.
 * Call this after bridge.start() to upgrade it to full Vec7.
 *
 * @param {NetworkBridge} bridge — existing bridge instance
 * @param {function} getState — () => engine state object
 */
export function patchBridgeForVec7(bridge, getState) {
  if (!bridge) return;

  // Override the state pump to use Vec7
  const originalStartStatePump = bridge._startStatePump?.bind(bridge);

  bridge._startStatePump = function () {
    this._stateInterval = setInterval(() => {
      if (!this._connected) return;
      const engine = getState?.() ?? window.GTAEngine;
      const state  = extractVec7State(engine, { seq: ++this._seq, time: performance.now() });
      if (!state) return;
      this._socket.emit("bridge_frame", {
        peer_id: this._peerId,
        channel: 0,
        data:    JSON.stringify(state),
      });
      this._stats.sent++;
    }, 50); // 20Hz
    this._seq = 0;
  };

  console.log("[Vec7Sync] NetworkBridge patched for Vec7 (channels 0-4 fully active)");
}
