// apps/minimap_markers.js — manage waypoints + filters for the minimap.
// Wraps iter 57 fog_of_war.createWaypointSystem with player-facing UI.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAMinimapMarkers = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KINDS = ["objective", "friend", "shop", "custom", "danger", "loot"];

  const APP = {
    id: "minimap_markers",
    name: "Minimap Markers",
    icon: "📍",
    category: "utility",
    init: (opts) => ({
      waypointSystem: opts.waypointSystem || null,
      visibleKinds: new Set(opts.visibleKinds || KINDS),
      selected: null,
      message: null,
    }),
    render: (state) => {
      if (!state.waypointSystem) return "MinimapMarkers — no waypoint system";
      const wps = state.waypointSystem.listAll();
      if (wps.length === 0) return "No markers. Add some.";
      const visible = wps.filter(w => state.visibleKinds.has(w.kind));
      if (visible.length === 0) return `${wps.length} markers (all hidden by filter)`;
      const lines = visible.map(w => {
        const sel = w.id === state.selected ? "▶ " : "  ";
        const ttl = w.ttl > 0 ? ` (${w.ttl.toFixed(0)}s)` : "";
        return `${sel}[${w.kind}] ${w.label} @(${w.u.toFixed(1)},${w.v.toFixed(1)})${ttl}`;
      });
      return `Markers (${visible.length}/${wps.length})\n${lines.join("\n")}` +
        (state.message ? `\n[${state.message}]` : "");
    },
    handleInput: (state, evt) => {
      if (!state.waypointSystem) return null;
      const ws = state.waypointSystem;
      if (evt.type === "add" && evt.id) {
        const ok = ws.add(evt.id, {
          kind: evt.kind || "custom",
          u: evt.u || 0, v: evt.v || 0,
          label: evt.label || evt.id,
          color: evt.color,
          ttl: evt.ttl != null ? evt.ttl : -1,
        });
        return { ...state, message: ok ? `added ${evt.id}` : `id ${evt.id} exists` };
      }
      if (evt.type === "remove" && evt.id) {
        const ok = ws.remove(evt.id);
        return { ...state, message: ok ? `removed ${evt.id}` : "not found",
                 selected: state.selected === evt.id ? null : state.selected };
      }
      if (evt.type === "select" && evt.id) {
        const w = ws.get(evt.id);
        return { ...state, selected: w ? evt.id : null,
                 message: w ? null : "not found" };
      }
      if (evt.type === "toggle_kind" && evt.kind) {
        if (!KINDS.includes(evt.kind)) return null;
        const next = new Set(state.visibleKinds);
        if (next.has(evt.kind)) next.delete(evt.kind);
        else next.add(evt.kind);
        return { ...state, visibleKinds: next };
      }
      if (evt.type === "show_all") {
        return { ...state, visibleKinds: new Set(KINDS) };
      }
      if (evt.type === "hide_all") {
        return { ...state, visibleKinds: new Set() };
      }
      if (evt.type === "clear_message") {
        return { ...state, message: null };
      }
      return null;
    },
    ipc: (msg, computer) => {
      if (msg.type === "marker_count" && msg.state) {
        return { count: msg.state.waypointSystem ? msg.state.waypointSystem.listAll().length : 0 };
      }
      return null;
    },
  };

  return { APP, KINDS };
});
