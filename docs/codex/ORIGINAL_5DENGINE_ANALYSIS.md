# Original 5DEngine Analysis

## Current Shape

The repository is a browser-first GTA-style 5D demo. The current engine treats
the world as authoritative simulation state and uses Three.js as a rendering
view. The app layer includes UI modules, game/server scripts, database bridge
code, tests, and documentation around iterative extraction.

## Existing Abstractions

- World state is separated from rendering enough that tests can exercise core
  behavior without a browser.
- Layer boundaries already imply that location is more than x/y/z position.
- The app modules show a natural adapter boundary: terminal, chat, file manager,
  network monitor, world browser, minimap, object studio, settings, and music
  player.
- The server files and Supabase bridge already point toward a runtime-plus-state
  architecture rather than a pure game.

## Hardcoded Or Coupled Areas

- README examples include machine-specific file paths.
- The default mental model is still a particular GTA-style demo rather than a
  universal graph runtime.
- Rendering, world semantics, and demo objectives are described together.
- Dimensions are treated as engine concepts rather than fully declarative data.
- Runtime/service/database/repo objects are not yet first-class world entities.

## Generic Extraction Points

- Engine core: graph, node, link, dimensions, state, evidence, manifests.
- Adapters: process inventory, database inspection, repo inspection, P2P peers,
  browser renderers, server logs.
- Policies: high disk use, missing backup, process down, database unreachable,
  stale log, unverified dump.
- Views: JSON, Markdown, Mermaid, dashboard panels, Three.js scenes.
- Manifests: worlds, services, deployments, backups, dashboards, agents.

## Direction

The existing 5D engine can become a universal runtime if every concrete object
is normalized into a graph node and every behavior is moved behind policies,
adapters, and declarative views. Rendering then becomes one output, not the
definition of the engine.
