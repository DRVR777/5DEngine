// apps/network_monitor.js — live CWP packet stream, in-game.
// Reads from an injected debug Recorder. Displays the last N events
// with type-coloring and a type-filter.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTANetworkMonitor = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "network_monitor",
    name: "Network Monitor",
    icon: "📡",
    category: "system",
    init: (opts) => ({
      recorder: opts.recorder || null,        // injected debug.createRecorder()
      filterType: null,                        // null = all types
      filterDir: null,                         // null | "in" | "out"
      paused: false,
      viewLines: opts.viewLines || 12,
    }),
    render: (state) => {
      if (!state.recorder) return "NetworkMonitor — no recorder injected.";
      const all = state.recorder.events || [];
      let evs = all;
      if (state.filterType) evs = evs.filter(e => e.env && e.env.type === state.filterType);
      if (state.filterDir)  evs = evs.filter(e => e.direction === state.filterDir);
      const tail = evs.slice(-state.viewLines);
      const lines = tail.map(e => {
        const arrow = e.direction === "out" ? "→" : "←";
        const t = (e.env && e.env.type) || "?";
        const ch = e.channel || "-";
        const ms = Math.round(e.t);
        return `${String(ms).padStart(6)}ms ${arrow} ${ch.padEnd(14)} ${t}`;
      }).join("\n");
      const filterTxt = `[type:${state.filterType || "*"} · dir:${state.filterDir || "*"} · ${state.paused ? "PAUSED" : "live"}]`;
      const stats = `total:${all.length} shown:${tail.length}`;
      return `${filterTxt} ${stats}\n${lines || "(no events)"}`;
    },
    handleInput: (state, evt) => {
      if (evt.type === "set_filter") {
        return { ...state, filterType: evt.value || null };
      }
      if (evt.type === "set_dir") {
        if (evt.value && !["in", "out"].includes(evt.value)) return null;
        return { ...state, filterDir: evt.value || null };
      }
      if (evt.type === "pause") return { ...state, paused: true };
      if (evt.type === "resume") return { ...state, paused: false };
      if (evt.type === "clear") {
        if (state.recorder && state.recorder.clear) state.recorder.clear();
        return { ...state };
      }
      if (evt.type === "set_view_lines" && typeof evt.value === "number") {
        return { ...state, viewLines: Math.max(1, Math.min(100, evt.value)) };
      }
      return null;
    },
    ipc: (msg, computer) => {
      if (msg.type === "stats" && msg.recorder) {
        const evs = msg.recorder.events || [];
        const byType = {};
        for (const e of evs) {
          const t = (e.env && e.env.type) || "?";
          byType[t] = (byType[t] || 0) + 1;
        }
        return { total: evs.length, byType };
      }
      return null;
    },
  };

  return { APP };
});
