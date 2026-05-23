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
|  6 |  711 | weapon-pickup   | DONE 2026-05-23 | Group: body+grip+pillar. New `opacity-pulse` facet (priority 23) pulses pillar material.opacity. 3 spawns (rifle/smg/sniper) with weapon_id selecting color. |
| —  |  712 | (architecture)  | DONE 2026-05-23 | **Refactor: everything-is-a-Thinga.** Deleted all 4 flat MANIFEST.json files (kinds/, tuning/, spawns/, worlds/) — replaced with `data/root.json` (a Thinga of kind `root`). Each kind def is now a Thinga of kind `kind-def`. Each spawn file is a Thinga of kind `spawn-set` with its instances as `children`. The world Thinga (`worlds/default.json`) `children` array contains `{ref: "<id>"}` references to every other Thinga it composes (kind-defs + tuning + spawn-sets). boot.js rewritten: starts at `root`, recursively resolves refs by fetching `data/<id>.json`, then three passes (registerKind → spawn → materialize spawn-set children). No manifest indirection; the parent IS the manifest. Added `root`, `world`, `kind-def`, `spawn-set` to KIND_NAMES enum. |
|  7 |  713 | armor-shard     | DONE 2026-05-23 | First kind on the new Thinga-graph architecture. Gold tetrahedron, dual-axis spin (x:1.8, y:3.0 — note swap vs health), magnet, dual-tone pickup sfx tracked in tuning. 3 spawns added; world references updated via {ref} only. |
| —  |  714 | (architecture)  | DONE 2026-05-23 | Split monolithic mesh_factories.js + handlers.js into per-file modules. New `src/ankhor/factories/` and `src/ankhor/facets/` directories, ≤35 lines each. boot.js split into boot.js + compose.js + world_params.js. New CLAUDE.md (substrate doctrine; old preserved at docs/CLAUDE.iter-705.md). New docs/AUTONOMOUS_LOOP.md carries the per-wakeup procedure. Default-facet injection added to boot.js spawn pass. |
| —  |  715 | (architecture)  | DONE 2026-05-23 | **Mesh-spec replaces per-kind factory code.** Added `mesh-spec` facets to 6 tuning Thingas (barrel, speed-orb, coin-drop, health-pickup, ammo-pickup, armor-shard) describing visuals declaratively as data. New `src/ankhor/build_mesh.js` is a generic data-driven Three.js builder (9 geometry kinds, 4 material kinds, snake→camel prop rename). Updated install_mesh_handler.js to resolve mesh-spec from `<thing.kind>-tuning` (or explicit `tuning_ref`); falls back to factory only for kinds not yet migrated. Deleted 6 factory files (barrel/speed_orb/coin_drop/health_pickup/ammo_pickup/armor_shard). Only weapon_pickup factory remains, awaiting per-variant tuning (iter 716+). |
| —  |  716 | (architecture)  | DONE 2026-05-23 | **No `??` fallbacks in src/ankhor.** All scene/camera/grid/light constants migrated to the world Thinga's `world-params` facet (19 keys); engine-wide runtime to a new `boot-params` facet on root.json (pixel_ratio_cap, max_frame_dt_seconds). New `src/ankhor/require_param.js` fails loud when a required key is missing — no `??` to hide it. world_params.js + boot.js rewritten to consume the params directly. Also stripped vestigial u/v aliases in magnet, pickup-radius, ttl, and mesh handler — position is canonical {x, y, z} everywhere. Fixed a typo in `background_color`: 723730 → 724242 (the real 0x0b0d12). `grep ' ?? ' src/ankhor/` now matches nothing. |
|  8 |  717 | crate           | DONE 2026-05-23 | First kind migrated on the fully-cleaned substrate. Wooden crate: BoxGeometry body (0.9³) + 3 slats at y=0.18/0.45/0.72. Mesh-spec is a 4-part group. Tuning Thinga also carries loot-table + break sfx/particle params (handlers for breakage land when hero+bullet kinds exist). 8 default spawns with pre-baked per-instance heading (replaces legacy random rotation). |
|  9 |  718 | grenade-crate   | DONE 2026-05-23 | Green ammo box (BoxGeometry 0.5×0.4×0.5) with emissive stripe. NEW `respawn-on-collect` facet (priority 41): permanent infrastructure pickup that hides mesh on collection and reveals after `cooldown_seconds`. Used for grenade caches (30s respawn, +3 grenades up to 9). Pure visibility toggle — the Thing persists; pickup-radius's despawn semantics are unaffected. 4 default spawns. |
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
