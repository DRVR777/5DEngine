// stats.js — player career stat aggregator.
// Subscribes to game events and rolls them up into per-player career
// stats: kills, deaths, distance, missions_completed, missions_failed,
// playtime_ms, currency_earned/spent, photos_taken, etc.
//
// Tracks lifetime totals AND per-day rollups (last 30 days). Per-day
// rollups roll into lifetime when they age out, so memory stays bounded.
//
// Events are pushed via record(playerId, kind, payload). The system
// is registry-only: register a new stat kind via registerKind(name,
// {reducer, default}).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAStats = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Built-in stat reducers. Each accepts (currentValue, payload) → newValue.
  function _inc(cur, p) { return cur + (p && typeof p.delta === "number" ? p.delta : 1); }
  function _max(cur, p) { const v = p && typeof p.value === "number" ? p.value : 0; return v > cur ? v : cur; }
  function _setIfGreater(cur, p) { return _max(cur, p); }
  function _sumValue(cur, p) { return cur + (p && typeof p.value === "number" ? p.value : 0); }

  const DEFAULT_KINDS = {
    kill:              { reducer: _inc,         default: 0 },
    death:             { reducer: _inc,         default: 0 },
    distance_m:        { reducer: _sumValue,    default: 0 },
    mission_complete:  { reducer: _inc,         default: 0 },
    mission_fail:      { reducer: _inc,         default: 0 },
    playtime_ms:       { reducer: _sumValue,    default: 0 },
    currency_earned:   { reducer: _sumValue,    default: 0 },
    currency_spent:    { reducer: _sumValue,    default: 0 },
    photo_taken:       { reducer: _inc,         default: 0 },
    headshot:          { reducer: _inc,         default: 0 },
    vehicles_destroyed:{ reducer: _inc,         default: 0 },
    best_combo:        { reducer: _setIfGreater,default: 0 },
    longest_run_m:     { reducer: _setIfGreater,default: 0 },
  };

  function utcDayKey(ts) {
    const d = new Date(ts);
    const y = d.getUTCFullYear();
    const m = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const day = d.getUTCDate().toString().padStart(2, "0");
    return Number(y + m + day);
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      rolloverAfterDays: 30,
    }, opts.config || {});

    const kinds = Object.assign({}, DEFAULT_KINDS);
    if (opts.extraKinds) Object.assign(kinds, opts.extraKinds);

    // playerId → { lifetime: {kind→val}, days: Map<dayKey, {kind→val}> }
    const players = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _initPlayer(playerId) {
      if (players.has(playerId)) return players.get(playerId);
      const lifetime = {};
      for (const [k, def] of Object.entries(kinds)) lifetime[k] = def.default;
      const player = { id: playerId, lifetime, days: new Map(), firstSeenTs: Date.now() };
      players.set(playerId, player);
      return player;
    }

    function _initDay(player, dayKey) {
      if (player.days.has(dayKey)) return player.days.get(dayKey);
      const d = {};
      for (const [k, def] of Object.entries(kinds)) d[k] = def.default;
      player.days.set(dayKey, d);
      return d;
    }

    function registerKind(name, def) {
      if (typeof name !== "string" || !name) return { ok: false, reason: "bad_name" };
      if (kinds[name]) return { ok: false, reason: "duplicate" };
      if (!def || typeof def.reducer !== "function") return { ok: false, reason: "bad_def" };
      kinds[name] = { reducer: def.reducer, default: def.default != null ? def.default : 0 };
      for (const p of players.values()) {
        if (p.lifetime[name] == null) p.lifetime[name] = kinds[name].default;
        for (const day of p.days.values()) if (day[name] == null) day[name] = kinds[name].default;
      }
      _log("register_kind", { name });
      return { ok: true };
    }

    function record(playerId, kind, payload, opts2) {
      opts2 = opts2 || {};
      if (!playerId) return { ok: false, reason: "missing_player" };
      const def = kinds[kind];
      if (!def) return { ok: false, reason: "unknown_kind" };
      const player = _initPlayer(playerId);
      const ts = opts2.ts != null ? opts2.ts : Date.now();
      const dayKey = utcDayKey(ts);
      const day = _initDay(player, dayKey);
      day[kind] = def.reducer(day[kind], payload || {});
      player.lifetime[kind] = def.reducer(player.lifetime[kind], payload || {});
      _maybeRollover(player, ts);
      return { ok: true, lifetime: player.lifetime[kind], today: day[kind] };
    }

    function _maybeRollover(player, nowTs) {
      const today = utcDayKey(nowTs);
      const cutoff = today - config.rolloverAfterDays;
      for (const dayKey of Array.from(player.days.keys())) {
        if (dayKey < cutoff) player.days.delete(dayKey);
      }
    }

    function lifetime(playerId, kind) {
      const p = players.get(playerId);
      if (!p) return null;
      return kind ? (p.lifetime[kind] != null ? p.lifetime[kind] : 0) : p.lifetime;
    }

    function dayStats(playerId, dayKey) {
      const p = players.get(playerId);
      if (!p) return null;
      return p.days.get(dayKey) || null;
    }

    function recentDays(playerId, nDays) {
      const p = players.get(playerId);
      if (!p) return [];
      const todayKey = utcDayKey(Date.now());
      const cutoff = todayKey - (nDays != null ? nDays : 7);
      return Array.from(p.days.entries())
        .filter(([k]) => k >= cutoff)
        .sort((a, b) => a[0] - b[0])
        .map(([k, v]) => Object.assign({ day: k }, v));
    }

    function reset(playerId, kind) {
      const p = players.get(playerId);
      if (!p) return { ok: false };
      if (kind) {
        p.lifetime[kind] = kinds[kind] ? kinds[kind].default : 0;
        for (const day of p.days.values()) day[kind] = kinds[kind] ? kinds[kind].default : 0;
      } else {
        for (const k of Object.keys(kinds)) {
          p.lifetime[k] = kinds[k].default;
        }
        p.days.clear();
      }
      _log("reset", { playerId, kind: kind || "ALL" });
      return { ok: true };
    }

    // Aggregations across players (leaderboards-style)
    function topByKind(kind, opts2) {
      opts2 = opts2 || {};
      const window = opts2.window || "lifetime";    // "lifetime" | "today"
      const limit = opts2.limit || 10;
      const todayKey = utcDayKey(Date.now());
      const entries = [];
      for (const p of players.values()) {
        let val;
        if (window === "lifetime") val = p.lifetime[kind] || 0;
        else if (window === "today") val = (p.days.get(todayKey) || {})[kind] || 0;
        else continue;
        entries.push({ playerId: p.id, value: val });
      }
      entries.sort((a, b) => b.value - a.value);
      return entries.slice(0, limit);
    }

    function listPlayers() { return Array.from(players.keys()); }
    function listKinds() { return Object.keys(kinds); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    function toJSON() {
      const out = { config, players: {} };
      for (const [id, p] of players) {
        out.players[id] = {
          lifetime: Object.assign({}, p.lifetime),
          days: Object.fromEntries(p.days),
          firstSeenTs: p.firstSeenTs,
        };
      }
      return out;
    }
    function fromJSON(obj) {
      if (!obj || !obj.players) return { ok: false };
      players.clear();
      for (const [id, ps] of Object.entries(obj.players)) {
        const player = { id, lifetime: ps.lifetime, days: new Map(), firstSeenTs: ps.firstSeenTs };
        for (const [k, v] of Object.entries(ps.days || {})) player.days.set(Number(k), v);
        players.set(id, player);
      }
      return { ok: true };
    }

    return {
      utcDayKey,
      registerKind, record,
      lifetime, dayStats, recentDays,
      reset, topByKind,
      listPlayers, listKinds, recentEvents,
      toJSON, fromJSON,
    };
  }

  return {
    DEFAULT_KINDS,
    utcDayKey,
    createSystem,
  };
});
