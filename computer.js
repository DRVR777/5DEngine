// computer.js — in-game computer entity. Walk up + E to sit; the screen
// takes over the view with thin edges showing. Apps run in the screen.
//
// Computer entity facets:
//   computer: {
//     screen: { width, height, bezelPx },
//     installedApps: ["app_id", ...],
//     activeApp: null | "app_id",
//     occupiedBy: null | playerId,
//     fileSystem: { /* in-memory KV the apps share */ },
//   }
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAComputer = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function makeComputer(opts) {
    opts = opts || {};
    return {
      screen: {
        width:  opts.width  || 1280,
        height: opts.height || 800,
        bezelPx: opts.bezelPx != null ? opts.bezelPx : 24,
      },
      installedApps: (opts.installedApps || []).slice(),
      activeApp: null,
      occupiedBy: null,
      sittingPos: opts.sittingPos || { u: 0, v: 0, y: 0 },   // where the chair is
      fileSystem: opts.fileSystem || {},
    };
  }

  // Sit a player at this computer. Returns the screen takeover spec
  // (telling the renderer to scale the app to {viewport} with bezelPx
  // edges visible around it).
  function sit(computer, playerId) {
    if (computer.occupiedBy && computer.occupiedBy !== playerId) {
      return { ok: false, reason: "occupied", by: computer.occupiedBy };
    }
    computer.occupiedBy = playerId;
    return {
      ok: true,
      takeover: {
        viewport: { width: computer.screen.width, height: computer.screen.height },
        bezelPx: computer.screen.bezelPx,
        sittingPos: computer.sittingPos,
      },
    };
  }

  function stand(computer, playerId) {
    if (computer.occupiedBy !== playerId) return { ok: false, reason: "not_seated" };
    computer.occupiedBy = null;
    computer.activeApp = null;
    return { ok: true };
  }

  function isOccupied(computer) { return !!computer.occupiedBy; }
  function isOccupiedBy(computer, playerId) { return computer.occupiedBy === playerId; }

  function installApp(computer, appId) {
    if (computer.installedApps.includes(appId)) return { ok: false, reason: "already_installed" };
    computer.installedApps.push(appId);
    return { ok: true };
  }
  function uninstallApp(computer, appId) {
    const i = computer.installedApps.indexOf(appId);
    if (i === -1) return { ok: false, reason: "not_installed" };
    computer.installedApps.splice(i, 1);
    if (computer.activeApp === appId) computer.activeApp = null;
    return { ok: true };
  }

  function launch(computer, appId, playerId) {
    if (!isOccupiedBy(computer, playerId)) return { ok: false, reason: "not_seated" };
    if (!computer.installedApps.includes(appId)) return { ok: false, reason: "not_installed" };
    computer.activeApp = appId;
    return { ok: true, appId };
  }
  function exitApp(computer, playerId) {
    if (!isOccupiedBy(computer, playerId)) return { ok: false, reason: "not_seated" };
    computer.activeApp = null;
    return { ok: true };
  }

  // File system helpers (apps share computer.fileSystem)
  function fsRead(computer, key) { return computer.fileSystem[key] || null; }
  function fsWrite(computer, key, value) { computer.fileSystem[key] = value; }
  function fsList(computer) { return Object.keys(computer.fileSystem); }
  function fsDelete(computer, key) { delete computer.fileSystem[key]; }

  // Proximity check — for the "press E to sit" prompt.
  function distanceTo(computer, ownerEntity, observerPos) {
    if (!ownerEntity || !ownerEntity.position) return Infinity;
    return Math.hypot(
      ownerEntity.position.u - observerPos.u,
      ownerEntity.position.v - observerPos.v
    );
  }

  return {
    makeComputer,
    sit, stand, isOccupied, isOccupiedBy,
    installApp, uninstallApp, launch, exitApp,
    fsRead, fsWrite, fsList, fsDelete,
    distanceTo,
  };
});
