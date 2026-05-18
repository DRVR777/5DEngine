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

**Tick 3 — Wire `src/core/core.js` into index.html as parallel additive import.**

Steps:
1. Add `import { Core } from './src/core/core.js';` after line 1013 in index.html
2. Load & register hero + enemy prefabs at startup from data/ atoms
3. Boot Core alongside existing engine (no removal of monolith code yet)
4. npm test green. Commit: "iter 436: tick 3 — core.js wired into index.html, prefabs registered"

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
