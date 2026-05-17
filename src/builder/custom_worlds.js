// custom_worlds.js — JSON manifest hot-load for user-created worlds.
//
// A world manifest is a single JSON document:
//   {
//     "$schema": "5DEngine.world/1",
//     "worldId": "my_park",
//     "physicsProfile": "earth" | { ...inline },
//     "origin": { x, y, z, u, v },
//     "boundaries": [ {targetLayerId, kind, params}, ... ],
//     "entities": [ {type, id, facets:{...}}, ... ],
//     "buildings": [ {id, color, rect: {u0,v0,u1,v1}, height} ],
//     "spawn": { u, v, y }
//   }
// The loader validates, then materializes into a WorldState.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTAWorlds = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA = "5DEngine.world/1";

  function validate(manifest) {
    if (!manifest || typeof manifest !== "object") return { ok: false, reason: "not_object" };
    if (manifest.$schema !== SCHEMA) return { ok: false, reason: `bad_schema_${manifest.$schema}` };
    if (typeof manifest.worldId !== "string") return { ok: false, reason: "missing_worldId" };
    // entities/boundaries/buildings are optional (could be empty world)
    return { ok: true };
  }

  // Minimal LayerBoundary shim so this module doesn't import the engine.
  function makeBoundary(spec) {
    return {
      targetLayerId: spec.targetLayerId,
      kind: spec.kind,
      params: spec.params,
      contains(u, v) {
        if (this.kind === "rect") {
          const { u0, v0, u1, v1 } = this.params;
          return u >= u0 && u <= u1 && v >= v0 && v <= v1;
        }
        if (this.kind === "circle") {
          const { cu, cv, r } = this.params;
          const du = u - cu, dv = v - cv;
          return du * du + dv * dv <= r * r;
        }
        return false;
      },
    };
  }

  // Build a fresh WorldState from a manifest. Caller supplies the
  // WorldState constructor (and entity factory) so this module stays
  // dependency-light.
  function loadIntoNewWorld(manifest, deps) {
    const v = validate(manifest);
    if (!v.ok) return { ok: false, reason: v.reason };
    if (!deps || !deps.WorldState || !deps.createEntity) {
      return { ok: false, reason: "missing_deps" };
    }

    let physicsProfile = manifest.physicsProfile || null;
    if (typeof physicsProfile === "string" && deps.physicsProfileResolver) {
      physicsProfile = deps.physicsProfileResolver(physicsProfile);
    }
    const world = new deps.WorldState(1, {
      worldId: manifest.worldId,
      origin: manifest.origin,
      physicsProfile,
    });

    const boundaries = (manifest.boundaries || []).map(makeBoundary);
    world._boundaries = boundaries;
    world._buildings = (manifest.buildings || []).slice();
    world._spawn = manifest.spawn || { u: 0, v: 0, y: 0 };

    for (const entSpec of (manifest.entities || [])) {
      const ent = deps.createEntity(entSpec.type, entSpec.facets || {});
      world.addEntity(entSpec.id || `e_${Math.random().toString(36).slice(2, 8)}`, ent);
    }

    return { ok: true, world, boundaryCount: boundaries.length, entityCount: world.entities.size };
  }

  // Serialize a world back out to a manifest (round-trip).
  function exportToManifest(world, opts) {
    opts = opts || {};
    const manifest = {
      $schema: SCHEMA,
      worldId: world.worldId,
      physicsProfile: opts.profileName || (world.physicsProfile && world.physicsProfile.name),
      origin: world.origin,
      spawn: world._spawn || { u: 0, v: 0, y: 0 },
      buildings: world._buildings ? world._buildings.slice() : [],
      boundaries: (world._boundaries || []).map(b => ({
        targetLayerId: b.targetLayerId,
        kind: b.kind,
        params: b.params,
      })),
      entities: [],
    };
    for (const [id, e] of world.entities) {
      const facets = {};
      for (const f of e.$header.$facets) facets[f] = e[f];
      manifest.entities.push({ id, type: e.$header.$type, facets });
    }
    return manifest;
  }

  // Round-trip helper for tests / hot-reload.
  function reload(manifest, deps) {
    return loadIntoNewWorld(manifest, deps);
  }

  return { SCHEMA, validate, loadIntoNewWorld, exportToManifest, reload, makeBoundary };
});
