// apps/file_manager.js — browse + edit the computer's fileSystem.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAFileManager = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = {
    id: "file_manager",
    name: "File Manager",
    icon: "📁",
    category: "system",
    init: () => ({ selected: null, lastWrite: null }),
    render: (state) => {
      // Pull from computer.fileSystem at render time so other apps' writes
      // are reflected live.
      const comp = state.computer;
      const keys = comp ? Object.keys(comp.fileSystem || {}) : [];
      if (keys.length === 0) return "File Manager — empty.";
      return keys.map(k => {
        const sel = k === state.selected ? "▶ " : "  ";
        const val = comp.fileSystem[k];
        const preview = typeof val === "string"
          ? (val.length > 40 ? val.slice(0, 40) + "…" : val)
          : `[${typeof val}]`;
        return `${sel}${k} — ${preview}`;
      }).join("\n");
    },
    handleInput: (state, evt, computer) => {
      // Inject computer into state lazily so render can pull live FS
      if (!state.computer && computer) state.computer = computer;
      if (evt.type === "select" && evt.key) {
        return { ...state, selected: evt.key };
      }
      if (evt.type === "write" && evt.key && computer) {
        computer.fileSystem[evt.key] = evt.value;
        return { ...state, lastWrite: evt.key };
      }
      if (evt.type === "delete" && evt.key && computer) {
        delete computer.fileSystem[evt.key];
        if (state.selected === evt.key) return { ...state, selected: null };
        return { ...state };
      }
      return null;
    },
    ipc: () => null,
  };

  return { APP };
});
