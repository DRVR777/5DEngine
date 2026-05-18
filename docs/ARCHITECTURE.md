# 5DEngine Holographic Architecture

## The One Rule

Everything is an atom. Atoms share one shape. Facets differ.

All atoms — components, systems, behaviors, prefabs, weapons, enemies, perks,
levels, game modes, network packets, tests, configs — are:

```json
{
  "$version": 1,
  "$type": "<facet_type>",
  "$id": "<unique_id>",
  "$facets": { },
  "$refs": { },
  "$meta": { }
}
```

The registry (`/src/core/registry.js`) maps `$type` → parser. Adding a game
concept = one registry entry. Never a new file shape.

## Layout

```
/src/core/         registry.js  core.js  scripting.js  script_api.js  prefab.js
/src/components/   facet schemas. Each component is a $type.
/src/systems/      ≤200 lines each. Each system is a $type.
/src/behaviors/    ≤100 lines each. Each behavior is a $type.
/src/render/       Three.js wrapper.
/src/net/          Network bridge.
/src/main.js       Boot. ≤100 lines.
/data/             Pure JSON atoms. Mirrors /src/ structure.
/tests/            Mirrors /src/. Each test is a $type.
/docs/             ARCHITECTURE  STATE  JOURNAL  LOOP_PROMPT.
/index.html        ≤100 lines. Loads /src/main.js. Renders canvas.
                   (current: 9700+ lines monolith — shrinks each tick)
```

## Hard rules

1. Universal format enforced on every JSON file in `/data/`.
2. One parser per `$type` in `registry.js`.
3. No file outside `/src/core/` imports anything except `/src/core/` and `/src/components/`.
4. No system >200 lines. No behavior >100 lines.
5. Components: data only. No methods.
6. System signature: `(dt, ids, ctx) => void`.
7. All tests pass before any commit.
8. New source file = new test file.
9. `/data/` files are atoms. Always.
10. The part is in the whole. The whole is in the part. Holographic.

## Source of truth

`../5DEngineMassive/` — read-only reference monolith (iter 432, commit 749b85e).

## Feel preservation

Every numeric constant from the monolith is extracted to `/data/tuning/`.
Every system has a golden test generated from the monolith baseline.
Feel is provable, not vibes. See `docs/LOOP_PROMPT.md` for the full methodology.

## Done when

- Every game object is an atom in `/data/`
- `/src/` ≤2000 lines total
- One registry, every `$type` handled there
- Browser parity with monolith (golden tests green)
- All tests green
- New enemy/weapon/perk/behavior = 1 JSON file, registry already knows the `$type`

## Network layer

```
5DEngine (browser) → socket.io → game_server.py (port 5050)
  → TCP relay → worldWideComms/mkii/game_bridge.py (port 7780)
  → NodeMKII encrypt → relay → peer

Channels:
  0 STATE   20Hz  { heroHp, heroU, heroV, gameMode, waveNum }
  1 EVENTS  event { type, payload }
  2 WORLD   event { op, data }
  3 CHAT    future
  4 AGENT   demand { identity, payload, hopHistory }  ← dworld:// packets
```

## Sibling projects

| Project | Connection |
|---|---|
| `worldWideComms/mkii` | GameBridge TCP channel, src/net/network_bridge.js |
| `decentralizeAiNetwork` | AGENT channel (4), dworld:// URIs, identity packets |
| `localInternetComms` | Same protocol as worldWideComms, LAN scope |
