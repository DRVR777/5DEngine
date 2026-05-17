// app_framework.js — registry + lifecycle for in-game computer apps.
//
// An app is data + handlers:
//   { id, name, icon, init, render, handleInput, ipc }
// Apps live on a per-computer instance (so multiple computers can run
// the same app independently). They share computer.fileSystem.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAApps = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APPS = new Map();   // id → { id, name, icon, init, render, handleInput, ipc }

  function registerApp(app) {
    if (!app || !app.id) throw new Error("app must have id");
    if (APPS.has(app.id)) throw new Error(`app ${app.id} already registered`);
    APPS.set(app.id, Object.assign({
      name: app.id,
      icon: "📱",
      init: () => ({}),
      render: () => "",
      handleInput: () => null,
      ipc: () => null,
    }, app));
  }
  function getApp(id) { return APPS.get(id) || null; }
  function listApps() { return Array.from(APPS.keys()); }
  function appsByCategory(category) {
    return Array.from(APPS.values()).filter(a => a.category === category).map(a => a.id);
  }

  // Per-computer running app state. The app's init() returns the initial
  // state; subsequent calls receive (state, ...) and return (newState, ...).
  function instantiate(appId, computer, opts) {
    const app = getApp(appId);
    if (!app) return { ok: false, reason: "no_such_app" };
    const inst = {
      appId,
      computer,
      state: app.init(opts || {}, computer),
      app,
    };
    return { ok: true, instance: inst };
  }

  function render(instance) {
    if (!instance) return "";
    return instance.app.render(instance.state, instance.computer);
  }

  function input(instance, evt) {
    if (!instance) return null;
    const next = instance.app.handleInput(instance.state, evt, instance.computer);
    if (next !== undefined && next !== null) instance.state = next;
    return instance.state;
  }

  // IPC: app-to-app messaging via the host computer.
  function ipc(instance, targetAppId, msg) {
    const target = getApp(targetAppId);
    if (!target) return { ok: false, reason: "no_target" };
    const reply = target.ipc(msg, instance && instance.computer);
    return { ok: true, reply };
  }

  // Convenience: launch an app on a computer (sit + computer.launch wrapper)
  function launchOnComputer(computer, appId, playerId, opts) {
    const Comp = (typeof require === "function") ? require("./computer.js") :
      (typeof self !== "undefined" ? self.GTAComputer : null);
    if (!Comp) return { ok: false, reason: "no_computer_module" };
    const launched = Comp.launch(computer, appId, playerId);
    if (!launched.ok) return launched;
    const inst = instantiate(appId, computer, opts);
    return inst.ok ? { ok: true, instance: inst.instance } : inst;
  }

  // Reset (mainly for tests)
  function _clearAll() { APPS.clear(); }

  return {
    registerApp, getApp, listApps, appsByCategory,
    instantiate, render, input, ipc, launchOnComputer,
    _clearAll,
  };
});
