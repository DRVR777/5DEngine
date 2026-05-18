// leaderboard.js — per-stat leaderboards with Hub broadcast (distributed/network).
// DISAMBIGUATION: this file is GTALeaderboard — a NETWORK-SYNCHRONIZED per-stat board.
// For the OFFLINE per-mission high-score store, see leaderboards.js (GTALeaderboards).
// Rule: do NOT merge these. leaderboard.js = live networked; leaderboards.js = local history.
// Maintains local entries, broadcasts updates over the Net hub so every
// node converges. Subscribers can query top-N for any stat.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTALeaderboard = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createLeaderboard(opts) {
    opts = opts || {};
    // boards[statName] = Map<playerId, {score, ts, source}>
    const boards = new Map();
    const sender = opts.sender || function () {};
    const myNodeId = opts.nodeId || "local";
    const minTs = new Map();   // playerId+stat → highest ts (causal de-dup)

    function _ensure(stat) {
      if (!boards.has(stat)) boards.set(stat, new Map());
      return boards.get(stat);
    }
    function _key(playerId, stat) { return `${playerId}::${stat}`; }

    // Submit a score locally + broadcast it.
    function submit(stat, playerId, score, opts2) {
      opts2 = opts2 || {};
      const ts = opts2.ts != null ? opts2.ts : Date.now();
      const board = _ensure(stat);
      const cur = board.get(playerId);
      // Higher-is-better unless opts.lowerIsBetter
      const better = cur == null
        ? true
        : (opts2.lowerIsBetter ? score < cur.score : score > cur.score);
      if (!better) return { ok: false, reason: "not_an_improvement", current: cur && cur.score };
      board.set(playerId, { score, ts, source: opts2.source || myNodeId });
      minTs.set(_key(playerId, stat), ts);
      // Broadcast
      sender({
        cwp: "1.0", type: "leaderboard.update",
        payload: { stat, playerId, score, ts, source: opts2.source || myNodeId },
      });
      return { ok: true };
    }

    // Receive a remote update; respect causal ts de-dup (don't accept stale).
    function ingest(envelope) {
      if (!envelope || envelope.type !== "leaderboard.update") return false;
      const p = envelope.payload || {};
      if (!p.stat || !p.playerId || typeof p.score !== "number" || typeof p.ts !== "number") {
        return false;
      }
      const k = _key(p.playerId, p.stat);
      const lastTs = minTs.get(k) || 0;
      if (p.ts <= lastTs) return false;     // stale
      const board = _ensure(p.stat);
      const cur = board.get(p.playerId);
      // Always trust the latest-ts update for this player+stat (no merge logic
      // beyond ts ordering; per-source semantics are caller's responsibility)
      board.set(p.playerId, { score: p.score, ts: p.ts, source: p.source });
      minTs.set(k, p.ts);
      return true;
    }

    // Top N rows for a stat. Returns [{playerId, score, ts}].
    function top(stat, n, lowerIsBetter) {
      n = n || 10;
      const board = boards.get(stat);
      if (!board) return [];
      const rows = Array.from(board.entries()).map(([pid, e]) => ({
        playerId: pid, score: e.score, ts: e.ts,
      }));
      rows.sort((a, b) => lowerIsBetter ? a.score - b.score : b.score - a.score);
      return rows.slice(0, n);
    }

    function rank(stat, playerId, lowerIsBetter) {
      const t = top(stat, Infinity, lowerIsBetter);
      const idx = t.findIndex(r => r.playerId === playerId);
      return idx === -1 ? null : idx + 1;
    }

    function listStats() { return Array.from(boards.keys()); }
    function get(stat, playerId) {
      const board = boards.get(stat);
      return board ? (board.get(playerId) || null) : null;
    }
    function clear(stat) {
      if (stat) boards.delete(stat);
      else boards.clear();
    }

    return { boards, submit, ingest, top, rank, listStats, get, clear };
  }

  return { createLeaderboard };
});
