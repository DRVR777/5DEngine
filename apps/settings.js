// apps/settings.js — engine settings panel (mouse sensitivity, FOV, audio,
// game mode select). All values mirror into computer.fileSystem so the
// game loop can pick them up.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTASettings = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULTS = {
    mouseSensitivity: 0.003,
    fov: 60,
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.9,
    gameMode: "survival",
    showFPS: false,
    showMinimap: true,
    showHUD: true,
  };

  const APP = {
    id: "settings",
    name: "Settings",
    icon: "⚙️",
    category: "system",
    init: (opts) => {
      const loaded = (opts.computer && opts.computer.fileSystem
        && opts.computer.fileSystem["settings.json"]) || null;
      const start = loaded ? JSON.parse(loaded) : {};
      return { values: Object.assign({}, DEFAULTS, start) };
    },
    render: (state) => {
      const lines = Object.keys(state.values).map(k => `  ${k.padEnd(20)} = ${state.values[k]}`);
      return "Settings\n" + lines.join("\n");
    },
    handleInput: (state, evt, computer) => {
      if (evt.type === "set" && evt.key in DEFAULTS) {
        const next = { ...state.values, [evt.key]: evt.value };
        if (computer && computer.fileSystem) {
          computer.fileSystem["settings.json"] = JSON.stringify(next);
        }
        return { values: next };
      }
      if (evt.type === "reset") {
        if (computer && computer.fileSystem) {
          computer.fileSystem["settings.json"] = JSON.stringify(DEFAULTS);
        }
        return { values: Object.assign({}, DEFAULTS) };
      }
      return null;
    },
    ipc: (msg) => {
      if (msg.type === "get" && msg.key) {
        return { value: DEFAULTS[msg.key] };
      }
      return null;
    },
  };

  return { APP, DEFAULTS };
});
