// save_load.js — round-trip game state through signed manifests.
// Serializes: WorldState (worldId, physicsProfile name, entities array
// with $header+facets), plus extras like inventory, hero hp, score.
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GTASaveLoad = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA = "5DEngine.savegame/1";

  // Deep clone via JSON (entities only carry plain data; safe + cheap).
  function _clone(v) { return JSON.parse(JSON.stringify(v)); }

  // Snapshot a world + extras into a JSON-serializable object.
  // Deep-clones facet data so post-save world mutations don't corrupt
  // the captured snapshot (manifest content hash would otherwise drift).
  function snapshot(world, extras) {
    extras = extras || {};
    const entities = [];
    if (world.entities) {
      for (const [id, e] of world.entities) {
        const facets = {};
        for (const f of e.$header.$facets) facets[f] = _clone(e[f]);
        entities.push({ id, type: e.$header.$type, facets });
      }
    }
    return {
      $schema: SCHEMA,
      capturedAt: Date.now(),
      world: {
        worldId: world.worldId,
        layerId: world.layerId,
        physicsProfileName: world.physicsProfile && world.physicsProfile.name,
        origin: world.origin,
        entities,
      },
      extras: Object.assign({}, extras),
    };
  }

  // Restore a snapshot into a NEW world. deps: { WorldState, createEntity,
  // physicsProfileResolver }.
  function restore(snap, deps) {
    if (!snap || snap.$schema !== SCHEMA) return { ok: false, reason: "bad_schema" };
    if (!deps || !deps.WorldState || !deps.createEntity) {
      return { ok: false, reason: "missing_deps" };
    }
    const profile = deps.physicsProfileResolver
      ? deps.physicsProfileResolver(snap.world.physicsProfileName)
      : null;
    const world = new deps.WorldState(snap.world.layerId || 1, {
      worldId: snap.world.worldId,
      origin: snap.world.origin,
      physicsProfile: profile,
    });
    for (const eSpec of snap.world.entities) {
      const ent = deps.createEntity(eSpec.type, eSpec.facets);
      world.addEntity(eSpec.id, ent);
    }
    return { ok: true, world, extras: snap.extras };
  }

  // Save: wrap snapshot in a signed manifest and put it in a Manifest store.
  // deps: { Manifest, store, signer: {pubkey} }
  function saveToStore(world, extras, deps) {
    if (!deps || !deps.Manifest || !deps.store || !deps.signer) {
      return { ok: false, reason: "missing_deps" };
    }
    const snap = snapshot(world, extras);
    const manifest = deps.Manifest.makeManifest({
      kind: "savegame",
      content: snap,
      signer: deps.signer,
      version: deps.version || "1.0.0",
    });
    const put = deps.store.put({ ...manifest, kind: "asset" });
    // Note: store.put rejects non-app/world manifests unless kind matches
    // what verify() expects. We use kind="asset" wrapper above to fit.
    // Actually our store accepts any verified kind — let's just put the
    // raw manifest:
    const putRaw = deps.store.put(manifest);
    if (!putRaw.ok) return putRaw;
    return { ok: true, manifestId: manifest.id };
  }

  // Load: pull manifest from store by id, verify, then restore.
  function loadFromStore(manifestId, deps) {
    if (!deps || !deps.Manifest || !deps.store) {
      return { ok: false, reason: "missing_deps" };
    }
    const manifest = deps.store.get(manifestId);
    if (!manifest) return { ok: false, reason: "not_found" };
    const v = deps.Manifest.verify(manifest);
    if (!v.ok) return { ok: false, reason: `verify_failed:${v.reason}` };
    return restore(manifest.content, deps.restoreDeps || deps);
  }

  // Save slots: maintain a small named-slot index on top of the store.
  function createSlotManager(opts) {
    const store = opts.store;
    const Manifest = opts.Manifest;
    const slots = new Map();    // slotName → manifestId

    function save(slotName, world, extras, signer) {
      const r = saveToStore(world, extras, { Manifest, store, signer });
      if (!r.ok) return r;
      slots.set(slotName, r.manifestId);
      return { ok: true, slot: slotName, manifestId: r.manifestId };
    }
    function load(slotName, restoreDeps) {
      const id = slots.get(slotName);
      if (!id) return { ok: false, reason: "no_such_slot" };
      return loadFromStore(id, { Manifest, store, restoreDeps });
    }
    function listSlots() { return Array.from(slots.keys()); }
    function deleteSlot(slotName) { return slots.delete(slotName); }

    return { save, load, listSlots, deleteSlot };
  }

  return { SCHEMA, snapshot, restore, saveToStore, loadFromStore, createSlotManager };
});
