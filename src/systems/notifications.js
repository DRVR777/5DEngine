// notifications.js — in-game toast/notification queue.
// 5 categories: info / success / warn / error / quest.
// 4 priorities: low / normal / high / critical.
//
// Toasts auto-dismiss after a category-specific duration unless sticky.
// Renderer reads activeToasts(now) → ordered [highest priority first,
// then most recent]. Category filters available for HUD toggles.
//
// Click-callback supported: toast{ onClick } fires when caller invokes
// click(id) (e.g. after the renderer handles the mouse event).
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANotifications = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CATEGORIES = ["info", "success", "warn", "error", "quest"];
  const PRIORITIES = ["low", "normal", "high", "critical"];
  const PRIORITY_RANK = { low: 0, normal: 1, high: 2, critical: 3 };

  function createSystem(opts) {
    opts = opts || {};
    const config = Object.assign({
      defaultDurationsMs: {
        info: 3500, success: 4000, warn: 5000, error: 7000, quest: 6000,
      },
      maxQueueDepth: 50,
      maxVisible: 6,
      enabledCategories: new Set(CATEGORIES),
      mutedCategories: new Set(),
    }, opts.config || {});
    if (Array.isArray(config.enabledCategories)) config.enabledCategories = new Set(config.enabledCategories);
    if (Array.isArray(config.mutedCategories)) config.mutedCategories = new Set(config.mutedCategories);

    const toasts = [];
    let nextId = 1;
    const events = [];

    function _log(kind, detail) {
      events.push({ kind, detail, ts: Date.now() });
      if (events.length > 500) events.shift();
    }

    function push(opts2) {
      opts2 = opts2 || {};
      if (!opts2.title && !opts2.message) {
        return { ok: false, reason: "missing_content" };
      }
      const category = opts2.category || "info";
      if (!CATEGORIES.includes(category)) {
        return { ok: false, reason: "bad_category" };
      }
      if (config.mutedCategories.has(category)) {
        _log("muted", { category });
        return { ok: false, reason: "muted" };
      }
      const priority = opts2.priority || "normal";
      if (!PRIORITIES.includes(priority)) {
        return { ok: false, reason: "bad_priority" };
      }
      const ts = opts2.ts != null ? opts2.ts : Date.now();
      const duration = opts2.duration != null
        ? opts2.duration
        : config.defaultDurationsMs[category];
      const sticky = opts2.sticky === true || priority === "critical";
      const toast = {
        id: "toast_" + nextId++,
        category, priority,
        title: opts2.title || "",
        message: opts2.message || "",
        icon: opts2.icon || null,
        ts,
        duration: sticky ? Infinity : duration,
        expiresAt: sticky ? Infinity : ts + duration,
        sticky,
        dismissed: false,
        clicked: false,
        onClick: opts2.onClick || null,
        meta: Object.assign({}, opts2.meta || {}),
      };
      toasts.push(toast);
      while (toasts.length > config.maxQueueDepth) toasts.shift();
      _log("push", { id: toast.id, category, priority });
      return { ok: true, id: toast.id, toast };
    }

    function dismiss(id) {
      const t = _byId(id);
      if (!t) return { ok: false };
      t.dismissed = true;
      _log("dismiss", { id });
      return { ok: true };
    }

    function dismissAll(opts2) {
      opts2 = opts2 || {};
      let n = 0;
      for (const t of toasts) {
        if (t.dismissed) continue;
        if (opts2.category && t.category !== opts2.category) continue;
        t.dismissed = true; n++;
      }
      _log("dismiss_all", { n });
      return { ok: true, dismissed: n };
    }

    function click(id) {
      const t = _byId(id);
      if (!t) return { ok: false };
      t.clicked = true;
      if (typeof t.onClick === "function") {
        try { t.onClick(); } catch (e) {}
      }
      // Click also dismisses
      t.dismissed = true;
      _log("click", { id });
      return { ok: true };
    }

    function activeToasts(now) {
      now = now != null ? now : Date.now();
      const live = toasts
        .filter(t => !t.dismissed && now < t.expiresAt && now >= t.ts &&
                     config.enabledCategories.has(t.category))
        .sort((a, b) => {
          const pa = PRIORITY_RANK[a.priority] || 0;
          const pb = PRIORITY_RANK[b.priority] || 0;
          if (pa !== pb) return pb - pa;
          return b.ts - a.ts;     // newer first within same priority
        });
      return live.slice(0, config.maxVisible);
    }

    function _byId(id) { return toasts.find(t => t.id === id) || null; }

    function muteCategory(c) { config.mutedCategories.add(c); }
    function unmuteCategory(c) { config.mutedCategories.delete(c); }
    function setCategoryEnabled(c, enabled) {
      if (enabled) config.enabledCategories.add(c);
      else config.enabledCategories.delete(c);
    }

    function tick(now) {
      now = now != null ? now : Date.now();
      let pruned = 0;
      for (let i = toasts.length - 1; i >= 0; i--) {
        const t = toasts[i];
        if (t.dismissed || (now - t.ts > t.duration * 3 && t.duration !== Infinity)) {
          toasts.splice(i, 1); pruned++;
        }
      }
      return pruned;
    }

    function listAll(includeDismissed) {
      if (includeDismissed) return toasts.slice();
      return toasts.filter(t => !t.dismissed);
    }

    function totals() {
      const out = { total: toasts.length };
      for (const c of CATEGORIES) out[c] = 0;
      for (const t of toasts) out[t.category]++;
      return out;
    }

    function recentEvents(n) { return events.slice(-(n || 50)); }

    return {
      CATEGORIES, PRIORITIES,
      push, dismiss, dismissAll, click,
      activeToasts, listAll, totals,
      muteCategory, unmuteCategory, setCategoryEnabled,
      tick, recentEvents,
    };
  }

  return { CATEGORIES, PRIORITIES, createSystem };
});
