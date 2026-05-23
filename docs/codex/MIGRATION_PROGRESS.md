# Migration Progress

> Tracker for the kind-by-kind migration per `docs/codex/specs/migration-sequence.md`.
> One row per iter. Pick the next `pending` row and migrate it.

## Per-iter checklist (the completion criteria — all must be true before moving on)

- [ ] Kind definition exists in `data/kinds/<name>.json`
- [ ] Kind enum entry exists in `experimental/holograph-runtime/src/registry.js` `KIND_NAMES`
- [ ] Tuning Thing exists in `data/tuning/<name>.json` (magic numbers + provenance)
- [ ] Facet handlers exist in `experimental/holograph-runtime/src/handlers.js` for any new facets
- [ ] Mesh factory (if applicable) in `src/ankhor/mesh_factories.js`
- [ ] Default spawn entries in `data/spawns/default_world.json` (or topic-specific file)
- [ ] MANIFESTs updated (`data/kinds/MANIFEST.json`, `data/tuning/MANIFEST.json`, `data/spawns/MANIFEST.json`)
- [ ] `npm test` exits 0
- [ ] `npm run browser-check` exits 0 (against `game.html` for legacy, ideally also against `index.html`)
- [ ] Visual check: `index.html` renders the new kind correctly

## Sequence

| # | Iter | Kind | Status | Notes |
|---|------|------|--------|-------|
|  1 |  706 | barrel          | DONE 2026-05-23 | First proof — mesh factory + tuning + 8 default spawns. Substrate now renders real game content. |
|  2 |  707 | speed-orb       | DONE 2026-05-23 | Yellow dodecahedron. Bob+spin+emissive-pulse facets added to handlers.js. pickup-radius facet defined (collection waits on hero). 3 default spawns. |
|  3 |  708 | coin-drop       | DONE 2026-05-23 | Gold sphere with magnet facet (priority 35). New `magnet` handler attracts position toward hero when within range. 3 default spawns. |
|  4 |  709 | health-pickup   | DONE 2026-05-23 | Green octahedron. Extended spin facet to multi-axis (x/y/z) for dual-axis rotation. Added 13 missing kind names to registry.js Kind enum (coin-drop, health/ammo/weapon-pickup, armor-shard/vest, grenade-crate, mine/turret/grenade, spec). 2 default spawns. |
|  5 |  710 | ammo-pickup     | DONE 2026-05-23 | Orange box (BoxGeometry 0.18×0.08×0.28). Reuses bob/spin/magnet/pickup-radius. New `ammo` data facet for qty+item. 2 default spawns. |
|  6 |    ? | weapon-pickup   | pending        | weapon drop from heavy/robot/boss |
|  7 |    ? | armor-shard     | pending        | gold shard, dual-tone sfx, magnet |
|  8 |    ? | crate           | pending        | wooden crate, breakable |
|  9 |    ? | grenade-crate   | pending        | restock capped at 9, 30s respawn |
| 10 |    ? | hazard-zone     | pending        | smoke / poison / fire zones |
| 11 |    ? | bullet          | pending        | hero + enemy bullets; physics + lifetime + hit-detection facets |
| 12 |    ? | enemy           | pending        | 8 enemy types (grunt/heavy/fast/poisoner/incendiary/robot/boss/sniper) |
| 13 |    ? | vehicle         | pending        | cars; physics, suspension, drive controls |
| 14 |    ? | npc             | pending        | dialog + ai facets |
| 15 |    ? | screen          | pending        | screen-render facet — visual surfaces in 3D |
| 16 |    ? | server-process  | pending        | bridges to 7d-engine, screen 1 |
| 17 |    ? | docker-container | pending       | bridges to 7d-engine |
| 18 |    ? | http-request    | pending        | live request stream, screen 2 |
| 19 |    ? | database        | pending        | DB activity, screen 3 |
| 20 |    ? | agent-message   | pending        | council activity, screen 4 |

## Architectural baseline (after iter 706)

- `index.html` (66 lines) → boots Ankhor substrate via `src/ankhor/boot.js`
- `src/ankhor/boot.js` (now ~140 lines) → assembles registry + render + 3 data loaders + tick loop
- `src/ankhor/mesh_factories.js` → named Three.js factories (barrel done)
- `src/ankhor/install_mesh_handler.js` → mesh facet handler with init/tick/cleanup
- `data/kinds/MANIFEST.json` → 25 kind definitions
- `data/tuning/MANIFEST.json` → tuning Things (barrel done)
- `data/spawns/MANIFEST.json` → spawn sets (default_world.json with 8 barrels)
- `experimental/holograph-runtime/src/registry.js` → ThingRegistry (Kind enum, 7 regrets honored)
- `experimental/holograph-runtime/src/handlers.js` → pure-data facet handlers (position, ttl, health, etc.)
- `game.html` → unchanged legacy 2449-line engine+game

## Conventions

- Magic numbers NEVER inline in factories or handlers — always tuning Thing lookup with fallback
- Provenance MUST cite source file + line numbers when extracting
- Visual changes are zero — the goal is feel preservation
- `do_not_optimize: true` in provenance signals constants are load-bearing and must not be "tidied"
- One kind per iter; commit + push per iter; do not bundle migrations
