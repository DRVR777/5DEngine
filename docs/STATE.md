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

**Tick 15 — next system extraction (TBD)**

Completed ticks this session:
- iter 440 — ecs_pickup (tick 7)
- iter 441 — ecs_shop (tick 8)
- iter 442 — ecs_perk (tick 9)
- iter 443 — ecs_agent_dispatch (tick 10)
- iter 444 — golden constants + 3 tuning atoms (tick 11)
- iter 445 — ecs_status_effects (tick 12)
- iter 446 — ecs_regen (tick 13)
- iter 447 — ecs_weapon (tick 14)

## Previous task (tick 1 — DONE)

**Tick 1 — Start tuning extraction + fix 5 atom format violations.**

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
timestamp: 2026-05-18T06:52Z
summary:   tick 14 — ecs_weapon system. fire-rate cooldown, reload with perk
           reload mul, magazine tracking, weapon switch. 217/217 tests green.
files:     src/systems/ecs_weapon.js, tests/unit/ecs_weapon.test.js, index.html
tests:     217/217 passed
commit:    iter 447
outcome:   ok
```

## Previous tick

```
timestamp: 2026-05-18T05:23Z
summary:   tick 2 — 0 holographic violations. 8 enemy type atoms + 10 perk atoms created.
           enemy_types/perks/shop_items/game_modes rewritten as index/lookup atoms.
           damage_multipliers.json fixed. vitest.config.js scoped to tests/unit/ only.
files:     data/enemies/types/{grunt,heavy,fast,poisoner,incendiary,robot,boss,sniper}.json (new)
           data/perks/types/{dmg,speed,regen,reload,maxhp,grenades,smoke,armor,vampire,ammo}.json (new)
           data/enemies/enemy_types.json, data/perks/perks.json,
           data/shop/shop_items.json, data/game_modes/game_modes.json (fixed)
           vitest.config.js (new)
tests:     28/28 passed
commit:    iter 435
outcome:   ok
```

## Queued

- Tick 15: `src/systems/ecs_score.js` — kill-credit scoring + level-up system
- Tick 16: `data/weapons/` atoms for all 5 weapons (holographic format)
- Tick 17: `src/systems/ecs_ai_movement.js` — wander/alert/chase state machine
- Tick 18: `src/systems/ecs_inventory.js` — ECS-native inventory (replaces Inv module)
- Tick 19: `data/tuning/weapons.json` + weapon damage golden tests
- Tick 20: Parity integration test (run ECS combat vs monolith golden values)

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
