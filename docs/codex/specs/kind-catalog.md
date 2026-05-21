---
id: spec/kind-catalog
kind: spec
name: Kind Catalog
refs: [spec/registry-runtime, spec/facet-catalog, spec/migration-sequence]
created_at: 2026-05-21T00:00:00Z
facets: [catalog, game-kinds, server-kinds]
---

# Kind Catalog

Kind definitions live in `data/kinds/`. The implementation enum is `Kind` in `experimental/holograph-runtime/src/registry.js`.

Game kinds: barrel, crate, bullet, enemy, pickup, vehicle, npc, weapon, hazard-zone, speed-orb, spawn-point, screen.

Server kinds: server-process, docker-container, http-request, database, database-row, nginx-route, agent, agent-message, journal-event.
