// voice_chat.js — WebRTC signaling over CWP (transport-agnostic stub).
//
// State machine per peer:
//   idle → offer_sent → answer_received → ice_exchange → connected → closed
// Real WebRTC (RTCPeerConnection) lives in the browser. This module owns the
// signaling envelopes that travel over the existing Net hub.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAVoiceChat = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STATES = ["idle", "offer_sent", "offer_received", "answer_received",
                  "ice_exchange", "connected", "closed", "failed"];

  function createSession(opts) {
    opts = opts || {};
    const myPeerId = opts.peerId || "local";
    const peers = new Map();         // peerId → { state, sdp, ice:[], muted, lastEvent }
    const listeners = { state: [], track: [], data: [] };
    const sender = opts.sender || function () {};   // (envelope) → void
    const adapter = opts.adapter || null;           // optional WebRTC backend hook
    let muted = false;

    function emit(event, payload) {
      const fns = listeners[event] || [];
      for (const fn of fns) try { fn(payload); } catch (e) {}
    }
    function on(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    }

    function _envelope(type, peerId, payload) {
      return {
        cwp: "1.0",
        type: "voice." + type,
        session: opts.sessionId || "voice",
        from: myPeerId,
        to: peerId,
        payload: payload || {},
      };
    }
    function _setState(peerId, state) {
      const peer = peers.get(peerId);
      if (!peer) return;
      const prev = peer.state;
      peer.state = state;
      emit("state", { peerId, prev, state });
    }

    // Public API
    function call(peerId, opts2) {
      opts2 = opts2 || {};
      if (peers.has(peerId)) return { ok: false, reason: "already_calling" };
      peers.set(peerId, {
        state: "idle", sdp: null, ice: [], muted: false,
        startedAt: Date.now(), bandwidthKbps: opts2.bandwidthKbps || 64,
      });
      // SDP offer would come from real WebRTC; stub uses a fake.
      const fakeOffer = adapter && adapter.createOffer
        ? adapter.createOffer(peerId)
        : { type: "offer", sdp: `v=0\no=- ${Date.now()} 1 IN IP4 0.0.0.0\ns=stub` };
      peers.get(peerId).sdp = fakeOffer;
      _setState(peerId, "offer_sent");
      sender(_envelope("offer", peerId, { sdp: fakeOffer }));
      return { ok: true, peerId };
    }

    function receiveOffer(fromPeer, sdp) {
      if (!peers.has(fromPeer)) {
        peers.set(fromPeer, { state: "idle", sdp: null, ice: [], muted: false, startedAt: Date.now() });
      }
      peers.get(fromPeer).sdp = sdp;
      _setState(fromPeer, "offer_received");
      // Auto-answer (real impl: prompt user)
      const fakeAnswer = adapter && adapter.createAnswer
        ? adapter.createAnswer(fromPeer, sdp)
        : { type: "answer", sdp: `v=0\no=- ${Date.now()} 1 IN IP4 0.0.0.0\ns=stub-ans` };
      sender(_envelope("answer", fromPeer, { sdp: fakeAnswer }));
      _setState(fromPeer, "ice_exchange");
      return { ok: true };
    }

    function receiveAnswer(fromPeer, sdp) {
      const peer = peers.get(fromPeer);
      if (!peer) return { ok: false, reason: "no_peer" };
      if (peer.state !== "offer_sent") return { ok: false, reason: `bad_state:${peer.state}` };
      peer.sdp = sdp;
      _setState(fromPeer, "answer_received");
      _setState(fromPeer, "ice_exchange");
      return { ok: true };
    }

    function addIceCandidate(fromPeer, candidate) {
      const peer = peers.get(fromPeer);
      if (!peer) return { ok: false, reason: "no_peer" };
      peer.ice.push(candidate);
      // After enough ICE candidates exchanged, mark connected (stub heuristic)
      if (peer.ice.length >= 1 && peer.state === "ice_exchange") {
        _setState(fromPeer, "connected");
      }
      return { ok: true };
    }

    function sendIceCandidate(toPeer, candidate) {
      const peer = peers.get(toPeer);
      if (!peer) return { ok: false, reason: "no_peer" };
      sender(_envelope("ice", toPeer, { candidate }));
      return { ok: true };
    }

    function hangup(peerId) {
      const peer = peers.get(peerId);
      if (!peer) return false;
      sender(_envelope("hangup", peerId, {}));
      _setState(peerId, "closed");
      peers.delete(peerId);
      return true;
    }

    function setMute(value) {
      muted = !!value;
      // Notify all active peers
      for (const [pid, peer] of peers) {
        if (peer.state === "connected") sender(_envelope("mute", pid, { muted }));
      }
      return muted;
    }

    function isMuted() { return muted; }

    function getPeerState(peerId) {
      const p = peers.get(peerId);
      return p ? p.state : null;
    }

    function activePeers() {
      return Array.from(peers.entries()).map(([id, p]) => ({
        peerId: id, state: p.state, since: p.startedAt,
      }));
    }

    // Drive: process an incoming voice.* envelope (called by transport layer)
    function handleEnvelope(env) {
      if (!env || !env.type || !env.type.startsWith("voice.")) return false;
      const sub = env.type.slice("voice.".length);
      const from = env.from;
      if (!from) return false;
      switch (sub) {
        case "offer":   return !!receiveOffer(from, env.payload && env.payload.sdp);
        case "answer":  return !!receiveAnswer(from, env.payload && env.payload.sdp).ok;
        case "ice":     return !!addIceCandidate(from, env.payload && env.payload.candidate).ok;
        case "hangup":
          if (peers.has(from)) { _setState(from, "closed"); peers.delete(from); }
          return true;
        case "mute":
          // Track that the remote peer muted (no local action)
          return true;
        default: return false;
      }
    }

    return {
      STATES, peers, sender,
      call, receiveOffer, receiveAnswer, addIceCandidate, sendIceCandidate,
      hangup, setMute, isMuted, getPeerState, activePeers,
      handleEnvelope, on,
    };
  }

  return { createSession, STATES };
});
