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
