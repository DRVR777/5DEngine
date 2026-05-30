/**
 * net-sync — session-level facet bridging ThingRegistry ↔ worldWideComms
 *
 * Authority model (split-authority P2P):
 *   CH0 STATE   20Hz     owner-auth   position, rotation, hp (sent by owner)
 *   CH1 EVENTS  instant  signer-auth  kills, damage — Ed25519 signed
 *   CH2 WORLD   on-chg   host-auth    wave state, world mutations
 *   CH4 AGENT   demand   encrypted    AI agent cross-node packets (Double Ratchet)
 *
 * Wire format CH0:
 *   { id, seq, t, pos: {x,z}, rot, hp, w }
 *
 * Facet data:
 *   peerId    string   — this node's dworld:// identity (hex)
 *   sessionId string   — room / session code
 *   isHost    bool     — host peer controls wave authority
 *   peerCount number   — connected peers (including self)
 *   latency   object   — peerId → RTT ms map
 *
 * Usage:
 *   Spawn a Thinga of kind "session" with this facet.
 *   Boot sets peerId from localStorage before spawning.
 */

export default {
  priority: 92,

  init(thing, data, registry) {
    data._peers    = {};       // peerId → remotePlayerThingId
    data._seqOut   = 0;
    data._lastOut  = {};
    data.peerCount = 1;
    data.latency   = {};
    data.isHost    = false;

    const sock = window._socket;
    if (!sock) {
      console.info("[net-sync] no socket — offline/solo mode");
      return;
    }

    // ── Inbound frame routing ───────────────────────────────────────────────
    sock.on("bridge_frame", (frame) => {
      let msg;
      try { msg = JSON.parse(frame.data); } catch { return; }
      const ch = frame.channel;
      if (ch === 0) this._onState(msg, data, registry);
      if (ch === 1) this._onEvent(msg, data, registry);
      if (ch === 2) this._onWorld(msg, data, registry);
    });

    // ── Peer lifecycle ──────────────────────────────────────────────────────
    sock.on("peer_joined",  ({ peerId }) => this._peerJoin(peerId,  data, registry));
    sock.on("peer_left",    ({ peerId }) => this._peerLeave(peerId, data, registry));
    sock.on("session_state", (s) => {
      data.isHost    = !!s.isHost;
      data.peerCount = s.peerCount || 1;
      data.sessionId = s.sessionId;
      registry._emit?.({ type: "session_state", ...s });
    });

    console.info("[net-sync] init — peerId:", data.peerId?.slice(0, 8));
  },

  tick(thing, data, _dt, registry) {
    const hero = registry.byKind("hero")[0];
    if (!hero || !window._socket?.connected) return;
    if (data.mode === "solo") return;  // solo mode: never send, zero cost

    // Use position5d (authoritative 5D coord) when available, fall back to position
    // Anti-cheat rule (ARCHITECT): only u,v,heading are networked — never x,y,z (Three.js coords)
    // Three.js coords are derived locally from u,v by register_bridge / position5d facet
    const pos5d = registry.facetData(hero.id, "position5d");
    const pos   = pos5d || registry.facetData(hero.id, "position");
    const hd  = registry.facetData(hero.id, "health-display");
    const wa  = registry.facetData(hero.id, "weapon-ammo");
    if (!pos || !hd || !wa) return;

    // Send authoritative u,v (world coords), NOT Three.js x,z (derived render coords)
    const u = pos5d ? pos5d.u : pos.x;
    const v = pos5d ? pos5d.v : pos.z;
    const heading = pos5d ? (pos5d.heading ?? 0) : (pos.rotY ?? 0);

    // Build snapshot — truncate to 1 decimal for bandwidth
    const snap = {
      id:  data.peerId,
      seq: ++data._seqOut,
      t:   Date.now(),
      pos: { u: Math.round(u * 10) / 10, v: Math.round(v * 10) / 10 },
      rot: Math.round(heading * 100) / 100,
      hp:  hd.hp | 0,
      w:   wa.weapon ?? "pistol",
    };

    // Delta: skip if nothing changed
    const l = data._lastOut;
    if (snap.pos.u === l.pos?.u &&
        snap.pos.v === l.pos?.v &&
        snap.hp    === l.hp    &&
        snap.w     === l.w     &&
        snap.rot   === l.rot) return;

    data._lastOut = snap;
    window._socket.emit("bridge_frame", {
      channel: 0,
      session: data.sessionId,
      data: JSON.stringify(snap),
    });
  },

  // ── Public API ─────────────────────────────────────────────────────────────
  /** Call when hero gets a kill. Sends signed CH1 EVENT to all peers. */
  sendKillEvent(data, victimPeerId, weapon, pos) {
    const ev = {
      type:    "kill",
      by:      data.peerId,
      to:      victimPeerId,
      w:       weapon,
      pos,
      t:       Date.now(),
      session: data.sessionId,
      // TODO: sig: Ed25519(privKey, hash(type+by+to+w+t))
    };
    window._socket?.emit("bridge_frame", { channel: 1, data: JSON.stringify(ev) });
  },

  /** Call when hero broadcasts a world mutation (host only or use consensus). */
  sendWorldMutation(data, op, payload) {
    window._socket?.emit("bridge_frame", {
      channel: 2,
      data: JSON.stringify({ op, ...payload, by: data.peerId, t: Date.now() }),
    });
  },

  // ── Private frame handlers ─────────────────────────────────────────────────
  _onState(msg, data, registry) {
    const { id, pos, rot, hp, w, t } = msg;
    if (!id || id === data.peerId || !pos) return;
    // Handle both old {x,z} format and new {u,v} 5D format
    const u = pos.u ?? pos.x ?? 0;
    const v = pos.v ?? pos.z ?? 0;

    const tid = data._peers[id];
    if (!tid) {
      // First packet from this peer — spawn their Thinga
      this._peerJoin(id, data, registry, { pos, hp, w });
      return;
    }
    // Update existing remote player
    // Anti-cheat: write to position5d (u,v only — Three.js x/z derived locally)
    // Trust level derived from session time + reputation (ARCHITECT design)
    const trust = Math.min(1.0, (Date.now() - (data._peerJoinTime?.[id] ?? Date.now())) / 60000);
    registry.updateFacet(tid, "position5d", {
      u: pos.u, v: pos.v, heading: rot ?? 0,
      _r_interp_target_u: pos.u, _r_interp_target_v: pos.v,
      _r_is_remote: true,
      _r_trust: trust,
    });
    registry.updateFacet(tid, "health-display", { hp: hp ?? 100, armor: 0 });
    const rp = registry.facetData(tid, "remote-player");
    if (rp) { rp.lastSeen = t ?? Date.now(); rp.latency = Date.now() - (t ?? Date.now()); }
  },

  _onEvent(msg, data, registry) {
    if (msg.type === "kill") {
      // TODO: verify Ed25519 signature
      const victimTid = data._peers[msg.to];
      if (victimTid) {
        registry.updateFacet(victimTid, "health-display", { hp: 0, armor: 0 });
      }
      // If WE were killed:
      if (msg.to === data.peerId) {
        const hero = registry.byKind("hero")[0];
        if (hero) registry.updateFacet(hero.id, "health-display", { hp: 0, armor: 0 });
      }
    }
  },

  _onWorld(msg, data, registry) {
    // Only accept host-authored world mutations
    if (data.isHost && msg.by === data.peerId) return; // own echo
    if (msg.op === "wave_start") {
      const ws = registry.byKind("wave-spawner")[0];
      if (ws) {
        const wsd = registry.facetData(ws.id, "wave-spawner");
        if (wsd) { wsd.wave = msg.wave; wsd.active = true; }
      }
    }
  },

  _peerJoin(peerId, data, registry, initialState = {}) {
    const tid = `remote-player/${peerId}`;
    if (registry.rows?.has(tid)) return;
    // Track join time for trust level calculation (ARCHITECT design)
    if (!data._peerJoinTime) data._peerJoinTime = {};
    data._peerJoinTime[peerId] = Date.now();
    const initPos = initialState.pos ?? {};
    const initU = initPos.u ?? initPos.x ?? 0;
    const initV = initPos.v ?? initPos.z ?? 0;
    try {
      registry.spawn({
        id:   tid,
        kind: "remote-player",
        name: `Player ${peerId.slice(0, 8)}`,
        facets: [
          // position5d: authoritative world coords (u,v) — Three.js x/z derived locally
          { name: "position5d",         data: { u: initU, v: initV, y: 0, heading: 0,
                                                _r_interp_target_u: initU, _r_interp_target_v: initV,
                                                _r_is_remote: true, _r_trust: 0 } },
          { name: "health-display",     data: { hp: initialState.hp ?? 100, armor: 0 } },
          { name: "weapon-ammo",        data: { weapon: initialState.w ?? "pistol", ammo: 30 } },
          { name: "remote-player",      data: { peerId, lastSeen: Date.now(), latency: 0 } },
          { name: "remote-player-mesh", data: {} },
        ],
      });
      data._peers[peerId] = tid;
      data.peerCount = Object.keys(data._peers).length + 1;
      console.info("[net-sync] peer joined:", peerId.slice(0, 8));
    } catch (e) {
      console.warn("[net-sync] spawn remote-player failed:", e.message);
    }
  },

  _peerLeave(peerId, data, registry) {
    const tid = data._peers[peerId];
    if (!tid) return;
    try { registry.despawn(tid, "peer_left"); } catch {}
    delete data._peers[peerId];
    data.peerCount = Math.max(1, Object.keys(data._peers).length + 1);
    console.info("[net-sync] peer left:", peerId.slice(0, 8));
  },
};
