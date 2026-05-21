---
id: spec/registry-runtime
kind: spec
name: Registry Runtime API
refs: [spec/kind-catalog, spec/facet-catalog]
created_at: 2026-05-21T00:00:00Z
facets: [api, lifecycle, errors, ankhor-constraints]
---

# Registry Runtime API

The runtime stores every game object and server observation as one Thing shape: `{ id, kind, name, parent?, created_at, facets[] }`.

Stores: row store, facet store, kind registry, reverse facet index, handler registry.

API: `spawn(thing)`, `tick(dt)`, `despawn(id, reason)`, `get(id)`, `byKind(kind)`, `byFacet(name)`, `resolveRef(ref)`.

Error modes: duplicate id, unknown kind, missing required facet, unknown id, reference collision.
