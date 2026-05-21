---
id: spec/migration-sequence
kind: spec
name: Migration Sequence
refs: [spec/kind-catalog, spec/feel-preservation, spec/registry-runtime]
created_at: 2026-05-21T00:00:00Z
facets: [order, completion-criteria, deletion-list]
---

# Migration Sequence

Do not shrink `index.html` by extracting more blocks. Shrink it by moving kinds into the registry.

Order: barrel -> speed-orb -> coin-drop -> health-pickup -> ammo-pickup -> weapon-pickup -> armor-shard -> crate -> grenade-crate -> hazard-zone -> bullet -> enemy -> vehicle -> npc -> screen -> server-process -> docker-container -> http-request -> database -> agent-message.

Completion criteria: spec exists, JSON definition exists, handlers exist, shadow run passes, `npm test` exits 0, `npm run browser-check` exits 0, and the feel snapshot matches.
