// npc_routine.js — per-NPC daily routine runner with transitions.
// Distinct from npc_schedule.js (iter 50, which is data-only templates):
// this module owns NPC routine state, ticks per-game-hour, emits
// transition events, queries census + at-location, and integrates
// with caller-supplied routing/spawn systems.
//
// Schedule windows are {startHour, endHour, activity, location, params}.
// Built-in activities: sleep / eat / work / patrol / socialize / shop /
// idle / custom; caller may add more via registerActivity.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANPCRoutine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_ACTIVITIES = ["sleep", "eat", "work", "patrol", "socialize", "shop", "idle", "custom"];

  function _hour(h) {
    if (typeof h !== "number") return null;
    h = h % 24;
    if (h < 0) h += 24;
    return h;
  }

  function _inWindow(hour, start, end) {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      ticksPerHour: 60,
    }, opts.config || {});

    const activities = new Set(DEFAULT_ACTIVITIES);
    const npcs = new Map();
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function registerActivity(name) {
      if (typeof name !== "string" || !name) return { ok: false };
      activities.add(name);
      return { ok: true };
    }

    function _validateWindow(w) {
      const start = _hour(w.startHour);
      // Preserve endHour === 24 as "end of day" rather than normalizing to 0
      const end = w.endHour === 24 ? 24 : _hour(w.endHour);
      if (start === null || end === null) return null;
      if (!w.activity) return null;
      if (!activities.has(w.activity)) return null;
      return {
        startHour: start, endHour: end,
        activity: w.activity,
        location: w.location || null,
        params: w.params || {},
      };
    }

    function registerNPC(opts2) {
      opts2 = opts2 || {};
      if (!opts2.id) return { ok: false, reason: "missing_id" };
      if (npcs.has(opts2.id)) return { ok: false, reason: "duplicate" };
      const schedule = (opts2.schedule || []).map(_validateWindow).filter(Boolean);
      npcs.set(opts2.id, {
        id: opts2.id,
        schedule,
        current: null,
        lastTransitionAt: null,
        meta: opts2.meta || {},
      });
      _log("register_npc", { id: opts2.id });
      return { ok: true };
    }

    function setSchedule(npcId, schedule) {
      const npc = npcs.get(npcId);
      if (!npc) return { ok: false, reason: "missing_npc" };
      npc.schedule = schedule.map(_validateWindow).filter(Boolean);
      npc.current = null;
      npc.lastTransitionAt = null;
      _log("set_schedule", { npcId, windows: npc.schedule.length });
      return { ok: true };
    }

    function unregisterNPC(id) { return npcs.delete(id); }

    function currentActivity(npcId, hour) {
      const npc = npcs.get(npcId);
      if (!npc) return null;
      const h = _hour(hour);
      if (h === null) return null;
      for (const w of npc.schedule) {
        if (_inWindow(h, w.startHour, w.endHour)) {
          return {
            activity: w.activity,
            location: w.location,
            params: w.params,
            startHour: w.startHour,
            endHour: w.endHour,
          };
        }
      }
      return null;
    }

    function tick(hour) {
      const transitions = [];
      const h = _hour(hour);
      for (const npc of npcs.values()) {
        const next = currentActivity(npc.id, h);
        const cur = npc.current;
        const sameActivity = cur && next && cur.activity === next.activity &&
                             cur.location === next.location;
        if (!sameActivity) {
          transitions.push({
            npcId: npc.id,
            from: cur ? cur.activity : null,
            to: next ? next.activity : null,
            hour: h,
            location: next ? next.location : null,
          });
          npc.current = next;
          npc.lastTransitionAt = Date.now();
          _log("transition", { npcId: npc.id, to: next ? next.activity : null });
        }
      }
      return transitions;
    }

    function getNPC(id) { return npcs.get(id) || null; }
    function listNPCs() { return Array.from(npcs.values()); }
    function listActivities() { return Array.from(activities); }

    function activityCensus(hour) {
      const h = _hour(hour);
      const counts = {};
      for (const npc of npcs.values()) {
        const cur = currentActivity(npc.id, h);
        const a = cur ? cur.activity : "idle";
        counts[a] = (counts[a] || 0) + 1;
      }
      return counts;
    }

    function npcsAtLocation(hour, location) {
      const h = _hour(hour);
      const out = [];
      for (const npc of npcs.values()) {
        const cur = currentActivity(npc.id, h);
        if (cur && cur.location === location) out.push(npc.id);
      }
      return out;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }
    function getConfig() { return Object.assign({}, config); }

    return {
      DEFAULT_ACTIVITIES,
      registerActivity,
      registerNPC, unregisterNPC, setSchedule,
      currentActivity, tick,
      getNPC, listNPCs, listActivities,
      activityCensus, npcsAtLocation,
      recentEvents, getConfig,
    };
  }

  return { DEFAULT_ACTIVITIES, createSystem };
});
