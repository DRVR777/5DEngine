// npc_schedule.js — daily NPC routines keyed to time-of-day.
// Each NPC has a schedule: array of {startHour, endHour, activity, location}.
// Schedule lookup returns the current activity given current hour.
// Activities are data; renderer reads them and decides how to display.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANpcSchedule = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ACTIVITIES = ["sleep", "work", "eat", "leisure", "patrol", "shop", "travel"];

  // Templates: common NPC archetypes.
  const TEMPLATES = {
    office_worker: [
      { startHour: 0,  endHour: 7,  activity: "sleep",   location: "home" },
      { startHour: 7,  endHour: 8,  activity: "eat",     location: "home" },
      { startHour: 8,  endHour: 9,  activity: "travel",  location: "office" },
      { startHour: 9,  endHour: 12, activity: "work",    location: "office" },
      { startHour: 12, endHour: 13, activity: "eat",     location: "diner" },
      { startHour: 13, endHour: 17, activity: "work",    location: "office" },
      { startHour: 17, endHour: 18, activity: "travel",  location: "home" },
      { startHour: 18, endHour: 22, activity: "leisure", location: "home" },
      { startHour: 22, endHour: 24, activity: "sleep",   location: "home" },
    ],
    shopkeeper: [
      { startHour: 0,  endHour: 6,  activity: "sleep",   location: "home" },
      { startHour: 6,  endHour: 7,  activity: "eat",     location: "home" },
      { startHour: 7,  endHour: 9,  activity: "travel",  location: "shop" },
      { startHour: 9,  endHour: 19, activity: "work",    location: "shop" },
      { startHour: 19, endHour: 20, activity: "travel",  location: "home" },
      { startHour: 20, endHour: 24, activity: "leisure", location: "home" },
    ],
    night_guard: [
      { startHour: 0,  endHour: 6,  activity: "patrol",  location: "warehouse" },
      { startHour: 6,  endHour: 7,  activity: "travel",  location: "home" },
      { startHour: 7,  endHour: 15, activity: "sleep",   location: "home" },
      { startHour: 15, endHour: 16, activity: "eat",     location: "home" },
      { startHour: 16, endHour: 22, activity: "leisure", location: "home" },
      { startHour: 22, endHour: 23, activity: "travel",  location: "warehouse" },
      { startHour: 23, endHour: 24, activity: "patrol",  location: "warehouse" },
    ],
  };

  function listTemplates() { return Object.keys(TEMPLATES); }
  function getTemplate(name) { return TEMPLATES[name] || null; }

  function registerTemplate(name, schedule) {
    if (TEMPLATES[name]) throw new Error(`template ${name} exists`);
    if (!validateSchedule(schedule).ok) {
      throw new Error("invalid schedule");
    }
    TEMPLATES[name] = schedule.slice();
  }

  function validateSchedule(schedule) {
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return { ok: false, reason: "empty" };
    }
    let lastEnd = 0;
    for (const slot of schedule) {
      if (typeof slot.startHour !== "number" || typeof slot.endHour !== "number") {
        return { ok: false, reason: "bad_hours" };
      }
      if (slot.startHour < 0 || slot.endHour > 24 || slot.startHour >= slot.endHour) {
        return { ok: false, reason: "bad_range" };
      }
      if (slot.startHour < lastEnd) {
        return { ok: false, reason: "overlap_or_unsorted" };
      }
      if (!ACTIVITIES.includes(slot.activity)) {
        return { ok: false, reason: `bad_activity:${slot.activity}` };
      }
      lastEnd = slot.endHour;
    }
    if (lastEnd !== 24) return { ok: false, reason: "incomplete_day" };
    return { ok: true };
  }

  // Look up the current activity slot at the given hour (0..24).
  function activityAt(schedule, hour) {
    for (const slot of schedule) {
      if (hour >= slot.startHour && hour < slot.endHour) return slot;
    }
    return null;
  }

  // Build a per-NPC schedule from a template (clone so mutations don't leak).
  function makeNPC(opts) {
    opts = opts || {};
    const tmpl = opts.template ? TEMPLATES[opts.template] : null;
    if (opts.template && !tmpl) throw new Error(`unknown template: ${opts.template}`);
    return {
      id: opts.id,
      template: opts.template || null,
      schedule: tmpl ? tmpl.map(s => ({ ...s })) : (opts.schedule || []),
      home: opts.home || null,
      // Optional location → world position resolver
      locations: opts.locations || {},
      // State derived per tick
      currentActivity: null,
      currentLocation: null,
    };
  }

  // Drive an NPC: figure out current activity, return location to head to.
  // hour: 0..24 float; resolveLocation: (locName) → {u, v} or null.
  function tick(npc, hour) {
    const slot = activityAt(npc.schedule, hour);
    if (!slot) return { changed: false, current: null };
    const changed = npc.currentActivity !== slot.activity ||
                    npc.currentLocation !== slot.location;
    npc.currentActivity = slot.activity;
    npc.currentLocation = slot.location;
    return { changed, current: slot, locationCoord: npc.locations[slot.location] || null };
  }

  // Convenience: hour from a day-night phase (0..1) + day length seconds
  function hourFromPhase(phase) {
    return ((phase % 1) + 1) % 1 * 24;
  }

  return {
    ACTIVITIES, TEMPLATES,
    listTemplates, getTemplate, registerTemplate,
    validateSchedule, activityAt, makeNPC, tick, hourFromPhase,
  };
});
