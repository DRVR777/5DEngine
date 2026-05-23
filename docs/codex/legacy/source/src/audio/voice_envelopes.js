// voice_envelopes.js — voice frame routing + spatial falloff + PTT + mute roster.
// Distinct from voice_chat.js (which is WebRTC signaling): this module
// handles per-frame distribution after a peer connection exists.
// Receives audio frames (caller supplies the actual codec/packets) as
// opaque blobs in a CWP v1.0-ish envelope and routes them per-listener:
//   - PTT: speaker must be in transmitting state (configurable)
//   - Spatial: each listener gets a per-frame volume in [0..1] based on
//     distance from speaker + falloff curve
//   - Channels: "global" / "team" / "proximity"
//   - Mute roster: per-listener mute list; muted speakers → vol=0
//
// Returns per-listener per-frame {volume, muted, payload, channel} so the
// caller-side mixer can mix the right streams at the right gains.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAVoiceEnvelopes = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CHANNELS = ["global", "team", "proximity"];

  function _dist(a, b) {
    const du = (a.u || 0) - (b.u || 0);
    const dv = (a.v || 0) - (b.v || 0);
    const dy = (a.y || 0) - (b.y || 0);
    return Math.sqrt(du * du + dv * dv + dy * dy);
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxRangeM: 30,
      falloffShape: "linear",     // "linear" | "inverse" | "exp"
      pttRequired: true,
      maxBufferedFrames: 100,
    }, opts.config || {});

    const speakers = new Map();
    const listeners = new Map();
    const frames = [];
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerListener(playerId, opts2) {
      opts2 = opts2 || {};
      listeners.set(playerId, {
        pos: opts2.pos || { u: 0, v: 0, y: 0 },
        team: opts2.team || null,
        mutes: new Set(opts2.mutes || []),
        channelsEnabled: new Set(opts2.channelsEnabled || CHANNELS),
      });
      _log("register_listener", { playerId });
      return { ok: true };
    }
    function unregisterListener(playerId) { listeners.delete(playerId); }

    function registerSpeaker(playerId, opts2) {
      opts2 = opts2 || {};
      speakers.set(playerId, {
        transmitting: !!opts2.transmitting,
        channel: opts2.channel || "proximity",
        team: opts2.team || null,
        pos: opts2.pos || { u: 0, v: 0, y: 0 },
      });
      _log("register_speaker", { playerId });
      return { ok: true };
    }
    function unregisterSpeaker(playerId) { speakers.delete(playerId); }

    function startTalking(playerId) {
      const s = speakers.get(playerId);
      if (!s) return { ok: false, reason: "no_speaker" };
      s.transmitting = true;
      _log("ptt_start", { playerId });
      return { ok: true };
    }
    function stopTalking(playerId) {
      const s = speakers.get(playerId);
      if (!s) return { ok: false };
      s.transmitting = false;
      _log("ptt_stop", { playerId });
      return { ok: true };
    }

    function setPosition(playerId, pos) {
      if (speakers.has(playerId)) speakers.get(playerId).pos = pos;
      if (listeners.has(playerId)) listeners.get(playerId).pos = pos;
    }

    function setChannel(playerId, channel) {
      if (!CHANNELS.includes(channel)) return { ok: false, reason: "bad_channel" };
      const s = speakers.get(playerId);
      if (!s) return { ok: false, reason: "no_speaker" };
      s.channel = channel;
      return { ok: true };
    }

    function mute(listenerId, speakerId) {
      const L = listeners.get(listenerId);
      if (!L) return { ok: false };
      L.mutes.add(speakerId);
      _log("mute", { listenerId, speakerId });
      return { ok: true };
    }
    function unmute(listenerId, speakerId) {
      const L = listeners.get(listenerId);
      if (!L) return { ok: false };
      L.mutes.delete(speakerId);
      return { ok: true };
    }
    function isMuted(listenerId, speakerId) {
      const L = listeners.get(listenerId);
      return L ? L.mutes.has(speakerId) : false;
    }

    function setChannelEnabled(listenerId, channel, enabled) {
      const L = listeners.get(listenerId);
      if (!L) return { ok: false };
      if (enabled) L.channelsEnabled.add(channel);
      else L.channelsEnabled.delete(channel);
      return { ok: true };
    }

    function _falloff(dist) {
      const r = Math.max(0, Math.min(1, dist / config.maxRangeM));
      if (config.falloffShape === "linear") return 1 - r;
      if (config.falloffShape === "inverse") return 1 / (1 + dist * 0.1);
      if (config.falloffShape === "exp") return Math.exp(-dist * 0.1);
      return 1 - r;
    }

    function pushFrame(frame) {
      if (!frame || !frame.speakerId) return { ok: false, reason: "missing_speaker" };
      const s = speakers.get(frame.speakerId);
      if (!s) return { ok: false, reason: "speaker_not_registered" };
      if (config.pttRequired && !s.transmitting) {
        _log("drop_ptt", { speakerId: frame.speakerId });
        return { ok: false, reason: "not_transmitting" };
      }
      const channel = s.channel;
      const distributed = [];
      for (const [lid, L] of listeners) {
        if (lid === frame.speakerId) continue;
        if (!L.channelsEnabled.has(channel)) continue;
        if (channel === "team" && s.team && L.team !== s.team) continue;
        let volume = 1;
        if (channel === "proximity") {
          const d = _dist(s.pos, L.pos);
          if (d > config.maxRangeM) continue;
          volume = _falloff(d);
        }
        const muted = L.mutes.has(frame.speakerId);
        if (muted) volume = 0;
        distributed.push({
          listenerId: lid,
          speakerId: frame.speakerId,
          channel,
          volume: Math.max(0, Math.min(1, volume)),
          muted,
          payload: frame.payload,
          ts: frame.ts != null ? frame.ts : Date.now(),
        });
      }
      const rec = {
        speakerId: frame.speakerId, channel,
        ts: frame.ts != null ? frame.ts : Date.now(),
        recipients: distributed.length,
      };
      frames.push(rec);
      while (frames.length > config.maxBufferedFrames) frames.shift();
      _log("frame", rec);
      return { ok: true, distributed };
    }

    function envelope(speakerId, payload, sessionId, vclock) {
      const s = speakers.get(speakerId);
      if (!s) throw new Error("speaker not registered");
      return {
        cwp: "1.0",
        type: "voice",
        session: sessionId,
        vclock: vclock || {},
        sig: null,
        payload: { speakerId, channel: s.channel, audio: payload },
      };
    }

    function listSpeakers() { return Array.from(speakers.keys()); }
    function listListeners() { return Array.from(listeners.keys()); }
    function recentFrames(n) { return frames.slice(-(n || 20)); }
    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      CHANNELS,
      registerListener, unregisterListener,
      registerSpeaker, unregisterSpeaker,
      startTalking, stopTalking,
      setPosition, setChannel,
      mute, unmute, isMuted, setChannelEnabled,
      pushFrame, envelope,
      listSpeakers, listListeners,
      recentFrames, recentEvents, getConfig,
    };
  }

  return { CHANNELS, createSystem };
});
