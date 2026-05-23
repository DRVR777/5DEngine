// subworlds.js — nested impossible-interior support per conviction.pdf.
//
// THE INVARIANT: an entity (typically a building/door) can carry a
// `subworld` facet pointing at a separate WorldState. When the player
// enters, they traverse a portal into that interior world. The interior
// has its own coordinate origin and may be ARBITRARILY LARGER than the
// exterior shell — because crossing the portal is a process handoff,
// not a coordinate transform.
//
// This is what enables: rooms longer-inside-than-outside, self-connecting
// corridors, planet-on-a-keychain, etc.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTASubworlds = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Wire an exterior entity (e.g. a building/door) to an interior world.
  // Adds a `subworld` facet on the entity + a portal in the world_graph.
  // Returns the portal edge id (for traversal later).
  function wireSubworld(opts) {
    if (!opts || !opts.outerEntity || !opts.outerWorldId || !opts.innerWorld || !opts.worldGraph) {
      return { ok: false, reason: "missing_args" };
    }
    const innerId = opts.innerWorldId || opts.innerWorld.worldId || `inner_${Math.random().toString(36).slice(2, 8)}`;
    if (!opts.worldGraph._nodes.has(opts.outerWorldId)) {
      return { ok: false, reason: "missing_outer_world" };
    }
    if (!opts.worldGraph._nodes.has(innerId)) {
      opts.worldGraph.addWorld(innerId, opts.innerWorld, { kind: "interior" });
    }
    // Subworld facet on the door/building
    opts.outerEntity.subworld = {
      worldId: innerId,
      spawnAt: opts.spawnAt || { u: 0, v: 0, y: 0 },
      returnSpawnAt: opts.returnSpawnAt || (opts.outerEntity.position
        ? { u: opts.outerEntity.position.u, v: opts.outerEntity.position.v, y: 0 }
        : { u: 0, v: 0, y: 0 }),
    };
    if (!opts.outerEntity.$header.$facets.includes("subworld")) {
      opts.outerEntity.$header.$facets.push("subworld");
      opts.outerEntity.$header.$version++;
    }
    // Portal: outer → inner (and inner → outer for return)
    const enterEdge = opts.worldGraph.addPortal(opts.outerWorldId, innerId, {
      kind: "interior_door",
      weight: 0,
      params: { spawnAt: opts.outerEntity.subworld.spawnAt, sourceEntityId: opts.outerEntityId },
    });
    const exitEdge = opts.worldGraph.addPortal(innerId, opts.outerWorldId, {
      kind: "interior_door_exit",
      weight: 0,
      params: { spawnAt: opts.outerEntity.subworld.returnSpawnAt },
    });
    return { ok: true, innerWorldId: innerId, enterEdge, exitEdge };
  }

  // Enter a building: looks up the subworld facet, traverses the portal.
  // Caller passes the entity that should be moved + the player's current world.
  function enterSubworld(playerEntityId, buildingEntity, currentWorldId, worldGraph, opts) {
    if (!buildingEntity || !buildingEntity.subworld) {
      return { ok: false, reason: "no_subworld" };
    }
    const innerId = buildingEntity.subworld.worldId;
    // Find the matching enter edge
    let enterEdge = null;
    for (const n of worldGraph.neighbors(currentWorldId)) {
      if (n.to === innerId && n.kind === "interior_door") { enterEdge = n.edgeId; break; }
    }
    if (!enterEdge) return { ok: false, reason: "no_portal" };
    return worldGraph.traversePortal(enterEdge, playerEntityId);
  }

  // Exit back to outer world via the matching exit portal.
  function exitSubworld(playerEntityId, currentWorldId, returnWorldId, worldGraph) {
    let exitEdge = null;
    for (const n of worldGraph.neighbors(currentWorldId)) {
      if (n.to === returnWorldId && n.kind === "interior_door_exit") { exitEdge = n.edgeId; break; }
    }
    if (!exitEdge) return { ok: false, reason: "no_exit_portal" };
    return worldGraph.traversePortal(exitEdge, playerEntityId);
  }

  // The freezeTest equivalent for impossible interiors: assert the inner
  // world's reachable extents exceed the outer shell footprint. Returns
  // the impossibility ratio (innerExtent / outerExtent).
  function impossibilityRatio(outerShellSize, innerExtent) {
    if (!outerShellSize || outerShellSize <= 0) return Infinity;
    return innerExtent / outerShellSize;
  }

  return { wireSubworld, enterSubworld, exitSubworld, impossibilityRatio };
})
;
