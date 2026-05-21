---
id: spec/facet-catalog
kind: spec
name: Facet Catalog
refs: [spec/registry-runtime, spec/kind-catalog]
created_at: 2026-05-21T00:00:00Z
facets: [catalog, handlers, priorities]
---

# Facet Catalog

Handler signature: `(thing, facetData, dt, registry) => void`.

Game facets: position, physics, health, destructible, ai-fsm, behavior-tree, pickup, timer, ttl, spawn, mesh, screen-render, network-observable, tuning, provenance.

Server facets: process-observer, log-tailer, health-poller, request-stream, db-connection, agent-message.
