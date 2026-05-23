// emotes.js — player gestures + emoji broadcasts.
// Emotes are timed animations + optional sound + optional speech bubble.
// Triggered by player action (slash command / hotkey), visible to nearby
// players via Hub broadcast.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAEmotes = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Built-in emote palette
  const PALETTE = {
    wave:        { animation: "wave",     duration: 1.5, kind: "gesture" },
    dance:       { animation: "dance",    duration: 6.0, kind: "gesture", loops: true },
    sit:         { animation: "sit",      duration: -1,  kind: "stance",  loops: true },
    salute:      { animation: "salute",   duration: 1.2, kind: "gesture" },
    bow:         { animation: "bow",      duration: 1.5, kind: "gesture" },
    laugh:       { animation: "laugh",    duration: 2.0, kind: "expression" },
    cry:         { animation: "cry",      duration: 3.0, kind: "expression" },
    point:       { animation: "point",    duration: 1.0, kind: "gesture" },
    thumbs_up:   { animation: "thumbs_up",duration: 1.5, kind: "gesture", emoji: "👍" },
    facepalm:    { animation: "facepalm", duration: 2.0, kind: "expression", emoji: "🤦" },
    clap:        { animation: "clap",     duration: 2.5, kind: "gesture", emoji: "👏" },
    flex:        { animation: "flex",     duration: 2.5, kind: "stance" },
  };

  const EMOJI_LIBRARY = {
    "smile": "😀", "laugh": "😂", "wink": "😉", "sad": "😢",
    "love": "❤️", "fire": "🔥", "thumbs_up": "👍", "thumbs_down": "👎",
    "clap": "👏", "wave": "👋", "ok": "👌", "muscle": "💪",
    "skull": "💀", "eyes": "👀", "facepalm": "🤦", "shrug": "🤷",
    "100": "💯", "boom": "💥", "fist": "✊", "peace": "✌",
  };

  function listEmotes() { return Object.keys(PALETTE); }
  function getEmote(name) { return PALETTE[name] || null; }
  function listEmojis() { return Object.keys(EMOJI_LIBRARY); }
  function getEmoji(name) { return EMOJI_LIBRARY[name] || null; }

  function registerEmote(name, def) {
    if (PALETTE[name]) throw new Error(`emote ${name} exists`);
    PALETTE[name] = Object.assign({ duration: 2.0, kind: "gesture" }, def);
  }
  function registerEmoji(name, glyph) {
    if (EMOJI_LIBRARY[name]) throw new Error(`emoji ${name} exists`);
    EMOJI_LIBRARY[name] = glyph;
  }

  function createEmoteSystem(opts) {
    opts = opts || {};
    const sender = opts.sender || function () {};
    const active = new Map();         // playerId → {emote, startedAt, expiresAt}
    const recent = [];                // last 50 broadcasts

    // Trigger an emote: broadcasts + tracks active state.
    function trigger(playerId, emoteName, opts2) {
      opts2 = opts2 || {};
      const def = PALETTE[emoteName];
      if (!def) return { ok: false, reason: "no_such_emote" };
      const startedAt = opts2.ts != null ? opts2.ts : Date.now();
      const expiresAt = def.duration < 0 ? Infinity : startedAt + def.duration * 1000;
      // Cancel any running emote
      const prev = active.get(playerId);
      if (prev) sender({ cwp: "1.0", type: "emote.cancel", payload: { playerId } });
      active.set(playerId, { emote: emoteName, def, startedAt, expiresAt });
      const env = {
        cwp: "1.0", type: "emote.trigger",
        payload: { playerId, emote: emoteName, duration: def.duration, kind: def.kind, ts: startedAt },
      };
      sender(env);
      recent.push(env);
      if (recent.length > 50) recent.shift();
      return { ok: true, expiresAt };
    }

    function cancel(playerId) {
      if (!active.has(playerId)) return false;
      active.delete(playerId);
      sender({ cwp: "1.0", type: "emote.cancel", payload: { playerId } });
      return true;
    }

    // Tick: expires emotes whose duration has elapsed (skips loops + stances).
    function tick(nowMs) {
      const now = nowMs != null ? nowMs : Date.now();
      const expired = [];
      for (const [pid, state] of active) {
        if (state.def.loops || state.def.duration < 0) continue;
        if (now >= state.expiresAt) { expired.push(pid); active.delete(pid); }
      }
      for (const pid of expired) {
        sender({ cwp: "1.0", type: "emote.expired", payload: { playerId: pid } });
      }
      return expired;
    }

    // Send a chat-style emoji message (separate channel from regular chat).
    function sendEmoji(playerId, emojiName, opts2) {
      opts2 = opts2 || {};
      const glyph = EMOJI_LIBRARY[emojiName];
      if (!glyph) return { ok: false, reason: "no_such_emoji" };
      const env = {
        cwp: "1.0", type: "emote.emoji",
        payload: { playerId, emoji: emojiName, glyph, ts: opts2.ts || Date.now() },
      };
      sender(env);
      recent.push(env);
      if (recent.length > 50) recent.shift();
      return { ok: true, glyph };
    }

    function isEmoting(playerId) { return active.has(playerId); }
    function getActive(playerId) { return active.get(playerId) || null; }
    function listActive() { return Array.from(active.entries()).map(([id, s]) => ({ id, emote: s.emote, expiresAt: s.expiresAt })); }
    function recentBroadcasts(n) { return recent.slice(-(n || 20)); }

    return {
      trigger, cancel, tick, sendEmoji,
      isEmoting, getActive, listActive, recentBroadcasts,
    };
  }

  return {
    PALETTE, EMOJI_LIBRARY,
    listEmotes, getEmote, listEmojis, getEmoji,
    registerEmote, registerEmoji,
    createEmoteSystem,
  };
});
