// stream_overlay.js — streaming overlay state machine.
// In-game HUD layer for players streaming gameplay: chat queue with
// fade-out, donation alerts with celebration windows, viewer counter
// with delta-rate, recent-followers ribbon, hype meter, cheer/emote
// pop animations.
//
// This is pure state + projections — the renderer reads activeChat(),
// pendingAlerts(), etc. each frame. Transport (twitch/youtube/etc.)
// is upstream; this just consumes normalized events.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAStreamOverlay = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const EVENT_KINDS = ["chat", "donation", "follow", "subscribe", "cheer", "raid", "viewer_update"];

  function createOverlay(opts) {
    opts = opts || {};
    const config = Object.assign({
      chatFadeMs: 8000,        // chat lingers 8s
      chatMaxVisible: 6,
      alertDurationMs: 6000,   // donations + raids stay 6s
      followRibbonCapacity: 20,
      hypeDecayPerSec: 1.0,
      hypeMax: 100,
      hypePerDollar: 5,
      hypePerSub: 10,
      hypePerFollow: 2,
      hypePerCheer: 0.5,        // per bit
    }, opts.config || {});

    const state = {
      viewers: 0,
      lastViewerUpdateTs: 0,
      hype: 0,
      totalDonations: 0,
      totalFollows: 0,
      totalSubs: 0,
      totalChats: 0,
    };

    const chat = [];            // {id, user, text, ts, color?, badges?}
    const alerts = [];          // {id, kind, ts, expiresAt, ...payload}
    const followsRibbon = [];   // {user, ts}
    const eventLog = [];
    let nextChatId = 1;
    let nextAlertId = 1;

    function _log(kind, detail) {
      eventLog.push({ kind, detail, ts: Date.now() });
      if (eventLog.length > 500) eventLog.shift();
    }

    function _push(ev) {
      if (!ev || !EVENT_KINDS.includes(ev.kind)) {
        return { ok: false, reason: "unknown_kind" };
      }
      const ts = ev.ts != null ? ev.ts : Date.now();
      switch (ev.kind) {
        case "chat": {
          if (!ev.user || !ev.text) return { ok: false, reason: "bad_chat" };
          const c = {
            id: "chat_" + nextChatId++,
            user: ev.user, text: ev.text, ts,
            color: ev.color || null,
            badges: ev.badges ? ev.badges.slice() : [],
          };
          chat.push(c);
          state.totalChats++;
          _log("chat", { user: c.user });
          return { ok: true, id: c.id, entry: c };
        }
        case "donation": {
          if (typeof ev.amount !== "number" || ev.amount <= 0) {
            return { ok: false, reason: "bad_amount" };
          }
          const a = {
            id: "alert_" + nextAlertId++,
            kind: "donation",
            user: ev.user || "anonymous",
            amount: ev.amount,
            currency: ev.currency || "USD",
            message: ev.message || "",
            ts, expiresAt: ts + config.alertDurationMs,
          };
          alerts.push(a);
          state.totalDonations += ev.amount;
          state.hype = Math.min(config.hypeMax, state.hype + ev.amount * config.hypePerDollar);
          _log("donation", { user: a.user, amount: a.amount });
          return { ok: true, id: a.id, alert: a };
        }
        case "follow": {
          if (!ev.user) return { ok: false, reason: "bad_user" };
          followsRibbon.push({ user: ev.user, ts });
          while (followsRibbon.length > config.followRibbonCapacity) followsRibbon.shift();
          state.totalFollows++;
          state.hype = Math.min(config.hypeMax, state.hype + config.hypePerFollow);
          _log("follow", { user: ev.user });
          return { ok: true };
        }
        case "subscribe": {
          if (!ev.user) return { ok: false, reason: "bad_user" };
          const a = {
            id: "alert_" + nextAlertId++,
            kind: "subscribe",
            user: ev.user,
            tier: ev.tier || 1,
            months: ev.months || 1,
            ts, expiresAt: ts + config.alertDurationMs,
          };
          alerts.push(a);
          state.totalSubs++;
          state.hype = Math.min(config.hypeMax, state.hype + config.hypePerSub * (ev.tier || 1));
          _log("subscribe", { user: ev.user, tier: a.tier });
          return { ok: true, id: a.id, alert: a };
        }
        case "cheer": {
          if (typeof ev.bits !== "number" || ev.bits <= 0) {
            return { ok: false, reason: "bad_bits" };
          }
          const a = {
            id: "alert_" + nextAlertId++,
            kind: "cheer",
            user: ev.user || "anonymous",
            bits: ev.bits,
            message: ev.message || "",
            ts, expiresAt: ts + config.alertDurationMs,
          };
          alerts.push(a);
          state.hype = Math.min(config.hypeMax, state.hype + ev.bits * config.hypePerCheer);
          _log("cheer", { user: a.user, bits: a.bits });
          return { ok: true, id: a.id, alert: a };
        }
        case "raid": {
          if (!ev.user || typeof ev.raiderCount !== "number") {
            return { ok: false, reason: "bad_raid" };
          }
          const a = {
            id: "alert_" + nextAlertId++,
            kind: "raid",
            user: ev.user, raiderCount: ev.raiderCount,
            ts, expiresAt: ts + config.alertDurationMs * 2,    // raids stick around
          };
          alerts.push(a);
          state.hype = Math.min(config.hypeMax, state.hype + Math.log2(ev.raiderCount + 1) * 5);
          _log("raid", { user: a.user, count: a.raiderCount });
          return { ok: true, id: a.id, alert: a };
        }
        case "viewer_update": {
          if (typeof ev.count !== "number" || ev.count < 0) {
            return { ok: false, reason: "bad_count" };
          }
          state.viewers = ev.count;
          state.lastViewerUpdateTs = ts;
          _log("viewer_update", { count: ev.count });
          return { ok: true };
        }
      }
      return { ok: false, reason: "unhandled" };
    }

    // Bulk
    function push(ev) { return _push(ev); }
    function pushAll(evs) { return (evs || []).map(_push); }

    // Tick: trim expired entries, decay hype.
    function tick(dt, now) {
      now = now != null ? now : Date.now();
      // Chat fade
      for (let i = chat.length - 1; i >= 0; i--) {
        if (now - chat[i].ts > config.chatFadeMs) chat.splice(i, 1);
      }
      // Alerts expire
      for (let i = alerts.length - 1; i >= 0; i--) {
        if (now >= alerts[i].expiresAt) alerts.splice(i, 1);
      }
      // Hype decay
      state.hype = Math.max(0, state.hype - config.hypeDecayPerSec * dt);
      return state.hype;
    }

    // Projections for renderers
    function activeChat(now) {
      now = now != null ? now : Date.now();
      const live = chat.filter(c => now - c.ts <= config.chatFadeMs);
      return live.slice(-config.chatMaxVisible);
    }

    function pendingAlerts(now) {
      now = now != null ? now : Date.now();
      return alerts.filter(a => now < a.expiresAt).sort((a, b) => a.ts - b.ts);
    }

    function recentFollows(n) { return followsRibbon.slice(-(n || 10)); }

    function topDonation() {
      let best = null;
      for (const a of alerts) {
        if (a.kind !== "donation") continue;
        if (!best || a.amount > best.amount) best = a;
      }
      return best;
    }

    function getState() { return Object.assign({}, state); }
    function getConfig() { return Object.assign({}, config); }

    function clearChat() { chat.length = 0; }
    function clearAlerts() { alerts.length = 0; }
    function reset() {
      chat.length = 0; alerts.length = 0; followsRibbon.length = 0;
      state.viewers = 0; state.hype = 0; state.totalChats = 0;
      state.totalDonations = 0; state.totalFollows = 0; state.totalSubs = 0;
      state.lastViewerUpdateTs = 0;
    }

    function recentEvents(n) { return eventLog.slice(-(n || 50)); }

    return {
      EVENT_KINDS,
      push, pushAll, tick,
      activeChat, pendingAlerts, recentFollows, topDonation,
      getState, getConfig,
      clearChat, clearAlerts, reset,
      recentEvents,
    };
  }

  return {
    EVENT_KINDS,
    createOverlay,
  };
});
