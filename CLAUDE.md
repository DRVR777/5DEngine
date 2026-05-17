# CLAUDE.md — guidance for Claude Code working in this repo

## What this project is
5DEngine — a browser-based game engine built on Three.js. Mission: production-grade
indie engine, target quality bar competitive with Defold/Stride.

## Repo layout
```
src/core/         engine plumbing (loop, events, input, time, registry)
src/render/       three.js rendering, post, particles, screen meshes, loaders
src/physics/      collision, gravity, platforms
src/audio/        web audio, mixer, music, voice
src/world/        terrain, city gen, domains, subworlds, portals, weather
src/entities/     character, NPC, AI, vehicles, bosses, pets, behavior trees
src/combat/       weapons, health, damage, destruction
src/economy/      money, shops, trading, marketplaces
src/progression/  quests, achievements, leaderboards, reputation
src/social/       chat, clans, multiplayer, emotes
src/activities/   minigames, cooking, fishing, missions, crafting
src/vehicles/     traffic, mounts, visibility
src/systems/      cross-cutting (inventory, debug, photo mode, accessibility,
                  a_star, trigger_zones, status_effects, cutscene)
src/ui/           HUD, overlays, radio, app framework
src/builder/      world editor + scripting
src/modding/      mod loader + sandbox
src/devices/      in-world computers, wires, peripherals
src/bridges/      engine_bridge, engine_browser, local_db_bridge
src/config/       game_config.js
tests/            real test suites (descriptive names)
tests/iters/      historical test_iter_NNN.js snapshots (DO NOT add new ones)
docs/             planning, architecture, decisions
index.html        entry point — keep thin
server.js         local Express/pg server (port 3001) — Node only, not a browser script
```

## Companion documents (read these too)
- `docs/MODULAR_ARCHITECTURE.md` — the target architecture (faceted entities)
- `docs/ROOT_CAUSE_PROTOCOL.md` — the fix quality bar
- `docs/PRIORITIES.md` — the current ordered priority list

## The 10 Rules

### Rule 1 — No new files at repo root
New .js files go in `src/<folder>/`. If no folder fits, ASK. Never invent a
folder without justifying its dependency layer.

### Rule 2 — No more test_iter_N.js
The iter-as-test pattern is retired. New tests go in `tests/` with names that
describe the behavior under test (`test_inventory_stacking.js`). One concern
per test file.

### Rule 3 — No new `<script src>` tags in index.html
We are migrating to ES modules. New files export and are imported. Do not add
`<script src="./src/X.js">` without explicit approval. Long-term goal: index.html
contains only the entry import.

### Rule 4 — Single Engine namespace
Stop creating `window._builderMultiList`, `window._hotbarSpawn`, etc. New
cross-module state goes on `window.Engine.<subsystem>` or is passed explicitly.
Leave existing `window.X` alone unless the task IS to migrate it.

### Rule 5 — Event bus for cross-system communication
System A informs system B via `Engine.events.emit("enemy.killed", {...})`.
Do not import system B from system A. If `Engine.events` doesn't exist for the
needed concern, ASK before adding a direct call.

### Rule 6 — Fixed timestep for physics, rAF for render
Anything affecting physics, collision, AI movement, or determinism runs on a
fixed step (60Hz). Anything visual runs on rAF with interpolation. Do not put
physics math inside the rAF callback directly.

### Rule 7 — Iter format
Commits use "iter N: <one-sentence summary>" for continuity. ONE concern per
iter. Touching 6 unrelated systems in one commit means STOP AND SPLIT.

### Rule 8 — Read before writing
Before adding a new file: `find src/ -name '*<keyword>*'`. Do not create
`leaderboards.js` next to `leaderboard.js`. Do not create `minigames.js` if
`minigame.js` exists. If you find a duplicate, FLAG it — don't merge without
permission.

### Rule 9 — Confirm before architectural autonomy
`/loop` is for feature iteration only. Architectural changes (physics swap,
ECS introduction, module extraction, anything touching 20+ files) require
explicit per-change approval. No bundled "while I'm in there" refactors.

### Rule 10 — When confused, ASK
This codebase has 150+ iters of history you don't have. If you don't know why
something is the way it is, ask. Don't guess. Don't "clean it up." Don't infer
intent from style. Cost of asking is low; cost of removing load-bearing
weirdness is high.

## Apply the Root Cause Protocol to every fix
See `docs/ROOT_CAUSE_PROTOCOL.md`. Short version: do not "just add a check",
"just retry", or "just catch and ignore" without finding the actual divergence
between observed and promised behavior. If you patch the same kind of bug
3+ times, fix the structure, not the instance.

## Apply Modular Architecture to every new system
See `docs/MODULAR_ARCHITECTURE.md`. New entity types are facet compositions
of a core `entity`, not parallel hierarchies. Adding a new capability is one
facet, attachable to anything. This is what unblocks the eventual ECS.

## Pre-commit checklist
- [ ] No new files at repo root
- [ ] No new test_iter_N.js
- [ ] No new `window.*` globals introduced
- [ ] If touching index.html, did the existing module already exist as ES module?
- [ ] Searched for duplicates of any new file name
- [ ] One concern per commit
- [ ] If fix: ROOT_CAUSE_PROTOCOL checklist satisfied
