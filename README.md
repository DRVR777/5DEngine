# gta_demo

A GTA-style third-person 3D demo built on `multi_dim_engine_skeleton/`.
Runs in any modern browser. The engine is the authoritative state
(player position in 5D, layer transitions). Three.js is the renderer.

## Run

```
start gta_demo/index.html      # Windows
xdg-open gta_demo/index.html   # Linux
open gta_demo/index.html       # macOS
```

Or paste this into a browser:
```
file:///C:/Users/Quandale Dingle/hivemind/hivemind-sync/gta_demo/index.html
```

## Controls

- **WASD** — walk (camera-relative — pressing W always moves toward where the camera is looking)
- **Shift** — sprint
- **Space** — jump
- **Mouse-drag** — orbit the camera around the character

## What's there

- A character (capsule + face cube so you can see facing direction)
- A green ground plane with road grid
- 4 buildings, each tied to a `LayerBoundary` in the engine
- HUD showing live engine state (`render position`, `engine u/v`, `current layer`,
  and which building you are inside)
- Soft shadows, sky-blue fog

When you walk into a building's footprint the engine logs a
`phase_shift` transition and `world.layerId` flips. The HUD reflects it.

## How GTA-style mechanics map onto the engine

| GTA concept              | Implementation here                                   |
|--------------------------|-------------------------------------------------------|
| Camera-relative movement | `Bridge.applyCameraRelativeMove(world, id, F, R, …)` |
| Third-person chase cam   | `Bridge.chaseCameraPos(target, yaw, dist, height)`   |
| Interior cells           | `LayerBoundary` rect/circle, `world.layerId` per cell |
| World streaming          | One layer active at a time (engine invariant)         |

## Plan-test-revise

Every iteration adds:
1. PLAN section in `PLAN.md`
2. CODE
3. `test_iter_NN.js` — headless unit test (no browser needed)
4. Pass before commit; revise until green

Run all iteration tests:
```
bash gta_demo/smoke.sh
```

## Status

- iter 1 — bridge math (engine↔render, camera-relative move, chase cam math) — **9/9 pass**
- iter 2 — browser engine + boundary transitions integration — **7/7 pass**
- iter 3 — pointer-lock freelook + 4 wandering NPCs + 8 buildings — **6/6 pass**
- iter 4 — enterable car (bicycle physics) + mini-map — **11/11 pass**
- iter 5 — 8 collectible coins + objective + day/night cycle — **13/13 pass**
- iter 6 — articulated character (legs/arms swing, torso bobs), procedural
  ground texture, gradient skybox that morphs with sun position — **6/6 pass**
- **Total smoke: 52/52**

Future (not promised):
- iter 7 — interior render swap on layer change
- iter 8 — multiple vehicle types, ped AI that pathfinds to pickups
