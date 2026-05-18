# STATE.md

## Phase

Phase 0 — Scaffolding (completing)

Phases:
```
0. Scaffolding (registry, core.js, atom validator, data skeleton)
1. Tuning extraction (all monolith constants → /data/tuning/ atoms)
2. Component atoms (every component as a $type with schema)
3. System atoms (every system as a $type, pure functions)
4. Behavior atoms (AI behaviors as $type)
5. Render layer (Three.js wrapper)
6. Data extraction (every monolith concept → /data/*.json atoms)
7. Network atoms (every packet as a $type)
8. Parity (golden tests green, browser parity with monolith)
9. Bug backlog
```

## Current task

**Tick 1 — Rewrite all `/data/` files to the universal atom format.**

Every JSON file in `/data/` must have exactly:
```json
{ "$version": 1, "$type": "...", "$id": "...", "$facets": {}, "$refs": {}, "$meta": {} }
```

Steps:
1. Run the holographic format check bash (from LOOP_PROMPT.md status check).
2. Rewrite each bad file. One file per enemy type in `data/enemies/types/`.
   One file per weapon in `data/weapons/types/`. One per perk, shop item, etc.
3. Extract all numeric constants from `../5DEngineMassive/index.html` into
   `data/tuning/physics.json`, `data/tuning/hero.json`, `data/tuning/weapons.json`.
   These are the feel-preserving tuning atoms.
4. Update `/src/core/registry.js` to expect the new format (`$facets` as object, not array).
5. Run `npm test` — green before committing.
6. Commit: `"iter 434: tick 1 — universal atom format, tuning extraction"`

## Last tick

```
timestamp: 2026-05-18
summary:   tick 0 scaffolding — Core ECS runtime, Registry, NetworkBridge, 28 unit tests,
           data layer (wrong format), docs
files:     data/*, src/core/core.js, src/core/registry.js, src/net/network_bridge.js,
           tests/unit/core.test.js, docs/*.md, package.json
tests:     28/28 passed (vitest)
commit:    iter 433 (pending push)
outcome:   ok — tests green, format wrong (data files use $header not $version/$type/$id/$facets)
```

## Queued

- Tick 2: Wire `src/core/core.js` into index.html (additive import, parallel runtime)
- Tick 3: `src/systems/ecs_combat.js` — pure combat system from data/enemies/
- Tick 4: `game_server.py` bridge relay (socket.io → TCP port 7780)
- Tick 5: `src/systems/ecs_wave.js` — wave system
- Tick 6: `src/systems/ecs_pickup.js` — pickup system
- Tick 7: `src/systems/ecs_perk.js` — perk system from data/perks/
- Tick 8: `src/systems/ecs_shop.js` — shop system
- Tick 9: Agent packet dispatch on game events → dworld:// AGENT channel
- Tick 10: Golden test capture from 5DEngineMassive + test harness
- Tick 11–20: Remaining system extractions + parity

## Blocked

(none)

## Bug backlog (Phase 9)

From iter 428–432 fix session (all fixed in monolith, need ECS equivalents):
- ScriptRunner.dispatchZoneEvent guard — fixed iter 428
- getHex on non-emissive materials — fixed iter 428
- socket.io 400 + favicon 404 — fixed iter 429
- _spawnSpeedOrb `now` TDZ — fixed iter 429
- isMoving TDZ at line 6260 — fixed iter 431
- HP bar RangeError after Resilient perk — fixed iter 431
- Pointer lock SecurityError — fixed iter 431
- Sniper scope camera drift — fixed iter 431
- Enemies spawn in buildings — fixed iter 432

Remaining (ECS systems must not reintroduce these):
- Three.js `refreshUniformsCommon` crash — root cause unclear
- Stamina regen edge cases near death
