// codex.js — lore entries auto-unlocked by events + cross-references.
// Each entry: {id, category, title, body, refs[], unlockBy?: {kind, ...},
//              firstSeen?, hidden? }
// Entries are locked by default; the runtime unlocks them when a
// matching event fires (kill_first_<tag>, mission_complete_<id>, etc.),
// or via explicit unlock(id).
//
// Categories group entries (e.g. "characters", "locations", "items",
// "history"). Search performs case-insensitive substring match on
// title + body + refs.
//
// Cross-refs: an entry can list other entry ids; the codex resolves
// them to {id, title, unlocked} for in-line linking.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTACodex = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createCodex(opts) {
    opts = opts || {};
    const entries = new Map();
    const unlockedByPlayer = new Map();   // playerId → Set<entryId>
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function _ensurePlayer(playerId) {
      if (!unlockedByPlayer.has(playerId)) unlockedByPlayer.set(playerId, new Set());
      return unlockedByPlayer.get(playerId);
    }

    function register(entry) {
      if (!entry || !entry.id) return { ok: false, reason: "missing_id" };
      if (entries.has(entry.id)) return { ok: false, reason: "duplicate" };
      entries.set(entry.id, {
        id: entry.id,
        category: entry.category || "general",
        title: entry.title || entry.id,
        body: entry.body || "",
        refs: (entry.refs || []).slice(),
        unlockBy: entry.unlockBy || null,
        hidden: !!entry.hidden,
        meta: entry.meta || {},
      });
      _log("register", { id: entry.id, category: entry.category });
      return { ok: true };
    }

    function unregister(id) { return entries.delete(id); }

    function unlock(playerId, entryId, opts2) {
      opts2 = opts2 || {};
      if (!entries.has(entryId)) return { ok: false, reason: "missing" };
      const set = _ensurePlayer(playerId);
      if (set.has(entryId)) return { ok: false, reason: "already_unlocked" };
      set.add(entryId);
      _log("unlock", { playerId, entryId, source: opts2.source || "manual" });
      return { ok: true };
    }

    function isUnlocked(playerId, entryId) {
      const set = unlockedByPlayer.get(playerId);
      return set ? set.has(entryId) : false;
    }

    // Trigger an event; auto-unlocks any entry whose unlockBy matches.
    // event shape: {kind, ...params}
    function trigger(playerId, event) {
      if (!event || !event.kind) return [];
      const newlyUnlocked = [];
      for (const e of entries.values()) {
        if (isUnlocked(playerId, e.id)) continue;
        if (!e.unlockBy || e.unlockBy.kind !== event.kind) continue;
        if (!_match(e.unlockBy, event)) continue;
        unlock(playerId, e.id, { source: "trigger:" + event.kind });
        newlyUnlocked.push(e);
      }
      return newlyUnlocked;
    }

    function _match(unlockBy, event) {
      // Optional param checks — every key in unlockBy (besides kind)
      // must match event[key]
      for (const k of Object.keys(unlockBy)) {
        if (k === "kind") continue;
        if (unlockBy[k] !== event[k]) return false;
      }
      return true;
    }

    function getEntry(id) { return entries.get(id) || null; }

    function readEntry(playerId, entryId, opts2) {
      opts2 = opts2 || {};
      const e = entries.get(entryId);
      if (!e) return { ok: false, reason: "missing" };
      const unlocked = isUnlocked(playerId, entryId);
      if (!unlocked && !opts2.peek) return { ok: false, reason: "locked" };
      // Resolve refs
      const resolvedRefs = e.refs.map(rid => {
        const r = entries.get(rid);
        if (!r) return { id: rid, missing: true };
        return {
          id: rid, title: r.title,
          unlocked: isUnlocked(playerId, rid),
          category: r.category,
        };
      });
      return {
        ok: true,
        id: e.id, category: e.category, title: e.title,
        body: e.body, refs: resolvedRefs, unlocked,
      };
    }

    // List all entries visible to a player. By default hides locked
    // entries flagged as hidden.
    function listFor(playerId, opts2) {
      opts2 = opts2 || {};
      const set = unlockedByPlayer.get(playerId) || new Set();
      const out = [];
      for (const e of entries.values()) {
        const unlocked = set.has(e.id);
        if (e.hidden && !unlocked && !opts2.includeHidden) continue;
        if (opts2.category && e.category !== opts2.category) continue;
        if (opts2.unlockedOnly && !unlocked) continue;
        out.push({
          id: e.id, title: unlocked ? e.title : (e.hidden ? "???" : e.title),
          category: e.category, unlocked, hidden: e.hidden,
        });
      }
      return out;
    }

    // Search across title + body + refs of UNLOCKED entries (default)
    function search(playerId, text, opts2) {
      opts2 = opts2 || {};
      if (typeof text !== "string" || !text) return [];
      const lc = text.toLowerCase();
      const set = unlockedByPlayer.get(playerId) || new Set();
      const out = [];
      for (const e of entries.values()) {
        const unlocked = set.has(e.id);
        if (!unlocked && !opts2.includeLocked) continue;
        if (e.hidden && !unlocked) continue;
        const blob = (e.title + " " + e.body + " " + (e.refs || []).join(" ")).toLowerCase();
        if (blob.includes(lc)) {
          out.push({ id: e.id, title: e.title, category: e.category, unlocked });
        }
      }
      return out;
    }

    function categories() {
      const set = new Set();
      for (const e of entries.values()) set.add(e.category);
      return Array.from(set);
    }

    function unlockedCount(playerId) {
      const set = unlockedByPlayer.get(playerId);
      return set ? set.size : 0;
    }
    function totalCount(opts2) {
      opts2 = opts2 || {};
      let n = 0;
      for (const e of entries.values()) {
        if (e.hidden && !opts2.includeHidden) continue;
        n++;
      }
      return n;
    }
    function completionPct(playerId, opts2) {
      const t = totalCount(opts2);
      if (t === 0) return 0;
      return unlockedCount(playerId) / t;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      register, unregister,
      unlock, isUnlocked, trigger,
      getEntry, readEntry,
      listFor, search,
      categories, unlockedCount, totalCount, completionPct,
      recentEvents,
    };
  }

  return { createCodex };
});
