// registry.js — facet registry. One spot to register parsers + behaviors;
// engine core never knows specific facets.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTARegistry = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createRegistry() {
    const facets = new Map();   // name → {parser, tick, render, schema}
    const types  = new Map();   // typeName → {build(facets)} factory
    const apps   = new Map();   // in-game computer apps: name → {init, render, key}

    return {
      registerFacet(name, def) {
        if (facets.has(name)) throw new Error(`facet ${name} already registered`);
        facets.set(name, def);
      },
      getFacet(name) { return facets.get(name); },
      hasFacet(name) { return facets.has(name); },
      facetNames() { return Array.from(facets.keys()); },

      registerType(typeName, def) {
        if (types.has(typeName)) throw new Error(`type ${typeName} already registered`);
        types.set(typeName, def);
      },
      getType(typeName) { return types.get(typeName); },
      typeNames() { return Array.from(types.keys()); },

      registerApp(name, def) {
        if (apps.has(name)) throw new Error(`app ${name} already registered`);
        apps.set(name, def);
      },
      getApp(name) { return apps.get(name); },
      appNames() { return Array.from(apps.keys()); },

      // tick(world, dt): call every registered facet's tick that exists on entities
      tick(world, dt) {
        if (!world.entities) return;
        for (const [name, def] of facets) {
          if (!def.tick) continue;
          for (const e of world.entities.values()) {
            if (e[name] !== undefined) def.tick(e, dt, world);
          }
        }
      },
    };
  }

  return { createRegistry };
});
