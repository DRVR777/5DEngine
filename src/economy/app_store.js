// app_store.js — discovery + install for in-game computer apps.
// Apps are signed manifests (kind:"app") with metadata + content (JS code
// or app definition). The store tracks available apps + handles install
// to a specific computer.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAAppStore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createStore(opts) {
    opts = opts || {};
    const catalog = new Map();      // appId → { manifest, definition, installCount, rating }
    const reviews = new Map();      // appId → [{user, stars, comment, ts}]

    function publish(manifest, definition) {
      if (!manifest || !definition) return { ok: false, reason: "missing" };
      if (manifest.kind !== "app") return { ok: false, reason: "not_an_app" };
      if (!definition.id) return { ok: false, reason: "definition_needs_id" };
      catalog.set(definition.id, {
        manifest, definition,
        installCount: 0,
        rating: 0,
        publishedAt: Date.now(),
      });
      return { ok: true, appId: definition.id };
    }

    function unpublish(appId) {
      return catalog.delete(appId);
    }

    function get(appId) {
      const e = catalog.get(appId);
      return e || null;
    }

    function listAll() { return Array.from(catalog.keys()); }

    function search(query, opts) {
      opts = opts || {};
      const q = (query || "").toLowerCase();
      const results = [];
      for (const e of catalog.values()) {
        const def = e.definition;
        const blob = `${def.id} ${def.name || ""} ${def.category || ""}`.toLowerCase();
        if (q && !blob.includes(q)) continue;
        if (opts.category && def.category !== opts.category) continue;
        results.push({ appId: def.id, name: def.name, category: def.category, rating: e.rating, installCount: e.installCount });
      }
      // Sort by installCount desc by default
      results.sort((a, b) => (b.installCount - a.installCount) || (b.rating - a.rating));
      return results;
    }

    function categories() {
      const set = new Set();
      for (const e of catalog.values()) if (e.definition.category) set.add(e.definition.category);
      return Array.from(set).sort();
    }

    // Install onto a specific computer (uses computer.installApp + registers
    // the app definition with the framework).
    function install(appId, computer, framework) {
      const entry = catalog.get(appId);
      if (!entry) return { ok: false, reason: "not_in_catalog" };
      if (!framework.getApp(appId)) {
        try { framework.registerApp(entry.definition); }
        catch (e) { return { ok: false, reason: `register_failed:${e.message}` }; }
      }
      const Comp = (typeof require === "function") ? require("./computer.js") :
        (typeof self !== "undefined" ? self.GTAComputer : null);
      if (!Comp) return { ok: false, reason: "no_computer_module" };
      const ci = Comp.installApp(computer, appId);
      if (!ci.ok) return ci;
      entry.installCount++;
      return { ok: true };
    }

    function review(appId, user, stars, comment) {
      const entry = catalog.get(appId);
      if (!entry) return { ok: false, reason: "not_in_catalog" };
      if (typeof stars !== "number" || stars < 1 || stars > 5) return { ok: false, reason: "bad_stars" };
      if (!reviews.has(appId)) reviews.set(appId, []);
      reviews.get(appId).push({ user, stars, comment, ts: Date.now() });
      // Recompute rolling average
      const all = reviews.get(appId);
      entry.rating = all.reduce((s, r) => s + r.stars, 0) / all.length;
      return { ok: true, newRating: entry.rating };
    }

    function getReviews(appId) { return reviews.get(appId) || []; }

    return { publish, unpublish, get, listAll, search, categories, install, review, getReviews };
  }

  return { createStore };
});
