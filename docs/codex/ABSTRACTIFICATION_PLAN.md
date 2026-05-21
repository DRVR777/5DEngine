# Abstractification Plan

## Current Structure

The current repository mixes an interactive 5D demo, browser rendering, app
modules, server scripts, tests, and database bridge material. The design already
has useful seams around world state, rendering, apps, server behavior, and tests.

## Future Structure

- `experimental/holograph-runtime/src`: graph core, policies, adapters, engines.
- `experimental/holograph-runtime/hgrl`: language draft and examples.
- `experimental/holograph-runtime/schemas`: universal object schemas.
- `experimental/holograph-runtime/examples`: portable manifests and output.
- `docs/codex`: migration/design reports.

## Move Into Graph Core

Universal node shape, links, graph containers, dimensions, evidence, exports,
validation, and nested worlds.

## Move Into Adapters

Process inventory, database inspection, repo inspection, P2P peer state, storage
backup state, browser rendering, server logs, and dashboard data feeds.

## Move Into Manifests

World deployments, database maps, backup targets, views, dimensions, health
checks, server layouts, and agent bindings.

## Move Into Policies

High disk usage, missing backup, process down, port closed, database unreachable,
unverified dump, stale logs, and destructive-action approval gates.

## Move Into Views

Three.js game view, server dashboard, Markdown reports, Mermaid graphs, JSON
manifests, database graphs, repo graphs, and backup verification panels.

## Gradual Migration

Keep the existing demo intact. Introduce the holographic runtime as an
experimental package, model current 5D entities as universal nodes, then migrate
rendering and server concepts into adapters one at a time.
