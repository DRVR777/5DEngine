// apps/object_studio.js — upload OBJ/GLB/GLTF, register as a custom entity type.
// Runs inside the in-game computer via the app_framework.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAObjectStudio = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Lazy-resolve dependencies (so this app can be loaded standalone in tests
  // without requiring the engine bundle).
  function getCustomObj() {
    if (typeof require === "function") return require("../custom_objects.js");
    return (typeof self !== "undefined") ? self.GTACustomObj : null;
  }

  const APP = {
    id: "object_studio",
    name: "Object Studio",
    icon: "🎨",
    category: "creator",
    init: () => ({
      uploads: [],          // [{name, format, vertexCount, registeredAs, ts}]
      lastError: null,
    }),
    render: (state) => {
      if (state.uploads.length === 0) return "ObjectStudio — no uploads yet.";
      return state.uploads.map(u =>
        `${u.registeredAs} (${u.format}, ${u.vertexCount}v)`
      ).join("\n");
    },
    handleInput: (state, evt, computer) => {
      // evt: { type: "upload", filename, content?, vertices?, registerAs?, registry }
      if (evt.type !== "upload") return null;
      const Co = getCustomObj();
      if (!Co) return { ...state, lastError: "custom_objects unavailable" };
      const processed = Co.processUpload({
        filename: evt.filename,
        content: evt.content,
        vertices: evt.vertices,
      });
      if (!processed.ok) return { ...state, lastError: processed.reason };
      let registeredAs = evt.registerAs || (evt.filename || "asset").split(".")[0];
      if (evt.registry) {
        // Prevent name collision in registry
        let i = 0; let name = registeredAs;
        while (evt.registry.getType(name)) { i++; name = registeredAs + "_" + i; }
        registeredAs = name;
        const r = Co.registerAsCustomEntity(evt.registry, registeredAs, processed,
          { source: evt.filename });
        if (!r.ok) return { ...state, lastError: r.reason };
      }
      // Persist to the computer's filesystem so other apps see it
      if (computer && computer.fileSystem) {
        const list = computer.fileSystem["object_studio.uploads"] || [];
        list.push({ filename: evt.filename, registeredAs, format: processed.format });
        computer.fileSystem["object_studio.uploads"] = list;
      }
      return {
        uploads: [...state.uploads, {
          name: evt.filename,
          format: processed.format,
          vertexCount: processed.vertexCount,
          registeredAs,
          ts: Date.now(),
        }],
        lastError: null,
      };
    },
    ipc: (msg) => {
      // Other apps can ask "what do you have"
      if (msg.type === "list_uploads") return { ok: true, uploads: msg.state || [] };
      return null;
    },
  };

  return { APP };
});
