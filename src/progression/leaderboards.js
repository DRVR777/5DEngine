// leaderboards.js — per-mission/minigame high-score store (local/offline).
// DISAMBIGUATION: this file is GTALeaderboards — an OFFLINE per-mission store with time windows.
// For the NETWORK-SYNCHRONIZED per-stat leaderboard, see leaderboard.js (GTALeaderboard).
// Rule: do NOT merge these. leaderboards.js = local history; leaderboard.js = live networked.
// One board per (boardId). Submit a score and we keep the top-N
// entries (default 100). Filters by player, region, friend-set,
// and time window (last hour / day / week / all-time). Sort orders:
//   "high"  — bigger is better (default)
//   "low"   — smaller is better (best speedrun time)
//
// Append-only audit log of submissions; helpful for anti-cheat
// review later. No actual auth — caller passes a signed envelope
// upstream (CWP v1.0).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTALeaderboards = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TIME_WINDOWS = ["hour", "day", "week", "month", "all"];
  const WINDOW_MS = {
    hour:  60 * 60 * 1000,
    day:   24 * 60 * 60 * 1000,
    week:  7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all:   Infinity,
  };

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      maxEntriesPerBoard: 100,
    }, opts.config || {});

    const boards = new Map();   // boardId → {id, sort, entries[], meta}
    const submissions = [];     // full audit trail
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 1000) events.shift();
    }

    function createBoard(id, boardOpts) {
      boardOpts = boardOpts || {};
      if (boards.has(id)) return { ok: false, reason: "duplicate" };
      const sort = boardOpts.sort || "high";
      if (sort !== "high" && sort !== "low") return { ok: false, reason: "bad_sort" };
      const board = {
        id, sort,
        entries: [],
        meta: Object.assign({}, boardOpts.meta || {}),
        createdAt: Date.now(),
      };
      boards.set(id, board);
      _log("create_board", { id, sort });
      return { ok: true };
    }

    function deleteBoard(id) {
      if (!boards.has(id)) return { ok: false, reason: "missing" };
      boards.delete(id);
      _log("delete_board", { id });
      return { ok: true };
    }

    function listBoards() { return Array.from(boards.keys()); }
    function getBoard(id) { return boards.get(id) || null; }

    function _cmp(a, b, sort) {
      const av = a.score, bv = b.score;
      if (sort === "low") {
        if (av !== bv) return av - bv;
      } else {
        if (av !== bv) return bv - av;
      }
      return a.ts - b.ts;   // tie-break: earlier first
    }

    // submit({boardId, playerId, score, region?, friendOf?, ts?, meta?})
    function submit(s) {
      if (!s || !s.boardId || !s.playerId || typeof s.score !== "number") {
        return { ok: false, reason: "bad_submission" };
      }
      const board = boards.get(s.boardId);
      if (!board) return { ok: false, reason: "no_board" };
      const entry = {
        id: "sub_" + (submissions.length + 1),
        boardId: s.boardId, playerId: s.playerId,
        score: s.score,
        region: s.region || "global",
        friendsOf: (s.friendsOf || []).slice(),
        ts: s.ts != null ? s.ts : Date.now(),
        meta: Object.assign({}, s.meta || {}),
      };
      submissions.push(entry);
      board.entries.push(entry);
      board.entries.sort((a, b) => _cmp(a, b, board.sort));
      if (board.entries.length > config.maxEntriesPerBoard) {
        board.entries.length = config.maxEntriesPerBoard;
      }
      _log("submit", { boardId: s.boardId, playerId: s.playerId, score: s.score });
      return { ok: true, id: entry.id, rank: board.entries.indexOf(entry) + 1 };
    }

    // top(boardId, opts) → [entry, ...] respecting filters
    function top(boardId, opts2) {
      opts2 = opts2 || {};
      const board = boards.get(boardId);
      if (!board) return [];
      const now = opts2.now != null ? opts2.now : Date.now();
      const window = opts2.window || "all";
      const limit = opts2.limit || 10;
      const sinceCutoff = window === "all" ? -Infinity : now - WINDOW_MS[window];
      let filtered = board.entries.filter(e => e.ts >= sinceCutoff && e.ts <= now);
      if (opts2.region) filtered = filtered.filter(e => e.region === opts2.region);
      if (opts2.friendOf) filtered = filtered.filter(e => e.friendsOf.includes(opts2.friendOf));
      if (opts2.player) filtered = filtered.filter(e => e.playerId === opts2.player);
      return filtered.slice(0, limit);
    }

    // rankOf(boardId, playerId, opts) → 1-indexed best rank, or null
    function rankOf(boardId, playerId, opts2) {
      opts2 = opts2 || {};
      const board = boards.get(boardId);
      if (!board) return null;
      const window = opts2.window || "all";
      const now = opts2.now != null ? opts2.now : Date.now();
      const sinceCutoff = window === "all" ? -Infinity : now - WINDOW_MS[window];
      let filtered = board.entries.filter(e => e.ts >= sinceCutoff && e.ts <= now);
      if (opts2.region) filtered = filtered.filter(e => e.region === opts2.region);
      const idx = filtered.findIndex(e => e.playerId === playerId);
      return idx < 0 ? null : idx + 1;
    }

    // bestOf(boardId, playerId, opts) → entry or null
    function bestOf(boardId, playerId, opts2) {
      const t = top(boardId, Object.assign({}, opts2 || {}, { player: playerId, limit: 1 }));
      return t[0] || null;
    }

    // Aggregate: for each player on a board, return their best score
    // (handy when one player submits many runs).
    function leaderboard(boardId, opts2) {
      opts2 = opts2 || {};
      const board = boards.get(boardId);
      if (!board) return [];
      const now = opts2.now != null ? opts2.now : Date.now();
      const window = opts2.window || "all";
      const sinceCutoff = window === "all" ? -Infinity : now - WINDOW_MS[window];
      let filtered = board.entries.filter(e => e.ts >= sinceCutoff && e.ts <= now);
      if (opts2.region) filtered = filtered.filter(e => e.region === opts2.region);
      const bestByPlayer = new Map();
      for (const e of filtered) {
        const cur = bestByPlayer.get(e.playerId);
        if (!cur || _cmp(e, cur, board.sort) < 0) bestByPlayer.set(e.playerId, e);
      }
      const out = Array.from(bestByPlayer.values());
      out.sort((a, b) => _cmp(a, b, board.sort));
      return out.slice(0, opts2.limit || 10);
    }

    function recentSubmissions(n) { return submissions.slice(-(n || 50)); }
    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      TIME_WINDOWS,
      createBoard, deleteBoard, listBoards, getBoard,
      submit, top, rankOf, bestOf, leaderboard,
      recentSubmissions, recentEvents,
    };
  }

  return { TIME_WINDOWS, createSystem };
});
