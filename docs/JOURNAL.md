# JOURNAL.md

Append-only. Newest at bottom.

---

## tick 0 — 2026-05-18T05:00Z

**Did:**
Read decentralizeAiNetwork (BIBLE.md, ARCHITECTURE_SYNTHESIS.md, How to Be Modular.txt),
worldWideComms/mkii/game_bridge.py (TCP bridge, 5 channels, port 7780), localInternetComms.
Cloned DRVR777/5DEngine → local 5DEngineMassive as read-only monolith reference.
Wrote full ECS runtime (src/core/core.js): entity registry, component store, smallest-store-first
query, snapshot-safe event bus, priority-sorted system runner, fixed-step 1/60s accumulator,
prefab system with extends+cycle detection, data loader, TCP net bridge, dworld:// agent packets.
Wrote FacetRegistry (src/core/registry.js): one parser per facet type, TypeConfig map, atom
build/parse/detect, dworld:// ref resolution. 9 built-in parsers (entity, combat, loot, weapon,
perk, effect, shop_item, prefab, net_node, agent). Wrote NetworkBridge (src/net/network_bridge.js):
20Hz state pump, 5-channel relay through game_server.py → GameBridge TCP.
Wrote 28 vitest unit tests (tests/unit/core.test.js): entity lifecycle, components, query,
event bus, system runner, fixed timestep, prefab inheritance. All 28 green.
Wrote docs: ARCHITECTURE.md, STATE.md, JOURNAL.md, LOOP_PROMPT.md (verbatim from user spec
including feel preservation methodology). Added vitest to package.json.

**Atom types touched:** entity, combat, loot, weapon, perk, effect, shop_item, prefab, net_node, agent (parsers registered; data files still in wrong format)

**Files:**
- src/core/core.js (ECS runtime)
- src/core/registry.js (FacetRegistry)
- src/net/network_bridge.js (TCP relay)
- tests/unit/core.test.js (28 tests)
- data/enemies/*, data/weapons/*, data/perks/*, data/shop/*, data/prefabs/*, data/levels/*, data/game_modes/*
- docs/ARCHITECTURE.md, docs/STATE.md, docs/JOURNAL.md, docs/LOOP_PROMPT.md
- package.json (+ vitest)

**Tests:** 28/28 passed

**Holographic violations:** ALL data files (wrong format — using old $header pattern, not $version/$type/$id/$facets). Tick 1 fixes this.

**Commit:** iter 433 "tick 0: ECS scaffolding — Core, Registry, NetworkBridge, 28 unit tests"

**Next:** Tick 1 — rewrite all /data/ files to universal atom format. Extract tuning constants.

**Notes:**
Key insight absorbed from user: "all elements are made of atoms / all atoms are the same / but elements aren't the same." The ThingaFile format from How to Be Modular.txt is the atom. Registry pattern is F=ma. User confirmed local clone approach (no GitHub rename). 5DEngineMassive is at C:\Users\Quandale Dingle\5DEngineMassive. ECS layer is additive — index.html (9700+ lines) untouched. Feel preservation methodology added to LOOP_PROMPT.md: tuning atoms, golden tests, shadow mode, port in dependency order.

---

## tick 1 — 2026-05-18T05:10Z

**Did:**
Fixed 5 holographic format violations. Created tuning atoms extracted from monolith.
Rewrote data/prefabs/hero.json, data/prefabs/enemy_grunt.json, data/levels/level_thresholds.json.
Created data/tuning/physics.json (gravity=-25, fixedDt, camera constants).
Created data/tuning/hero.json (maxHp, armorAbsorb=0.6, walkSpeed, sprintSpeed, stamina, lifesteal).
5 violations remained after tick 1: enemy_types, perks, shop_items, game_modes, damage_multipliers.

**Tests:** 28/28 passed
**Commit:** iter 434

---

## tick 2 — 2026-05-18T05:23Z

**Did:**
Resolved ALL remaining holographic violations. 0 BAD files.
Created 8 individual enemy type atoms in data/enemies/types/ (grunt, heavy, fast, poisoner,
incendiary, robot, boss, sniper). Each is $type=entity with combat stats + $refs to damage_multipliers.
Created 10 individual perk atoms in data/perks/types/ (dmg, speed, regen, reload, maxhp,
grenades, smoke, armor, vampire, ammo). Each is $type=perk with effect descriptor.
Rewrote collection files as index/lookup atoms:
  - enemy_types.json → $type=index, $refs to all 8 types
  - perks.json → $type=index, $refs to all 10 perks
  - shop_items.json → $type=lookup, $facets keyed by id (13 items including bundle op)
  - game_modes.json → $type=lookup, $facets keyed by id (4 modes)
Created vitest.config.js scoping test runner to tests/unit/ only (excludes empty visual stubs).

**Format check:** 28/28 atoms OK, 0 violations
**Tests:** 28/28 passed
**Commit:** iter 435

---

## iter 678 -- 2026-05-19

**Did:**
Extracted the non-enemy tail of the bullet physics loop into
`src/systems/bullet_world_hit_tick.js`: peer hits, barrel hits, crate hits,
building blocker impacts, wall scorch normals, and range expiry.

Kept the enemy damage/kill path in `index.html` for the next bullet-physics
sub-extraction. Added pseudocode comments at the remaining call site.

While running the no-render campaign check, Playwright found a browser-only
runtime error: `_layerTransTick` referenced a missing `bldgName` global. Fixed
the mount wiring with a local layer-name resolver matching the debug HUD names.

**Line count:**
`index.html` total 4128 -> 4060 (-68), code 3338 -> 3275 (-63).

**Tests:**
`npm test` passed (217 files, 3563 tests).
`npm run browser-check` passed (`BROWSER OK`).
`npm run test:campaign` passed (3/3 no-render waves cleared).

**Next:**
Extract the bullet enemy damage/kill path into the bullet physics module set.

---

## iter 679 -- 2026-05-19

**Did:**
Extracted the bullet-caused enemy death/reward branch into
`src/systems/bullet_enemy_kill_tick.js`. The collision and raw damage
calculation remain in `index.html`; the kill side effects now live behind
`_bulletEnemyKillTick.tick(en, ep, { nowMs, headshot })`.

Pinned the important behavior with unit tests: death state, respawn time,
headshot bullet-time, kill marker timing, level-up threshold, apex stamina,
elite rewards, low-HP lifesteal, robot drops/effects, boss bonus/effects, and
last-wave-kill bullet-time.

**Line count:**
`index.html` total 4060 -> 3950 (-110), code 3275 -> 3176 (-99).

**Tests:**
`npm test` passed (218 files, 3574 tests).
`npm run browser-check` passed (`BROWSER OK`).
`npm run test:campaign` passed (3/3 no-render waves cleared).

**Next:**
Extract the remaining bullet movement/substep shell or the surviving enemy-hit
feedback path, whichever gives the safer >=20-line slice.

**Next:** Tick 3 — wire core.js into index.html as additive import. Register prefabs from data/.
