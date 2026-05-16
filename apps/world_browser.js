// apps/world_browser.js — browse + load custom worlds.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWorldBrowser = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "world_browser",
    name: "World Browser",
    icon: "🌍",
    category: "explorer",
    init: (opts) => ({
      manifests: opts.manifests || [], // [{name, manifest}]
      selected: null,
      lastResult: null,
      worldsLoader: opts.worldsLoader || null, // injected loader (Worlds.loadIntoNewWorld)
      worldsDeps: opts.worldsDeps || null,
    }),
    render: (state) => {
      if (state.manifests.length === 0) return "WorldBrowser — no worlds.";
      return state.manifests.map((m, i) => {
        const sel = i === state.selected ? "▶ " : "  ";
        const wid = m.manifest && m.manifest.worldId;
        return `${sel}${m.name} (${wid || "?"})`;
      }).join("\n");
    },
    handleInput: (state, evt) => {
      if (evt.type === "select" && typeof evt.index === "number") {
        if (evt.index < 0 || evt.index >= state.manifests.length) return null;
        return { ...state, selected: evt.index };
      }
      if (evt.type === "load" && state.selected !== null) {
        const m = state.manifests[state.selected];
        if (!m) return null;
        if (!state.worldsLoader || !state.worldsDeps) return { ...state, lastResult: { ok: false, reason: "no_loader" } };
        const r = state.worldsLoader(m.manifest, state.worldsDeps);
        return { ...state, lastResult: r };
      }
      if (evt.type === "add" && evt.name && evt.manifest) {
        return { ...state, manifests: [...state.manifests, { name: evt.name, manifest: evt.manifest }] };
      }
      if (evt.type === "remove" && typeof evt.index === "number") {
        if (evt.index < 0 || evt.index >= state.manifests.length) return null;
        const next = state.manifests.slice();
        next.splice(evt.index, 1);
        return { ...state, manifests: next, selected: null };
      }
      return null;
    },
    ipc: () => null,
  };

  return { APP };
});
